/**
 * Step-by-Step PDF Test
 * Tests each function individually
 */

console.log('Step 1: Loading dependencies...');
const mongoose = require('mongoose');
const { parseBookingNotes } = require('../utils/notesParser');
const QRCode = require('qrcode');
const Mustache = require('mustache');
const crypto = require('crypto');

console.log('✅ All dependencies loaded\n');

// Test data
const sampleBooking = {
  _id: new mongoose.Types.ObjectId(),
  artistName: 'Rahul Sharma',
  organizerName: 'Priya Patel',
  eventDate: new Date('2025-12-25'),
  startTime: '19:00',
  venue: 'Grand Ballroom, Taj Palace Hotel',
  price: 75000,
  paymentStatus: 'captured',
  notes: 'Event Type: Wedding | Audience Size: 500 | Load-in Time: 17:00 | Technical Requirements: PA System, Monitors, Lights'
};

console.log('Step 2: Testing notes parser...');
const parsed = parseBookingNotes(sampleBooking.notes);
console.log('✅ Parsed notes:', {
  eventType: parsed.eventType,
  audienceSize: parsed.audienceSize,
  loadInTime: parsed.loadInTime,
  technicalRider: parsed.technicalRider
});
console.log('');

console.log('Step 3: Testing QR code generation...');
QRCode.toDataURL(`https://connectartist.com/booking/${sampleBooking._id}`, {
  errorCorrectionLevel: 'H',
  width: 400
}).then(qrCode => {
  console.log('✅ QR Code generated:', qrCode.substring(0, 50) + '...');
  console.log('');

  console.log('Step 4: Testing security code...');
  const hash = crypto.createHash('sha256').update(sampleBooking._id.toString()).digest('hex');
  const securityCode = hash.substring(0, 6).toUpperCase();
  console.log('✅ Security code:', securityCode);
  console.log('');

  console.log('Step 5: Testing Mustache rendering...');
  const template = '<h1>{{title}}</h1><p>{{content}}</p>';
  const data = { title: 'Test', content: 'Hello World' };
  const html = Mustache.render(template, data);
  console.log('✅ Mustache rendered:', html);
  console.log('');

  console.log('🎉 All components working! Ready for full PDF generation.');
}).catch(err => {
  console.error('❌ QR Code error:', err.message);
});
