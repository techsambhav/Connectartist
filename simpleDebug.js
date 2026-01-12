console.log('Starting debug script...');

const mongoose = require('mongoose');

async function simpleTest() {
    console.log('Function started...');
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect('mongodb+srv://connectArtistAdmin:Shubham12@cluster0.b0mqhna.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected successfully!');
        
        const Booking = require('./models/Booking');
        console.log('Booking model loaded');
        
        const bookings = await Booking.find({}).limit(1);
        console.log('Found bookings:', bookings.length);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        console.log('Disconnecting...');
        await mongoose.disconnect();
        console.log('Done!');
        process.exit(0);
    }
}

simpleTest();