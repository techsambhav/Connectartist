const jwt = require('jsonwebtoken');
require('dotenv').config();

const artistId = '68b917970861b56e3644d863';

// Generate a test JWT token for the artist
const token = jwt.sign(
  { userId: artistId, role: 'artist' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🔑 Test JWT Token for artist', artistId);
console.log('Copy this token for manual testing:');
console.log('');
console.log(token);
console.log('');
console.log('🧪 Manual API Test Commands:');
console.log('');
console.log('1. Test /api/auth/me endpoint:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/auth/me`);
console.log('');
console.log('2. Test /api/bookings/artist/:artistId endpoint:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/bookings/artist/${artistId}`);
console.log('');
console.log('3. Test general /api/bookings endpoint:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/bookings`);
console.log('');
console.log('💡 You can also use this token in localStorage:');
console.log(`localStorage.setItem('token', '${token}');`);
console.log(`localStorage.setItem('userId', '${artistId}');`);