const jwt = require('jsonwebtoken');

const SECRET = 'c8d57954a14e0c0ed47b30817ff933eaf06de2475b34a179187a2c13adf02e2e';
const artistId = '68b917970861b56e3644d863'; // Real artist with bookings

const payload = { 
    sub: artistId,
    email: 'pushpshar1@gmail.com',
    role: 'artist',
    sessionRole: 'artist'
};

const token = jwt.sign(payload, SECRET, { expiresIn: '7d' });

console.log('Generated JWT token for real artist (Pushp Sharma):');
console.log(token);
console.log('\nTo test YOUR EVENTS:');
console.log('1. Open: http://localhost:3000/card.html?id=68b917970861b56e3644d863');
console.log('2. Open browser developer tools (F12)');
console.log('3. Go to Application/Storage tab > Local Storage');
console.log('4. Set:');
console.log(`   token: ${token}`);
console.log(`   userId: ${artistId}`);
console.log('5. Refresh the page');
console.log('6. Look for YOUR EVENTS section');