const mongoose = require('mongoose');
require('dotenv').config();

async function analyzeBookings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = mongoose.connection.db;
    const targetArtistId = '68b917970861b56e3644d863';
    
    console.log('🎯 Searching for bookings for artist:', targetArtistId);
    
    // First, let's see all bookings for this artist
    const bookings = await db.collection('bookings').find({ 
      artistId: targetArtistId 
    }).toArray();
    
    console.log('📊 Found', bookings.length, 'booking(s) for this artist');
    
    bookings.forEach((booking, index) => {
      console.log(`\n📋 Booking ${index + 1}:`);
      console.log('  _id:', booking._id);
      console.log('  artistId:', booking.artistId, '(type:', typeof booking.artistId, ')');
      console.log('  organizerId:', booking.organizerId);
      console.log('  organizerName:', booking.organizerName);
      console.log('  organizerEmail:', booking.organizerEmail);
      console.log('  eventDate:', booking.eventDate);
      console.log('  startTime:', booking.startTime);
      console.log('  venue:', booking.venue);
      console.log('  price:', booking.price);
      console.log('  status:', booking.status);
      console.log('  createdAt:', booking.createdAt);
      console.log('  files:', booking.files);
    });
    
    // Also check if there are any bookings with ObjectId format
    const bookingsWithObjectId = await db.collection('bookings').find({ 
      artistId: new mongoose.Types.ObjectId(targetArtistId)
    }).toArray();
    
    console.log('\n🔍 Bookings with ObjectId artistId:', bookingsWithObjectId.length);
    
    // Check all bookings to see what artistId formats exist
    const allBookings = await db.collection('bookings').find({}).limit(10).toArray();
    console.log('\n📊 Sample of all booking artistId formats:');
    allBookings.forEach((booking, index) => {
      console.log(`  ${index + 1}. artistId:`, booking.artistId, '(type:', typeof booking.artistId, ')');
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error analyzing bookings:', error);
  }
}

analyzeBookings();