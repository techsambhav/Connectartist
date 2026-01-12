const mongoose = require('mongoose');
const Booking = require('./models/Booking');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/connectartist');

async function createTestBooking() {
  try {
    // Use existing artist ID from previous tests
    const artistId = '68b917970861b56e3644d863';
    const organizerId = new mongoose.Types.ObjectId(); // Create a test organizer ID
    
    const testBooking = new Booking({
      artistId: artistId,
      organizerId: organizerId,
      eventDate: new Date('2025-10-15'),
      startTime: '19:00',
      eventLocation: 'Test Venue, Mumbai',
      price: 50000,
      status: 'confirmed',
      organizerName: 'Test Organizer',
      organizerEmail: 'organizer@test.com',
      eventDescription: 'Test Event for Artist Booking',
      venue: 'Test Venue',
      amount: 50000,
      files: {
        bookingArtistUrl: `/api/escrow/bookings/test-booking-artist.pdf`,
        bookingOrgUrl: `/api/escrow/bookings/test-booking-org.pdf`
      }
    });

    const savedBooking = await testBooking.save();
    console.log('✅ Test booking created successfully:');
    console.log('Booking ID:', savedBooking._id);
    console.log('Artist ID:', savedBooking.artistId);
    console.log('Organizer ID:', savedBooking.organizerId);
    console.log('Event Date:', savedBooking.eventDate);
    console.log('Status:', savedBooking.status);
    console.log('Price:', savedBooking.price);
    
    // Verify we can fetch it back
    const fetchedBooking = await Booking.findById(savedBooking._id);
    console.log('\n✅ Booking retrieved successfully from database');
    
    // Test the artist-specific query
    const artistBookings = await Booking.find({ artistId: artistId });
    console.log(`\n✅ Found ${artistBookings.length} booking(s) for artist ${artistId}`);
    
    console.log('\n📋 Complete booking data:');
    console.log(JSON.stringify(fetchedBooking, null, 2));
    
  } catch (error) {
    console.error('❌ Error creating test booking:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestBooking();