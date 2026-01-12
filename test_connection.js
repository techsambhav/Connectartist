const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  try {
    console.log('🔍 Testing MongoDB Atlas connection...');
    console.log('URI:', process.env.MONGODB_URI ? 'Set (Atlas)' : 'Not set');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    // List all collections to see what's available
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📊 Available collections:', collections.map(c => c.name));
    
    // Check if bookings collection exists and has data
    if (collections.find(c => c.name === 'bookings')) {
      const bookingsCount = await db.collection('bookings').countDocuments();
      console.log('📋 Bookings count:', bookingsCount);
      
      // Get a sample booking if any exist
      const sampleBooking = await db.collection('bookings').findOne();
      if (sampleBooking) {
        console.log('📄 Sample booking:', {
          _id: sampleBooking._id,
          artistId: sampleBooking.artistId,
          organizerName: sampleBooking.organizerName,
          status: sampleBooking.status
        });
      }
    } else {
      console.log('⚠️ No bookings collection found');
    }
    
    await mongoose.disconnect();
    console.log('✅ Connection test completed');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testConnection();