const mongoose = require('mongoose');
require('dotenv').config();

console.log('🔍 Debugging booking creation...');

// Connect to MongoDB
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/connectartist';
console.log('📡 Connecting to MongoDB:', uri);

mongoose.connect(uri)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    return debugBookings();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

async function debugBookings() {
  try {
    const Booking = require('./models/Booking');
    console.log('📝 Booking model loaded');

    // First, check current bookings
    const existingBookings = await Booking.find({});
    console.log('📊 Existing bookings count:', existingBookings.length);

    // Try to create a simple booking
    const artistId = new mongoose.Types.ObjectId('68b917970861b56e3644d863');
    const organizerId = new mongoose.Types.ObjectId();
    
    console.log('🎯 Creating test booking...');
    console.log('Artist ID:', artistId);
    console.log('Organizer ID:', organizerId);

    const testBooking = new Booking({
      artistId: artistId,
      organizerId: organizerId,
      organizerName: 'Debug Test Organizer',
      organizerEmail: 'debug@test.com',
      eventDate: new Date('2025-10-15'),
      startTime: '19:00',
      venue: 'Debug Test Venue',
      price: 25000,
      status: 'confirmed'
    });

    console.log('💾 Saving booking...');
    const savedBooking = await testBooking.save();
    console.log('✅ Booking saved with ID:', savedBooking._id);

    // Verify it was saved
    const verifyBooking = await Booking.findById(savedBooking._id);
    console.log('🔍 Verification - booking found:', !!verifyBooking);
    
    if (verifyBooking) {
      console.log('📋 Verified booking details:');
      console.log('  Artist ID:', verifyBooking.artistId);
      console.log('  Organizer:', verifyBooking.organizerName);
      console.log('  Status:', verifyBooking.status);
    }

    // Check all bookings now
    const allBookings = await Booking.find({});
    console.log('📊 Total bookings after creation:', allBookings.length);

    // Test the query that the API uses
    const artistBookings = await Booking.find({ artistId: artistId });
    console.log('🎨 Bookings for artist', String(artistId), ':', artistBookings.length);

  } catch (error) {
    console.error('❌ Error during booking debug:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    mongoose.connection.close();
  }
}