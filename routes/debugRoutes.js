const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Profile = require('../models/Profile');
const pdfGen = require('../services/pdfGenerator');

// POST /api/debug/create-and-complete
// Body: { artistId, price, eventDate, eventTime, eventLocation, organizerPhone, organizerName, organizerEmail }
router.post('/create-and-complete', async (req, res) => {
  try {
    const { artistId, price, eventDate, eventTime, eventLocation, organizerPhone, organizerName, organizerEmail } = req.body;
    if (!artistId || !mongoose.Types.ObjectId.isValid(artistId)) return res.status(400).json({ success: false, message: 'artistId required and must be ObjectId' });
    const numericPrice = Number(String(price || '').replace(/[^0-9.]/g, ''));
    if (!numericPrice || Number.isNaN(numericPrice) || numericPrice <= 0) return res.status(400).json({ success: false, message: 'price required' });

    const booking = new Booking({
      artistId: new mongoose.Types.ObjectId(artistId),
      organizerName: organizerName || 'Debug Organizer',
      organizerEmail: organizerEmail || '',
      organizerPhone: organizerPhone || '',
      eventDate: eventDate ? new Date(eventDate) : undefined,
      startTime: eventTime || '',
      venue: eventLocation || '',
      notes: 'Debug create-and-complete',
      price: numericPrice,
      paymentStatus: 'captured',
      status: 'confirmed'
    });

    await booking.save();

    // simulate payment id
    booking.razorpay = booking.razorpay || {};
    booking.razorpay.paymentId = 'DEBUG_SIM_' + Date.now();
    await booking.save();

    // run notifyService to generate PDFs and set booking.files
    try {
      const notifyService = require('../services/notifyService');
      await notifyService.generatePdfsAndNotify(booking);
    } catch (e) {
      console.warn('Debug notifyService error', e && e.message);
    }

    const fresh = await Booking.findById(booking._id).lean();
    return res.json({ success: true, booking: fresh });
  } catch (err) {
    console.error('debug create-and-complete error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/debug/bookings/:id/files/:which  (which = booking_org|receipt|booking_artist)
router.get('/bookings/:id/files/:which', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).send('Booking not found');
    const which = req.params.which;
    const allowed = ['booking_org', 'receipt', 'booking_artist'];
    if (!allowed.includes(which)) return res.status(400).send('Invalid file');
    const data = {
      bookingId: booking._id.toString(),
      artistName: booking.artistName || '',
      organizerName: booking.organizerName || '',
      eventDate: booking.eventDate || '',
      startTime: booking.startTime || '',
      venue: booking.venue || '',
      notes: booking.notes || '',
      amountRupees: booking.price || '',
      artistPhone: booking.artistPhone || '',
      artistEmail: booking.artistEmail || '',
      organizerPhone: booking.organizerPhone || '',
      organizerEmail: booking.organizerEmail || ''
    };
    const buf = await pdfGen.generatePdf(which, data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${which}-${booking._id}.pdf`);
    return res.send(buf);
  } catch (err) {
    console.error('debug serve file error', err);
    return res.status(500).send('Error generating file');
  }
});

// POST /api/debug/bookings/:id/mark-complete
router.post('/bookings/:id/mark-complete', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.payoutStatus = 'requested';
    await booking.save();
    try { const notifyService = require('../services/notifyService'); notifyService.notifyEventCompleted(booking).catch(()=>{}); } catch(e){}
    return res.json({ success: true, booking });
  } catch (err) {
    console.error('debug mark-complete error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Temporary raw booking debug endpoint
router.get('/bookings/:id/raw', async (req, res) => {
  try {
    const id = req.params.id;
    // protect in production
    if (process.env.NODE_ENV === 'production') {
      const secret = process.env.DEBUG_SECRET || '';
      const provided = req.query.secret || '';
      if (!secret || !provided || provided !== secret) return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const booking = await Booking.findById(id).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    return res.json({ success: true, booking });
  } catch (err) {
    console.error('debug raw booking error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

