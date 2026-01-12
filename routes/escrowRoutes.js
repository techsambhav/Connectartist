// routes/escrowRoutes.js — create booking/order + webhook + organizer routes
const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const bookingFilesController = require('../controllers/bookingFilesController');
const { ensureAuth, optionalAuth, requireSessionRole } = require('../middleware/auth');
const expressLib = require('express');

// create-order: allow both authenticated organizers and guest bookings.
// The controller will read `req.userId` when a token is present, otherwise it will accept organizer info from the request body.
router.post('/bookings/artist/:artistId/create-order', optionalAuth, paymentsController.createBookingFromArtistAndOrder);
// Alias: accept userId as param
router.post('/bookings/user/:userId/create-order', optionalAuth, paymentsController.createBookingFromArtistAndOrder);

// Razorpay webhook (public endpoint) - use raw body parsing to preserve signature bytes
router.post('/webhook', expressLib.raw({ type: 'application/json' }), (req, res) => {
	// Ensure controller uses req.rawBody or req.body buffer as needed
	// If controller expects string rawBody, set it here
	req.rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
	return paymentsController.handleRazorpayWebhook(req, res);
});

// mark success
router.post('/bookings/:bookingId/mark-success', ensureAuth, paymentsController.markBookingSuccess);

// organizer bookings for dashboard
router.get('/organizer/bookings', ensureAuth, requireSessionRole('organizer'), paymentsController.getOrganizerBookings);

// Fetch a booking (debug)
router.get('/bookings/:id', paymentsController.getBooking);

// Serve generated PDFs for booking when requested (works without GCS)
router.get('/bookings/:id/files/:which', ensureAuth, bookingFilesController.serveBookingFile);

module.exports = router;
