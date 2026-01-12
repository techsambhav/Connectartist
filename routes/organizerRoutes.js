const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ensureAuth, requireSessionRole } = require('../middleware/auth');

const Booking = require('../models/Booking');
const Profile = require('../models/Profile'); // if you keep profile docs

// GET /api/organizer/bookings
// Returns { success: true, bookings: [...] }
router.get('/bookings', ensureAuth, requireSessionRole('organizer'), async (req, res) => {
  try {
    const organizerId = req.userId ? String(req.userId) : null;
    if (!organizerId) {
      console.warn('organizerRoutes: no organizerId after auth');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Defensive: cast to ObjectId when possible so mongoose can match stored ObjectIds
    let query = {};
  if (mongoose.Types.ObjectId.isValid(organizerId)) query.organizerId = new mongoose.Types.ObjectId(organizerId);
    else query.organizerId = organizerId;
    let bookings = [];
    try {
      bookings = await Booking.find(query)
        .sort({ createdAt: -1 })
        .lean();
    } catch (dbErr) {
      console.error('organizerRoutes: Booking.find failed', dbErr && dbErr.stack ? dbErr.stack : dbErr);
      return res.status(500).json({ success: false, message: 'DB error fetching bookings' });
    }

    // Debug: log how many bookings found and their ids
    try {
      const ids = (bookings || []).map(b => String(b._id)).slice(0,50);
      console.log('organizerRoutes: found bookings count=', Array.isArray(bookings) ? bookings.length : 0, 'for organizerId=', organizerId, 'bookingIds=', ids.join(','));
    } catch (e) { console.log('organizerRoutes: found bookings count=', Array.isArray(bookings) ? bookings.length : 0, 'for organizerId=', organizerId); }

    // try to attach artist profiles in a single query for better UI
    const artistIds = bookings
      .map(b => b.artistId)
      .filter(Boolean)
      .map(id => (typeof id === 'object' && id._id ? id._id : id));

    let profileMap = {};
    if (artistIds.length > 0) {
      try {
        const profiles = await Profile.find({ _id: { $in: artistIds } }).lean();
        profiles.forEach(p => { profileMap[String(p._id)] = p; });
      } catch (e) {
        console.warn('organizerRoutes: Profile.find error', e && e.stack ? e.stack : e);
        profileMap = {};
      }
    }

    let normalized = [];
    try {
      normalized = bookings.map(b => {
      const id = b._id || b.id;
      const artistId = b.artistId && (b.artistId._id ? String(b.artistId._id) : String(b.artistId));
      const artistProfile = profileMap[artistId] || null;

      return Object.assign({
        _id: id,
        organizerId: b.organizerId,
        artistId,
        artistProfile,
        artistName: b.artistName || (artistProfile && (artistProfile.displayName || artistProfile.name)) || null,
        price: b.price || b.amount || b.fee || null,
        eventDate: b.eventDate || b.eventOn || null,
        eventTime: b.eventTime || b.startTime || null,
        eventLocation: b.eventLocation || b.venue || null,
        status: b.status || 'pending',
        files: b.files || {}
      }, b);
      });
    } catch (mapErr) {
      console.error('organizerRoutes: error normalizing bookings', mapErr && mapErr.stack ? mapErr.stack : mapErr);
      // Send partial failure information to client for easier debugging
      return res.status(500).json({ success: false, message: 'Server error processing bookings' });
    }

    return res.json({ success: true, bookings: normalized });
  } catch (err) {
    console.error('organizerRoutes: error fetching bookings', err && err.message);
    return res.status(500).json({ success: false, message: 'Server error fetching bookings' });
  }
});

module.exports = router;
