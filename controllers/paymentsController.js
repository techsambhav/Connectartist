// controllers/paymentsController.js
// Single consolidated payments + booking controller
// Requires: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
// SMTP_* for nodemailer (optional), GUPSHUP_* for WhatsApp/SMS (optional)

const Razorpay = require('razorpay');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const PaymentTransaction = require('../models/PaymentTransaction');
const Profile = require('../models/Profile'); // artist profile fallback
const User = require('../models/User');
const notifyService = require('../services/notifyService');
const pdfGenerator = require('../services/pdfGenerator');

function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID || '';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!key_id || !key_secret) {
    // Return null when keys are not configured so callers can respond gracefully
    return null;
  }
  return new Razorpay({ key_id, key_secret });
}

function toPaise(rupees) {
  const n = Number(rupees);
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function getArtistPriceRupees(artistDoc) {
  if (!artistDoc) return null;
  // try common fields used in your project
  const candidates = [
    artistDoc.price, artistDoc.bookingPrice, artistDoc.gigPrice, artistDoc.basePrice,
    artistDoc?.profile?.price, artistDoc?.profile?.bookingPrice
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== '') {
      const val = Number(String(c).replace(/[^0-9.]/g, ''));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

// CREATE booking + order: /api/escrow/bookings/artist/:artistId/create-order
async function createBookingFromArtistAndOrder(req, res) {
  try {
    // Diagnostic logs for debugging create-order failures
    try {
      const info = { url: req.originalUrl, method: req.method, tokenPresent: !!(req.headers && (req.headers.authorization || req.cookies && req.cookies.token)), bodyPreview: Object.assign({}, req.body, { notes: req.body && req.body.notes ? '[trimmed]' : undefined }), razorpayKeyIdPresent: !!process.env.RAZORPAY_KEY_ID, razorpayKeySecretPresent: !!process.env.RAZORPAY_KEY_SECRET };
      console.log('[create-order] incoming request', info);
      try {
        const logDir = require('path').join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logFile = require('path').join(logDir, 'create_order_debug.log');
        fs.appendFileSync(logFile, new Date().toISOString() + ' ' + JSON.stringify(info) + '\n');
      } catch (e) { /* ignore file logging errors */ }
    } catch (e) { /* ignore logging errors */ }
    const artistId = req.params.artistId || req.params.userId || req.body.artistId;
    if (!artistId) return res.status(400).json({ success: false, message: 'artistId required' });
    if (!mongoose.Types.ObjectId.isValid(artistId)) return res.status(400).json({ success: false, message: 'Invalid artistId' });

    // get organizer id from middleware set values (robustly). If missing, allow guest bookings
    const organizerId = req.userId || (req.user && req.user._id) || null;

    // fetch organizer & artist profile (organizer may be null for guest bookings)
    const [organizer, artistProfile] = await Promise.all([
      organizerId ? User.findById(organizerId).lean() : Promise.resolve(null),
      (async () => {
        let p = null;
        if (mongoose.Types.ObjectId.isValid(artistId)) {
          p = await Profile.findOne({ $or: [{ userId: artistId }, { _id: artistId }] }).lean();
        }
        return p;
      })()
    ]);

    // Enhanced self-booking prevention: handle both profile._id and userId patterns
    if (organizerId) {
      // Check direct ID match first
      if (String(organizerId) === String(artistId)) {
        return res.status(400).json({ success: false, message: 'You cannot book yourself' });
      }

      // Check against artist profile if found
      if (artistProfile) {
        const artistUserId = String(artistProfile.userId || '');
        const artistProfileId = String(artistProfile._id || '');

        if ((artistUserId && String(organizerId) === artistUserId) ||
            (artistProfileId && String(organizerId) === artistProfileId)) {
          return res.status(400).json({ success: false, message: 'You cannot book yourself' });
        }
      }
    }

    // If organizer isn't found (guest flow), we'll accept organizer info from the request body (organizerName/organizerEmail/organizerPhone)
    if (!organizer && !req.body.organizerName && !req.body.organizerEmail) {
      // still allow a guest booking but require at least a contact phone or email
      // Fall back to a looser check: organizerPhone in body
      if (!req.body.organizerPhone) {
        return res.status(400).json({ success: false, message: 'Organizer contact required for guest bookings' });
      }
    }

    if (!artistProfile) {
      // artist profile missing is not fatal if a User exists, but prefer artist profile for price.
      // try fallback to User
      const aUser = await User.findById(artistId).lean();
      if (!aUser) return res.status(404).json({ success: false, message: 'Artist/profile not found' });
    }

    // Determine price: prefer artist/profile documented price, then fallback to body.price
    let price = null;
    // try profile first
    if (artistProfile) price = getArtistPriceRupees(artistProfile);
    // fallback to user doc if profile missing
    if ((!price || price <= 0) && !artistProfile) {
      const aUser = await User.findById(artistId).lean();
      if (aUser) price = getArtistPriceRupees(aUser);
    }
    // finally fallback to explicit price from the request body
    if ((!price || price <= 0) && req.body && req.body.price) {
      const parsed = Number(String(req.body.price).replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(parsed) && parsed > 0) price = parsed;
    }

    if (!price || Number.isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, message: 'Artist price unavailable. Contact artist or admin.' });
    }

    // build booking
    const booking = new Booking({
      artistId: new mongoose.Types.ObjectId(artistId),
      // set organizerId only when we have a valid organizer user
  organizerId: organizer ? new mongoose.Types.ObjectId(organizer._id) : undefined,
      artistName: (artistProfile && (artistProfile.displayName || artistProfile.name)) || '',
      artistEmail: (artistProfile && artistProfile.email) || '',
      artistPhone: (artistProfile && artistProfile.phone) || '',
      organizerName: organizer ? (organizer.name || '') : (req.body.organizerName || ''),
      organizerEmail: organizer ? (organizer.email || '') : (req.body.organizerEmail || ''),
      organizerPhone: req.body.organizerPhone || (organizer ? organizer.phone || '' : ''),
      eventDate: req.body.eventDate ? new Date(req.body.eventDate) : undefined,
      startTime: req.body.eventTime || '',
      venue: req.body.eventLocation || '',
      notes: req.body.notes || req.body.additionalRequirements || '',
      price: price,
      paymentStatus: 'created',
      status: 'pending'
    });

    await booking.save();
  console.log('Booking created', { bookingId: booking._id, organizerId: organizerId, artistId, price });

    // Create Razorpay order (if configured). In dev or missing-config, persist booking and return success so UX continues.
    const rp = getRazorpayInstance();
    if (!rp) {
      console.warn('Razorpay not configured; returning booking success without payment order (dev mode)');
      // Return booking success but indicate payment gateway missing so client can handle accordingly
      return res.json({ success: true, order: null, bookingId: booking._id, fixedPriceRupees: price, paymentGatewayConfigured: false });
    }

    let order;
    try {
      order = await rp.orders.create({
        amount: Math.round(price * 100), // paise
        currency: 'INR',
        receipt: `booking_${booking._id}`,
        notes: { bookingId: String(booking._id), organizerId: organizer ? String(organizer._id) : (req.body.organizerId || ''), artistId: String(artistId) }
      });
    } catch (e) {
      console.error('Razorpay order creation failed', { err: e && e.message, bookingId: booking._id });
      // keep booking in DB for manual inspection and return a safe error to client
      return res.status(500).json({ success: false, message: 'Payment gateway error creating order' });
    }

    booking.razorpay = booking.razorpay || {};
    booking.razorpay.orderId = order.id;
    booking.paymentStatus = 'order_created';
    await booking.save();
    console.log('Razorpay order created for booking', { bookingId: booking._id, orderId: order.id });

    return res.json({ success: true, order, bookingId: booking._id, fixedPriceRupees: price, paymentGatewayConfigured: true });
  } catch (err) {
    console.error('createBookingFromArtistAndOrder error', err);
    try {
      const p = require('path').join(__dirname, '..', 'logs');
      const fsLocal = require('fs');
      if (!fsLocal.existsSync(p)) fsLocal.mkdirSync(p, { recursive: true });
      const file = require('path').join(p, 'create_order_error.log');
      const payload = { ts: new Date().toISOString(), url: req.originalUrl, body: req.body, err: (err && err.stack) ? err.stack : String(err) };
      fsLocal.appendFileSync(file, JSON.stringify(payload) + '\n');
    } catch (e) { console.error('Failed to write create_order_error.log', e); }
    return res.status(500).json({ success: false, message: 'Server error creating booking' });
  }
}

// webhook handler: must be mounted as express.raw({type:'application/json'}) so raw body preserved
async function webhookHandler(req, res) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'];

    // raw body must be used exactly as received for signature
    const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body || {}));
    if (!webhookSecret || !signature) {
      console.warn('Webhook secret or signature missing');
      return res.status(400).send('Webhook misconfigured');
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (expected !== signature) {
      console.warn('Invalid webhook signature', { expected, signature });
      return res.status(400).send('Invalid signature');
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;

    // Payment captured
    if (event === 'payment.captured' && payment) {
      const orderId = payment.order_id;
      const booking = await Booking.findOne({ 'razorpay.orderId': orderId });
      if (booking) {
        booking.razorpay = booking.razorpay || {};
        booking.razorpay.paymentId = payment.id;
        booking.paymentStatus = 'captured';
        booking.status = 'confirmed';
        await booking.save();

        try {
          await PaymentTransaction.create({
            paymentId: payment.id,
            orderId: orderId,
            bookingId: booking._id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            rawGatewayPayload: payment
          });
        } catch (err) {
          if (err && err.code === 11000) {
            // duplicate paymentId -> idempotent: already processed
            console.warn('PaymentTransaction duplicate, skipping insert', payment.id);
          } else {
            throw err;
          }
        }

        // notify organizer + artist (email / whatsapp / sms)
        notifyService.generatePdfsAndNotify(booking).catch(err => console.warn('generatePdfsAndNotify error', err));
      }
    }

    // Payment failed
    if (event === 'payment.failed' && payment) {
      const booking = payment.order_id ? await Booking.findOne({ 'razorpay.orderId': payment.order_id }) : null;
      if (booking) {
        booking.paymentStatus = 'failed';
        booking.status = 'pending';
        await booking.save();
        try {
          await PaymentTransaction.create({
            paymentId: payment.id || null,
            orderId: payment.order_id || null,
            bookingId: booking._id,
            amount: payment.amount || (booking.price ? toPaise(booking.price) : null),
            currency: payment.currency || 'INR',
            status: 'failed',
            rawGatewayPayload: payment
          });
        } catch (err) {
          if (err && err.code === 11000) {
            console.warn('PaymentTransaction duplicate (failed), skipping insert', payment.id);
          } else {
            throw err;
          }
        }
      }
    }

    // other events - ignore for now
    return res.json({ success: true });
  } catch (err) {
    console.error('webhookHandler error', err && (err.stack || err));
    try {
      const p = require('path').join(__dirname, '..', 'logs');
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      const file = require('path').join(p, 'webhook_error.log');
      fs.appendFileSync(file, new Date().toISOString() + ' ' + (err && err.stack ? err.stack : String(err)) + '\n');
    } catch (e) {
      console.error('Failed to write webhook_error.log', e && e.message);
    }
    return res.status(500).send('webhook handler error');
  }
}

