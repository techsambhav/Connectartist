const mongoose = require('mongoose');
const Booking = require('./models/Booking');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/connectartist');

async function createMultipleTestBookings() {
  try {
    const artistId = '68b917970861b56e3644d863';
    
    const testBookings = [
      {
        artistId: artistId,
        organizerId: new mongoose.Types.ObjectId(),
        eventDate: new Date('2025-10-15'),
        startTime: '19:00',
        eventLocation: 'Mumbai Concert Hall',
        price: 50000,
        status: 'confirmed',
        organizerName: 'Mumbai Music Events',
        organizerEmail: 'events@mumbaimusic.com',
        eventDescription: 'Evening Concert Performance',
        venue: 'Mumbai Concert Hall'
      },
      {
        artistId: artistId,
        organizerId: new mongoose.Types.ObjectId(),
        eventDate: new Date('2025-11-20'),
        startTime: '20:30',
        eventLocation: 'Delhi Cultural Center',
        price: 75000,
        status: 'pending',
        organizerName: 'Delhi Art Foundation',
        organizerEmail: 'booking@delhiart.org',
        eventDescription: 'Cultural Festival Performance',
        venue: 'Delhi Cultural Center'
      },
      {
        artistId: artistId,
        organizerId: new mongoose.Types.ObjectId(),
        eventDate: new Date('2025-12-05'),
        startTime: '18:00',
        eventLocation: 'Bangalore Tech Park',
        price: 35000,
        status: 'completed',
        organizerName: 'TechCorp Events',
        organizerEmail: 'hr@techcorp.com',
        eventDescription: 'Corporate Annual Party',
        venue: 'Bangalore Tech Park'
      },
      {
        artistId: artistId,
        organizerId: new mongoose.Types.ObjectId(),
        eventDate: new Date('2025-09-25'),
        startTime: '21:00',
        eventLocation: 'Pune Wedding Venue',
        price: 60000,
        status: 'cancelled',
        organizerName: 'Sharma Wedding Planners',
        organizerEmail: 'contact@sharmaweddings.in',
        eventDescription: 'Wedding Reception Performance',
        venue: 'Pune Wedding Venue'
      }
    ];

    console.log('🚀 Creating multiple test bookings...');
    
    // Clear existing test bookings first
    await Booking.deleteMany({ artistId: artistId });
    console.log('🗑️ Cleared existing test bookings');
    
    // Create new bookings
    const savedBookings = await Booking.insertMany(testBookings);
    
    console.log(`✅ Created ${savedBookings.length} test bookings successfully:`);
    
    savedBookings.forEach((booking, index) => {
      console.log(`\n📅 Booking ${index + 1}:`);
      console.log('  ID:', booking._id);
      console.log('  Organizer:', booking.organizerName);
      console.log('  Date:', booking.eventDate.toDateString());
      console.log('  Time:', booking.startTime);
      console.log('  Venue:', booking.venue);
      console.log('  Price: ₹', booking.price);
      console.log('  Status:', booking.status);
    });
    
    // Verify we can fetch them all
    const allBookings = await Booking.find({ artistId: artistId }).sort({ eventDate: 1 });
    console.log(`\n✅ Verification: Found ${allBookings.length} booking(s) for artist ${artistId}`);
    
    console.log('\n🎯 Test data ready! You can now:');
    console.log('1. Open the artist profile page: http://localhost:3000/card.html?id=' + artistId);
    console.log('2. Login as the artist to see YOUR EVENTS section');
    console.log('3. Test the download and contact functionality');
    
  } catch (error) {
    console.error('❌ Error creating test bookings:', error);
  } finally {
    mongoose.connection.close();
  }
}

createMultipleTestBookings();