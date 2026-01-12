// Test the specific functionality that's failing
const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const User = require('./models/User');

async function debugArtistRoute() {
    try {
        await mongoose.connect('mongodb+srv://connectArtistAdmin:Shubham12@cluster0.b0mqhna.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to MongoDB Atlas');

        const artistId = '68bde1fbcd2e93059ea312d5';
        
        console.log('1. Testing artistId validation...');
        const isValidId = mongoose.Types.ObjectId.isValid(artistId);
        console.log('   Valid ObjectId?', isValidId);
        
        console.log('2. Looking for bookings...');
        const bookings = await Booking.find({ artistId: artistId }).sort({ createdAt: -1 }).lean();
        console.log('   Found bookings:', bookings.length);
        
        if (bookings.length > 0) {
            console.log('   Sample booking:', {
                _id: bookings[0]._id,
                artistId: bookings[0].artistId,
                organizerId: bookings[0].organizerId,
                artistName: bookings[0].artistName,
                organizerName: bookings[0].organizerName
            });
        }

        console.log('3. Testing organizer profile lookup...');
        const organizerIds = [...new Set(bookings.map(b => String(b.organizerId)).filter(Boolean))];
        console.log('   Organizer IDs to lookup:', organizerIds);
        
        if (organizerIds.length > 0) {
            console.log('4. Looking up organizer users...');
            const users = await User.find({ _id: { $in: organizerIds } }, { name: 1, photoUrl: 1, email: 1 }).lean();
            console.log('   Found organizer users:', users.length);
            if (users.length > 0) {
                console.log('   Sample organizer:', {
                    _id: users[0]._id,
                    name: users[0].name,
                    email: users[0].email
                });
            }
        }
        
        console.log('5. All tests completed successfully!');
        
    } catch (error) {
        console.error('Error in test:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

debugArtistRoute();