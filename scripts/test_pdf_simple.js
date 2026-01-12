/**
 * Simple PDF Generation Test (No Database)
 *
 * Tests PDF generation without MongoDB connection
 * Run: node scripts\test_pdf_simple.js
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Mock the Profile model to avoid database connection
jest.mock('../models/Profile', () => ({
  findOne: jest.fn().mockResolvedValue(null) // Return null (no photo found)
}));

// Import after mocking
const { generateBookingPDF } = require('../services/pdfGenerator');

// Sample booking data
const sampleBooking = {
  _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
  artistId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
  artistName: 'Rahul Sharma',
  artistEmail: 'rahul.sharma@example.com',
  artistPhone: '+91 98765 43210',
  artistGenre: 'Classical Fusion',
  organizerName: 'Priya Patel',
  organizerEmail: 'priya.patel@example.com',
  organizerPhone: '+91 87654 32109',
  eventDate: new Date('2025-12-25'),
  startTime: '19:00',
  venue: 'Grand Ballroom, Taj Palace Hotel, Mumbai',
  price: 75000,
  paymentStatus: 'captured',
  notes: 'Event Type: Wedding | Audience Size: 500 | End Time: 23:00 | Load-in Time: 17:00 | Soundcheck Time: 18:00 | Technical Requirements: PA System, Monitors, Lights | Stage Size: 10m x 8m | Accommodation Provided: Yes (Taj Hotel) | Travel Allowance: ₹5000 | Additional Notes: Bride loves Sufi music'
};

async function testSimple() {
  console.log('🧪 Simple PDF Test Starting...\n');

  try {
    console.log('📄 Generating Organizer PDF...');
    const orgPDF = await generateBookingPDF(sampleBooking, 'org');
    fs.writeFileSync('test_simple_org.pdf', orgPDF);
    console.log(`✅ Organizer PDF: ${(orgPDF.length / 1024).toFixed(2)} KB\n`);

    console.log('🎸 Generating Artist PDF...');
    const artistPDF = await generateBookingPDF(sampleBooking, 'artist');
    fs.writeFileSync('test_simple_artist.pdf', artistPDF);
    console.log(`✅ Artist PDF: ${(artistPDF.length / 1024).toFixed(2)} KB\n`);

    console.log('🎉 Success! Check test_simple_org.pdf and test_simple_artist.pdf');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testSimple();