// Helper: find Profile by profile._id or profile.userId
async function findProfileByIdOrUserId(id) {
  if (!id) return null;
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { $or: [{ userId: id }, { _id: id }] } : { userId: id };
    return await Profile.findOne(query).lean();
  } catch (err) {
    console.error('findProfileByIdOrUserId error', err);
    return null;
  }
}

// GET booking details
async function getBooking(req, res) {
  try {
    const id = (req.params && (req.params.id || req.params.bookingId)) || (req.query && req.query.id);
    if (!id) return res.status(400).json({ success: false, message: 'booking id required' });
    const booking = await Booking.findById(id).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const profile = await findProfileByIdOrUserId(booking.artistId);
    booking.artistProfile = profile || null;
    return res.json({ success: true, booking });
  } catch (err) {
    console.error('getBooking error', err);
    return res.status(500).json({ success: false, message: 'Server error fetching booking' });
  }
}

// Serve booking file (pdf) or other assets
async function serveBookingFile(req, res) {
  try {
    const id = req.params.id || req.params.bookingId;
    const which = req.params.which || req.query.which || 'pdf';
    if (!id) return res.status(400).send('booking id required');
    // Always write a compact request entry to logs so we can trace requests even if console isn't captured
    try {
      const logDir = require('path').join(__dirname, '..', 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logFile = require('path').join(logDir, 'serve_booking_requests.log');
      const entry = {
        t: new Date().toISOString(),
        id: id,
        which: which,
        userId: req.userId || (req.user && req.user._id) || null,
        ua: (req.headers && req.headers['user-agent']) ? String(req.headers['user-agent']).slice(0,120) : undefined
      };
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch (e) { /* ignore logging failures */ }
    // Diagnostic console log (in case someone watches stdout)
    try { console.log('serveBookingFile: request', { id, which, userId: req.userId || (req.user && req.user._id) || null }); } catch (e) {}

    // Try multiple lookup strategies so we don't return 404 unnecessarily
    let booking = null;
    const tried = [];
    try {
      // 1) direct findById (works when id is a proper ObjectId string)
      tried.push({ method: 'findById', query: id });
      booking = await Booking.findById(id).lean();
    } catch (e) {
      // ignore
    }
    if (!booking) {
      try {
        // 2) _id exact match (some records may store string ids)
        tried.push({ method: 'findOne:_id', query: id });
        booking = await Booking.findOne({ _id: id }).lean();
      } catch (e) {
        // ignore
      }
    }
    if (!booking) {
      try {
        // 3) match by razorpay.orderId if id seems like an order id
        tried.push({ method: 'findOne:razorpay.orderId', query: id });
        booking = await Booking.findOne({ 'razorpay.orderId': id }).lean();
      } catch (e) { }
    }
    if (!booking) {
      try {
        // 4) sometimes booking id passed as query param or contains prefixes - try substring match (last 12-24 chars)
        const sub = String(id).slice(-24);
        tried.push({ method: 'findOne:endsWith', query: sub });
        booking = await Booking.findOne({ _id: sub }).lean();
      } catch (e) { }
    }

    if (!booking) {
      console.warn('serveBookingFile: booking lookup failed for id', id, 'tried:', tried);
      try {
        const logDir = require('path').join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logFile = require('path').join(logDir, 'serve_booking.log');
        const entry = { t: new Date().toISOString(), id, which, userId: req.userId || (req.user && req.user._id) || null, tried };
        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
      } catch (e) { /* ignore logging errors */ }
      return res.status(404).send('Booking not found');
    }
    // Support multiple friendly file names used across the frontend
    const fileKey = String(which || '').toLowerCase();
    if (fileKey === 'pdf' || fileKey === 'booking_org' || fileKey === 'booking' || fileKey === 'booking_org.pdf' || fileKey === 'booking.pdf' || fileKey === 'receipt') {
      // booking confirmation / receipt — generate a booking PDF
      const buf = await makeBookingPdfBuffer(booking);
      res.setHeader('Content-Type', 'application/pdf');
      // use 'receipt' in filename when requested as receipt
      const suffix = (fileKey === 'receipt') ? 'receipt' : 'booking';
      res.setHeader('Content-Disposition', `attachment; filename=${suffix}-${booking._id}.pdf`);
      return res.send(buf);
    }

    if (fileKey === 'booking_artist' || fileKey === 'artist_contact' || fileKey === 'contact') {
      // generate a small contact PDF for the artist
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const bufs = [];
        doc.on('data', d => bufs.push(d));
        doc.on('end', () => {
          const out = Buffer.concat(bufs);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=artist-contact-${booking._id}.pdf`);
          return res.send(out);
        });
        doc.fontSize(16).text('Artist Contact', { align: 'center' }).moveDown();
        doc.fontSize(12).text(`Artist: ${booking.artistName || ''}`);
        if (booking.artistEmail) doc.text(`Email: ${booking.artistEmail}`);
        if (booking.artistPhone) doc.text(`Phone: ${booking.artistPhone}`);
        if (booking.notes) {
          doc.moveDown();
          doc.text('Notes:');
          doc.text(booking.notes);
        }
        doc.end();
      } catch (e) {
        console.error('serveBookingFile (artist contact) error', e);
        return res.status(500).send('error generating contact file');
      }
    }

    // Fallback: if booking.files contains an absolute URL for requested file, try to proxy it server-side
    const files = booking.files || {};
    const candidateUrl = files.bookingOrgUrl || files.receiptUrl || files.bookingArtistUrl || null;
    if (candidateUrl) {
      try {
        console.log('serveBookingFile: proxying remote file for booking', booking._id);
        const remoteRes = await axios.get(candidateUrl, { responseType: 'arraybuffer', timeout: 20000 });
        const contentType = remoteRes.headers['content-type'] || 'application/octet-stream';
        const cd = remoteRes.headers['content-disposition'] || '';
        res.setHeader('Content-Type', contentType);
        if (cd) res.setHeader('Content-Disposition', cd);
        return res.send(Buffer.from(remoteRes.data));
      } catch (e) {
        console.warn('serveBookingFile: proxy remote file failed', e && e.message);
        // fall through to 404
      }
    }

    return res.status(404).send('file not found');
  } catch (err) {
    console.error('serveBookingFile error', err);
    return res.status(500).send('error');
  }
}

// Mark booking success (manual/alternate flow)
async function markBookingSuccess(req, res) {
  try {
    const bookingId = req.params.bookingId || req.body.bookingId || req.params.id;
    if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId required' });
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    booking.paymentStatus = 'captured';
    booking.status = 'confirmed';
    if (req.body && req.body.paymentId) booking.razorpay = booking.razorpay || {}, booking.razorpay.paymentId = req.body.paymentId;
    await booking.save();
    return res.json({ success: true, booking });
  } catch (err) {
    console.error('markBookingSuccess error', err);
    return res.status(500).json({ success: false, message: 'server error' });
  }
}

// Get bookings for an organizer (simple list)
async function getOrganizerBookings(req, res) {
  try {
    const organizerId = req.userId || (req.user && req.user._id) || req.query.organizerId || req.query.userId;
    if (!organizerId) return res.status(400).json({ success: false, message: 'organizer id required' });
    const q = { $or: [{ organizerId: organizerId }, { userId: organizerId }] };
    const bookings = await Booking.find(q).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, bookings });
  } catch (err) {
    console.error('getOrganizerBookings error', err);
    return res.status(500).json({ success: false, message: 'server error' });
  }
}

// make a small booking confirmation PDF buffer (simple layout)
function makeBookingPdfBuffer(booking, opts = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const bufs = [];
      doc.on('data', d => bufs.push(d));
      doc.on('end', () => resolve(Buffer.concat(bufs)));

      doc.fontSize(18).text('ConnectArtist — Booking Confirmation', { align: 'center' }).moveDown();
      doc.fontSize(12).text(`Booking ID: ${booking._id}`);
      doc.text(`Artist ID: ${booking.artistId}`);
      doc.text(`Organizer ID: ${booking.organizerId || booking.userId || ''}`);
  doc.text(`Event Date: ${booking.eventDate}`);
  const eventTimeVal = booking.eventTime || booking.startTime || '';
  if (eventTimeVal) doc.text(`Event Time: ${eventTimeVal}`);
  const venueVal = booking.eventLocation || booking.venue || '';
  doc.text(`Venue: ${venueVal}`);
      doc.moveDown();
  const displayAmount = booking.price ? `INR ${booking.price}` : (booking.amount ? `paise ${booking.amount}` : 'N/A');
  doc.text(`Amount: ${displayAmount}`);
      if (booking.notes) {
        doc.moveDown();
        doc.text('Notes:');
        doc.text(booking.notes);
      }
      doc.moveDown();
      doc.text('Thank you for using ConnectArtist.', { align: 'center' });
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// notifications moved to services/notifyService

// Download booking confirmation PDF (for client/organizer)
async function sendBookingConfirmationPdf(req, res) {
  try {
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).send('Booking not found');
    const buf = await makeBookingPdfBuffer(booking);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=booking-${booking._id}.pdf`);
    return res.send(buf);
  } catch (err) {
    console.error('sendBookingConfirmationPdf error', err);
    return res.status(500).send('Error generating PDF');
  }
}

module.exports = {
  createBookingFromArtistAndOrder,
  // compatibility aliases requested by routes
  createOrderForArtist: createBookingFromArtistAndOrder,
  webhookHandler,
  handleRazorpayWebhook: webhookHandler,
  getBooking,
  sendBookingConfirmationPdf,
  serveBookingFile,
  markBookingSuccess,
  getOrganizerBookings
};
