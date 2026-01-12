// controllers/paymentController.js
const Booking = require('../models/Booking');
const Profile = require('../models/Profile'); // optional: if you want artist/organizer metadata
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const axios = require('axios');
const path = require('path');

// Optional: your project already has gcsUpload helper. If it exports an uploadBuffer/uploadFile method we'll use it.
// If not present, uploadToGcs will be a no-op (skip). Adjust as needed.
let uploadToGcs = null;
try {
  const gcs = require('../gcsUpload');
  if (typeof gcs.uploadBuffer === 'function') uploadToGcs = gcs.uploadBuffer;
  if (typeof gcs.uploadFile === 'function' && !uploadToGcs) uploadToGcs = gcs.uploadFile;
} catch (e) {
  uploadToGcs = null;
}

function makeReceiptPdfBuffer({ type = 'receipt', paymentInfo = {}, bookingInfo = {} }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      doc.fontSize(18).text('ConnectArtist', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text(type === 'receipt' ? 'Payment Receipt' : 'Booking Confirmation', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text(`Payment ID: ${paymentInfo.razorpay_payment_id || ''}`);
      if (paymentInfo.razorpay_order_id) doc.text(`Order ID: ${paymentInfo.razorpay_order_id}`);
      if (paymentInfo.amount) {
        const amount = Number(paymentInfo.amount) / (paymentInfo.amount_unit_multiplier || 100);
        doc.text(`Amount: ₹${amount}`);
      } else if (bookingInfo.amount) {
        doc.text(`Amount: ₹${bookingInfo.amount}`);
      }
      doc.text(`Date: ${new Date().toLocaleString()}`);
      doc.moveDown();

      doc.fontSize(13).text('Booking Details');
      doc.moveDown(0.3);
      doc.fontSize(11);
      doc.text(`Booking ID: ${bookingInfo.bookingId || ''}`);
      doc.text(`Artist: ${bookingInfo.artistName || bookingInfo.artistId || ''}`);
      doc.text(`Organizer: ${bookingInfo.organizerName || bookingInfo.userId || ''}`);
      if (bookingInfo.eventDate) doc.text(`Event Date: ${bookingInfo.eventDate}`);
      if (bookingInfo.eventTime) doc.text(`Event Time: ${bookingInfo.eventTime}`);
      if (bookingInfo.eventLocation) doc.text(`Venue: ${bookingInfo.eventLocation}`);
      if (bookingInfo.duration) doc.text(`Duration: ${bookingInfo.duration}`);
      if (bookingInfo.additionalRequirements) {
        doc.moveDown(0.2);
        doc.text('Additional Requirements:');
        doc.text(bookingInfo.additionalRequirements);
      }

      doc.moveDown(1);
      doc.text('Contact details', { underline: true });
      if (bookingInfo.organizerPhone) doc.text(`Organizer phone: ${bookingInfo.organizerPhone}`);
      if (bookingInfo.organizerEmail) doc.text(`Organizer email: ${bookingInfo.organizerEmail}`);
      if (bookingInfo.artistPhone) doc.text(`Artist phone: ${bookingInfo.artistPhone}`);
      if (bookingInfo.artistEmail) doc.text(`Artist email: ${bookingInfo.artistEmail}`);

      doc.moveDown(1.2);
      doc.fontSize(10).text('This is an auto-generated confirmation. Please keep it for your records.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function sendEmailWithAttachment(to, subject, text, buffer, filename) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE === 'true'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || `"ConnectArtist" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    attachments: [
      {
        filename,
        content: buffer
      }
    ]
  });

  return info;
}

async function sendGupshupWhatsApp(phoneWithCountryCode, messageText) {
  if (!process.env.GUPSHUP_API_KEY) throw new Error('GUPSHUP_API_KEY not set');
  const payload = {
    destination: phoneWithCountryCode.replace(/\D/g, ''),
    source: process.env.GUPSHUP_APP_NAME || process.env.GUPSHUP_SENDER || 'ConnectArtist',
    message: {
      type: 'text',
      text: messageText
    },
    channel: 'whatsapp'
  };

  const url = process.env.GUPSHUP_API_URL || 'https://api.gupshup.io/sm/api/v1/msg';
  const headers = {
    'Content-Type': 'application/json',
    'apikey': process.env.GUPSHUP_API_KEY
  };

  const resp = await axios.post(url, payload, { headers });
  return resp.data;
}

async function sendGupshupSMS(phoneWithCountryCode, messageText) {
  if (!process.env.GUPSHUP_API_KEY) throw new Error('GUPSHUP_API_KEY not set');

  const payload = {
    destination: phoneWithCountryCode.replace(/\D/g, ''),
    source: process.env.GUPSHUP_SENDER || 'ConnectArtist',
    message: messageText,
    channel: 'sms'
  };
  const url = process.env.GUPSHUP_API_URL || 'https://api.gupshup.io/sm/api/v1/msg';
  const headers = {
    'Content-Type': 'application/json',
    'apikey': process.env.GUPSHUP_API_KEY
  };

  const resp = await axios.post(url, payload, { headers });
  return resp.data;
}

