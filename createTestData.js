const mongoose = require('mongoose');
const User = require('./models/User');
const Booking = require('./models/Booking');

async function createTestData() {
    try {
        await mongoose.connect('mongodb+srv://connectArtistAdmin:Shubham12@cluster0.b0mqhna.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to MongoDB');

        // Create test artist
        const artist = new User({
            _id: new mongoose.Types.ObjectId('68bde1fbcd2e93059ea312d5'),
            email: 'artist@test.com',
            password: 'test123',
            name: 'Test Artist',
            role: 'artist',
            profile: {
                artistType: 'musician',
                genre: 'rock',
                bio: 'Test artist for debugging'
            }
        });

        // Create test organizer
        const organizer = new User({
            email: 'organizer@test.com',
            password: 'test123',
            name: 'Test Organizer',
            role: 'organizer'
        });

        // Save users
        const savedArtist = await artist.save();
        const savedOrganizer = await organizer.save();
        
        console.log('Created artist:', savedArtist._id);
        console.log('Created organizer:', savedOrganizer._id);

        // Create test bookings for the artist
        const booking1 = new Booking({
            artistId: savedArtist._id,
            organizerId: savedOrganizer._id,
            artistName: 'Test Artist',
            artistEmail: 'artist@test.com',
            organizerName: 'Test Organizer',
            organizerEmail: 'organizer@test.com',
            eventDate: new Date('2024-12-25'),
            venue: 'Test Venue',
            notes: 'Test booking 1',
            price: 5000,
            status: 'confirmed',
            paymentStatus: 'captured'
        });

        const booking2 = new Booking({
            artistId: savedArtist._id,
            organizerId: savedOrganizer._id,
            artistName: 'Test Artist',
            artistEmail: 'artist@test.com',
            organizerName: 'Test Organizer',
            organizerEmail: 'organizer@test.com',
            eventDate: new Date('2025-01-15'),
            venue: 'Another Test Venue',
            notes: 'Test booking 2',
            price: 8000,
            status: 'pending',
            paymentStatus: 'order_created'
        });

        const savedBooking1 = await booking1.save();
        const savedBooking2 = await booking2.save();
        
        console.log('Created booking 1:', savedBooking1._id);
        console.log('Created booking 2:', savedBooking2._id);

        console.log('\nTest data created successfully!');
        console.log(`Artist ID: ${savedArtist._id}`);
        console.log(`Visit: http://localhost:3000/card.html?id=${savedArtist._id}`);
        
    } catch (error) {
        console.error('Error creating test data:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

createTestData();