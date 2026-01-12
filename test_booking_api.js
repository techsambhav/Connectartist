const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/connectartist');

const Booking = require('./models/Booking');

async function testBookingAPI() {
  try {
    const artistId = '68b917970861b56e3644d863';
    
    // Generate a test JWT token for the artist
    const token = jwt.sign(
      { userId: artistId, role: 'artist' },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '1h' }
    );
    
    console.log('🔑 Generated test token for artist:', artistId);
    console.log('Token:', token);
    
    // Simulate the API call logic
    console.log('\n📡 Testing API logic...');
    
    // Test 1: Direct database query (what the API does)
    const bookings = await Booking.find({ artistId: artistId }).sort({ createdAt: -1 }).lean();
    console.log(`✅ Found ${bookings.length} booking(s) for artist ${artistId}`);
    
    if (bookings.length > 0) {
      const booking = bookings[0];
      console.log('\n📋 First booking details:');
      console.log('ID:', booking._id);
      console.log('Artist ID:', booking.artistId);
      console.log('Organizer:', booking.organizerName);
      console.log('Date:', booking.eventDate);
      console.log('Time:', booking.startTime);
      console.log('Venue:', booking.venue);
      console.log('Price:', booking.price);
      console.log('Status:', booking.status);
      console.log('Files:', booking.files);
    }
    
    // Test 2: Test the authorization logic
    const callerId = artistId; // Simulating req.userId
    const isAuthorized = String(callerId) === String(artistId);
    console.log('\n🔐 Authorization check:');
    console.log('Caller ID:', callerId);
    console.log('Artist ID:', artistId);
    console.log('Is Authorized:', isAuthorized);
    
  } catch (error) {
    console.error('❌ Error testing booking API:', error);
  } finally {
    mongoose.connection.close();
  }
}

testBookingAPI();