exports.paymentSuccessHandler = async (req, res) => {
  try {
    const { razorpay, booking } = req.body;
    if (!booking || !booking.artistId || !booking.userId) {
      return res.status(400).json({ success: false, message: 'Missing booking payload (artistId & userId required)' });
    }

    const newBooking = new Booking({
      userId: booking.userId,
      artistId: booking.artistId,
      eventDate: booking.eventDate ? new Date(booking.eventDate) : null,
      eventTime: booking.eventTime || '',
      eventLocation: booking.eventLocation || '',
      duration: booking.duration || '',
      additionalRequirements: booking.additionalRequirements || '',
      status: 'confirmed',
      amount: booking.amount || (razorpay && razorpay.amount) || 0,
      createdAt: new Date()
    });

    const savedBooking = await newBooking.save();

    const bookingInfo = {
      bookingId: savedBooking._id,
      ...booking
    };

    const pdfBuffer = await makeReceiptPdfBuffer({ type: 'receipt', paymentInfo: razorpay || {}, bookingInfo });

    let uploadedPdfUrl = null;
    if (uploadToGcs) {
      try {
        const destPath = `receipts/booking-${savedBooking._id}.pdf`;
        const uploadResult = await uploadToGcs(pdfBuffer, destPath).catch(e => { throw e; });
        if (uploadResult && uploadResult.publicUrl) uploadedPdfUrl = uploadResult.publicUrl;
        if (!uploadedPdfUrl && typeof uploadResult === 'string') uploadedPdfUrl = uploadResult;
      } catch (gcsErr) {
        console.warn('GCS upload failed (non-fatal):', gcsErr.message || gcsErr);
      }
    }

    const organizerEmail = booking.organizerEmail;
    const artistEmail = booking.artistEmail;
    const subjectOrg = `Booking & Payment Confirmation — ConnectArtist — Booking ${savedBooking._id}`;
    const subjectArtist = `You have a new Booking — ConnectArtist — Booking ${savedBooking._id}`;
    const textOrg = `Hi ${booking.organizerName || ''},\n\nYour booking is confirmed.\nBooking ID: ${savedBooking._id}\nVenue: ${booking.eventLocation}\nDate: ${booking.eventDate}\nThank you.`;
    const textArtist = `Hi ${booking.artistName || ''},\n\nYou have been booked.\nBooking ID: ${savedBooking._id}\nVenue: ${booking.eventLocation}\nDate: ${booking.eventDate}\nContact: ${booking.organizerPhone || ''}`;

    const emailPromises = [];
    if (organizerEmail) emailPromises.push(sendEmailWithAttachment(organizerEmail, subjectOrg, textOrg, pdfBuffer, `receipt-${savedBooking._id}.pdf`));
    if (artistEmail) emailPromises.push(sendEmailWithAttachment(artistEmail, subjectArtist, textArtist, pdfBuffer, `booking-${savedBooking._id}.pdf`));
    const emailResults = await Promise.allSettled(emailPromises);

    const orgPhone = booking.organizerPhone;
    const artistPhone = booking.artistPhone;
    const messageForOrganizer = `Booking confirmed for ${booking.artistName || ''} on ${booking.eventDate} at ${booking.eventTime}. Venue: ${booking.eventLocation}. Booking ID: ${savedBooking._id}`;
    const messageForArtist = `You have a new booking by ${booking.organizerName || ''} on ${booking.eventDate} ${booking.eventTime} at ${booking.eventLocation}. Booking ID: ${savedBooking._id}. Organizer phone: ${booking.organizerPhone || ''}`;

    const gupPromises = [];
    try {
      if (orgPhone) {
        gupPromises.push(sendGupshupWhatsApp(orgPhone, messageForOrganizer).catch(e => ({ error: e.message || e })));
        gupPromises.push(sendGupshupSMS(orgPhone, messageForOrganizer).catch(e => ({ error: e.message || e })));
      }
      if (artistPhone) {
        gupPromises.push(sendGupshupWhatsApp(artistPhone, messageForArtist).catch(e => ({ error: e.message || e })));
        gupPromises.push(sendGupshupSMS(artistPhone, messageForArtist).catch(e => ({ error: e.message || e })));
      }
    } catch (gErr) {
      console.warn('Gupshup call error (non-fatal):', gErr.message || gErr);
    }
    const gupResults = await Promise.allSettled(gupPromises);

    const bookingPdfBase64 = pdfBuffer.toString('base64');

    return res.json({
      success: true,
      bookingId: savedBooking._id,
      bookingPdfBase64,
      bookingPdfUrl: uploadedPdfUrl,
      emailResults,
      gupResults,
      message: 'Booking created and notifications triggered (some sends are best-effort).'
    });
  } catch (err) {
    console.error('paymentSuccessHandler error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};
