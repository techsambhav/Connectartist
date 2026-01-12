const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testAPIEndpoint() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const Booking = require('./models/Booking');
    const artistId = '68b917970861b56e3644d863';
    
    console.log('🧪 Testing API logic for artist:', artistId);
    
    // Simulate what the API does
    console.log('\n1️⃣ Testing Booking.find() with string artistId...');
    const bookingsString = await Booking.find({ artistId: artistId }).sort({ createdAt: -1 }).lean();
    console.log('Found bookings with string artistId:', bookingsString.length);
    
    console.log('\n2️⃣ Testing Booking.find() with ObjectId artistId...');
    const bookingsObjectId = await Booking.find({ artistId: new mongoose.Types.ObjectId(artistId) }).sort({ createdAt: -1 }).lean();
    console.log('Found bookings with ObjectId artistId:', bookingsObjectId.length);
    
    console.log('\n3️⃣ Testing mixed query (string OR ObjectId)...');
    const bookingsMixed = await Booking.find({
      $or: [
        { artistId: artistId },
        { artistId: new mongoose.Types.ObjectId(artistId) }
      ]
    }).sort({ createdAt: -1 }).lean();
    console.log('Found bookings with mixed query:', bookingsMixed.length);
    
    if (bookingsMixed.length > 0) {
      console.log('\n📋 First booking details:');
      const booking = bookingsMixed[0];
      console.log('  ID:', booking._id);
      console.log('  Artist ID:', booking.artistId, '(type:', typeof booking.artistId, ')');
      console.log('  Organizer ID:', booking.organizerId);
      console.log('  Organizer Name:', booking.organizerName);
      console.log('  Event Date:', booking.eventDate);
      console.log('  Venue:', booking.venue);
      console.log('  Price:', booking.price);
      console.log('  Status:', booking.status);
      console.log('  Files:', booking.files);
    }
    
    // Test what the authorization logic does
    console.log('\n🔐 Testing authorization logic...');
    const callerId = artistId; // This would come from JWT
    const isAuthorized = String(callerId) === String(artistId);
    console.log('Caller ID:', callerId);
    console.log('Artist ID:', artistId);
    console.log('Is Authorized:', isAuthorized);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

testAPIEndpoint();