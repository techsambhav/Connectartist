const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ensureAuth, requireSessionRole } = require('../middleware/auth');

const Booking = require('../models/Booking');
const Profile = require('../models/Profile');

// GET /api/artist/bookings
// Returns { success: true, bookings: [...] } - mirrors organizer approach exactly
router.get('/bookings', ensureAuth, requireSessionRole('artist'), async (req, res) => {
  try {
    const artistId = req.userId ? String(req.userId) : null;
    if (!artistId) {
      console.warn('artistRoutes: no artistId after auth');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Defensive: cast to ObjectId when possible so mongoose can match stored ObjectIds
    let query = {};
    if (mongoose.Types.ObjectId.isValid(artistId)) query.artistId = new mongoose.Types.ObjectId(artistId);
    else query.artistId = artistId;
    
    let bookings = [];
    try {
      bookings = await Booking.find(query)
        .sort({ createdAt: -1 })
        .lean();
    } catch (dbErr) {
      console.error('artistRoutes: Booking.find failed', dbErr && dbErr.stack ? dbErr.stack : dbErr);
      return res.status(500).json({ success: false, message: 'DB error fetching bookings' });
    }

    // Debug: log how many bookings found and their ids
    try {
      const ids = (bookings || []).map(b => String(b._id)).slice(0,50);
      console.log('artistRoutes: found bookings count=', Array.isArray(bookings) ? bookings.length : 0, 'for artistId=', artistId, 'bookingIds=', ids.join(','));
    } catch (e) { console.log('artistRoutes: found bookings count=', Array.isArray(bookings) ? bookings.length : 0, 'for artistId=', artistId); }

    // try to attach organizer profiles in a single query for better UI
    const organizerIds = bookings
      .map(b => b.organizerId || b.userId)
      .filter(Boolean)
      .map(id => (typeof id === 'object' && id._id ? id._id : id));

    let profileMap = {};
    if (organizerIds.length > 0) {
      try {
        const profiles = await Profile.find({ _id: { $in: organizerIds } }).lean();
        profiles.forEach(p => { profileMap[String(p._id)] = p; });
      } catch (e) {
        console.warn('artistRoutes: Profile.find error', e && e.stack ? e.stack : e);
        profileMap = {};
      }
    }

    let normalized = [];
    try {
      normalized = bookings.map(b => {
        const id = b._id || b.id;
        const organizerId = b.organizerId || b.userId;
        const organizerIdStr = organizerId && (organizerId._id ? String(organizerId._id) : String(organizerId));
        const organizerProfile = profileMap[organizerIdStr] || null;

        return Object.assign({
          _id: id,
          artistId: b.artistId,
          organizerId: organizerIdStr,
          organizerProfile,
          organizerName: b.organizerName || (organizerProfile && (organizerProfile.displayName || organizerProfile.name)) || null,
          price: b.price || b.amount || b.fee || null,
          eventDate: b.eventDate || b.eventOn || null,
          eventTime: b.eventTime || b.startTime || null,
          eventLocation: b.eventLocation || b.venue || null,
          status: b.status || 'pending',
          files: b.files || {}
        }, b);
      });
    } catch (mapErr) {
      console.error('artistRoutes: error normalizing bookings', mapErr && mapErr.stack ? mapErr.stack : mapErr);
      return res.status(500).json({ success: false, message: 'Server error processing bookings' });
    }

    return res.json({ success: true, bookings: normalized });
  } catch (err) {
    console.error('artistRoutes: error fetching bookings', err && err.message);
    return res.status(500).json({ success: false, message: 'Server error fetching bookings' });
  }
});

module.exports = router;