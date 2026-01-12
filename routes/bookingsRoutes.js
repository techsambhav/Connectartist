const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Profile = require('../models/Profile');
const auth = require('../auth'); // ensureAuth sets req.user and req.userId

// Helper to normalize id -> string
function sid(v) { return v ? String(v) : null; }

// Helper: build a filter that finds bookings where artistId matches either the supplied id,
// or a profile._id, or the profile.userId. This handles mixed storage in DB.
async function buildArtistFilter(artistId) {
  if (!artistId) return null;
  const orClauses = [];

  // direct match (string or ObjectId stored directly)
  if (mongoose.Types.ObjectId.isValid(artistId)) {
    orClauses.push({ artistId: new mongoose.Types.ObjectId(artistId) });
  }
  orClauses.push({ artistId: artistId });

  // try looking up a profile that might tie userId <> profile._id together
  try {
    const profile = await Profile.findOne({
      $or: [
        { userId: artistId },
        { _id: mongoose.Types.ObjectId.isValid(artistId) ? artistId : null }
      ].filter(Boolean)
    }).lean();

    if (profile) {
      // if bookings were stored with profile._id
      if (profile._id) orClauses.push({ artistId: profile._id });
      // if bookings were stored with userId
      if (profile.userId) orClauses.push({ artistId: profile.userId });
    }
  } catch (e) {
    // swallow lookup errors and continue with what we have
    console.warn('buildArtistFilter profile lookup failed', e && e.message);
  }

  // de-duplicate simple objects by stringifying; keep valid ObjectId objects as-is
  const uniq = [];
  const seen = new Set();
  for (const cl of orClauses) {
    try {
      const key = JSON.stringify(cl);
      if (!seen.has(key)) { seen.add(key); uniq.push(cl); }
    } catch (e) {
      // fallback
      uniq.push(cl);
    }
  }

  if (uniq.length === 1) return uniq[0];
  return { $or: uniq };
}

// GET /api/bookings
// - If ?organizerId=... or ?artistId=... provided - uses that
// - Otherwise returns bookings where current user is organizer OR artist
router.get('/', auth.ensureAuth, async (req, res) => {
  try {
    const { organizerId, artistId } = req.query;
    let filter = {};

    if (organizerId) {
      filter.organizerId = organizerId;
    } else if (artistId) {
      // build robust artist filter
      const artistFilter = await buildArtistFilter(artistId);
      if (!artistFilter) return res.status(400).json({ success: false, message: 'Invalid artistId' });
      filter = artistFilter;
    } else {
      const me = req.userId || (req.user && String(req.user._id));
      filter = { $or: [{ organizerId: me }, { artistId: me }, { userId: me }] };
    }

    const bookings = await Booking.find(filter).sort({ createdAt: -1 }).lean();

    // Attach profiles (artist & organizer) for the UI
    const enriched = await Promise.all(bookings.map(async b => {
      const out = Object.assign({}, b);
      try {
        out.artistProfile = (await Profile.findOne({ userId: out.artistId }).lean()) || null;
      } catch (e) { out.artistProfile = null; }
      try {
        out.organizerProfile = (await Profile.findOne({ userId: out.organizerId || out.userId }).lean()) || null;
      } catch (e) { out.organizerProfile = null; }
      return out;
    }));

    return res.json({ success: true, bookings: enriched });
  } catch (err) {
    console.error('GET /api/bookings error', err && (err.stack || err.message));
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/bookings/:id - return one booking if requester is involved (artist or organizer)
router.get('/:id', auth.ensureAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    const booking = await Booking.findById(id).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const me = req.userId || (req.user && String(req.user._id));
    const isOwner = sid(booking.organizerId) === sid(me) || sid(booking.artistId) === sid(me) || sid(booking.userId) === sid(me);
    if (!isOwner) return res.status(403).json({ success: false, message: 'Forbidden' });

    booking.artistProfile = (await Profile.findOne({ userId: booking.artistId }).lean()) || null;
    booking.organizerProfile = (await Profile.findOne({ userId: booking.organizerId || booking.userId }).lean()) || null;

    return res.json({ success: true, booking });
  } catch (err) {
    console.error('GET /api/bookings/:id error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/bookings/artist/:artistId - secure endpoint for an artist to view their bookings
router.get('/artist/:artistId', auth.ensureAuth, async (req, res) => {
  try {
    const { artistId } = req.params;
    if (!artistId) return res.status(400).json({ success: false, message: 'Invalid artist id' });

    // Caller must be authenticated
    const callerId = req.userId || (req.user && String(req.user._id));
    if (!callerId) return res.status(401).json({ success: false, message: 'Authentication required' });

    // Only allow the artist themselves to view their bookings:
    // Accept either userId or profile._id: if callerId matches artistId OR caller's profile id, allow.
    // (This lets artist visit via profile._id or userId.)
    // Try to resolve the artistId to profile.userId so we can compare
    let resolvedProfile = null;
    try {
      resolvedProfile = await Profile.findOne({
        $or: [
          { userId: artistId },
          { _id: mongoose.Types.ObjectId.isValid(artistId) ? artistId : null }
        ].filter(Boolean)
      }).lean();
    } catch (e) {
      // ignore
    }

    const profileUserId = resolvedProfile ? String(resolvedProfile.userId) : null;
    const profileIdStr = resolvedProfile ? String(resolvedProfile._id) : null;

    // Allow if callerId equals the userId or the profile id
    if (String(callerId) !== String(artistId) && String(callerId) !== String(profileUserId) && String(callerId) !== String(profileIdStr)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these bookings' });
    }

    // Build a filter that matches bookings stored with either form
    const filter = await buildArtistFilter(artistId);
    if (!filter) return res.status(400).json({ success: false, message: 'Invalid artist id' });

    const bookings = await Booking.find(filter).sort({ createdAt: -1 }).lean();

    // Attach organizer profiles for UI convenience
    const organizerIds = [...new Set(bookings.map(b => String(b.organizerId)).filter(Boolean))];
    let organizers = {};
    if (organizerIds.length) {
      const User = require('../models/User');
      const users = await User.find({ _id: { $in: organizerIds } }, { name: 1, photoUrl: 1, email: 1 }).lean();
      users.forEach(u => { organizers[String(u._id)] = u; });
    }

    const enriched = bookings.map(b => {
      return {
        ...b,
        organizerProfile: organizers[String(b.organizerId)] || null
      };
    });

    return res.json({ success: true, bookings: enriched });
  } catch (err) {
    console.error('GET /api/bookings/artist/:artistId error', err && (err.stack || err.message));
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;