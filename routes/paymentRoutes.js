// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Models - adjust paths if your project differs
const Booking = require('../models/Booking');
const Profile = require('../models/Profile');
const User = require('../models/User'); // optional

// paymentsController handles booking/order creation and webhook logic
let paymentsController = null;
try {
	paymentsController = require('../controllers/paymentsController');
} catch (e) {
	// If paymentsController is not present or failed to load, keep routes that don't depend on it
	console.warn('paymentsController not loaded in routes/paymentRoutes.js:', e && e.message);
}

// Simple optional auth - sets req.userId when valid JWT provided
function authOptional(req, res, next) {
	const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
	const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : (req.body && req.body.token) || null;
	if (!token) return next();
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.userId = decoded.userId || decoded.id || null;
	} catch (e) {
		req.userId = null;
	}
	return next();
}

// Helper: create razorpay instance
function getRazorpay() {
	return new Razorpay({
		key_id: process.env.RAZORPAY_KEY_ID,
		key_secret: process.env.RAZORPAY_KEY_SECRET
	});
}

// POST /api/payments/success
router.post('/success', paymentController.paymentSuccessHandler);

// Create booking + order endpoints (optional; also available under /api/escrow)
if (paymentsController) {
	router.post('/bookings/artist/:artistId/create-order', paymentsController.createBookingFromArtistAndOrder);
	router.post('/bookings/user/:userId/create-order', paymentsController.createBookingFromArtistAndOrder);
	router.get('/bookings/:id', paymentsController.getBooking);
}

// POST /api/payments/bookings/:bookingId/verify
// Verify Razorpay payment signature sent from client after checkout and update booking
router.post('/bookings/:bookingId/verify', authOptional, async (req, res) => {
	try {
		const { bookingId } = req.params;
		const { razorpay_payment_id, razorpay_order_id, razorpay_signature, method, amount } = req.body;

		if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
			return res.status(400).json({ success: false, message: 'Missing payment fields' });
		}

		const secret = process.env.RAZORPAY_KEY_SECRET || '';
		const generatedSig = crypto.createHmac('sha256', secret)
			.update(`${razorpay_order_id}|${razorpay_payment_id}`)
			.digest('hex');

		if (generatedSig !== razorpay_signature) {
			return res.status(400).json({ success: false, message: 'Invalid signature' });
		}

		const booking = await Booking.findById(bookingId);
		if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

		// Mirror webhook behavior: set razorpay/payment fields and mark as captured/confirmed
		booking.razorpay = booking.razorpay || {};
		booking.razorpay.paymentId = razorpay_payment_id;
		booking.paymentStatus = 'captured';
		booking.status = 'confirmed';
		booking.payment = {
			id: razorpay_payment_id,
			orderId: razorpay_order_id,
			signature: razorpay_signature,
			method: method || 'razorpay',
			amountReceived: amount || booking.amount,
			paidAt: new Date()
		};
		await booking.save();

		// Persist a PaymentTransaction (idempotent if duplicates detected)
		try {
			const PaymentTransaction = require('../models/PaymentTransaction');
			await PaymentTransaction.create({
				paymentId: razorpay_payment_id,
				orderId: razorpay_order_id,
				bookingId: booking._id,
				amount: amount || booking.amount,
				currency: 'INR',
				status: 'captured',
				rawGatewayPayload: req.body
			});
		} catch (e) {
			if (!(e && e.code === 11000)) console.warn('PaymentTransaction create failed', e && e.message);
		}

		// Trigger PDF generation & notifications (in case webhook didn't run or webhook processing is delayed)
		try {
			const notifyService = require('../services/notifyService');
			notifyService.generatePdfsAndNotify(booking).catch(err => console.warn('notifyService.generatePdfsAndNotify error', err));
		} catch (e) { console.warn('Could not invoke notifyService from verify route', e && e.message); }

		console.log('Payment verification processed for booking', bookingId, 'order', razorpay_order_id);
		return res.json({ success: true, message: 'Payment verified', booking });
	} catch (err) {
		console.error('verify payment error', err);
		return res.status(500).json({ success: false, message: 'Server error verifying payment' });
	}
});

// GET /api/payments/bookings/:bookingId
// Fetch booking details (only add if paymentsController.getBooking not available)
if (!paymentsController) {
	router.get('/bookings/:bookingId', authOptional, async (req, res) => {
		try {
			const { bookingId } = req.params;
			const booking = await Booking.findById(bookingId).lean();
			if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
			return res.json({ success: true, booking });
		} catch (err) {
			console.error('fetch booking error', err);
			return res.status(500).json({ success: false, message: 'Server error' });
		}
	});
}

module.exports = router;
