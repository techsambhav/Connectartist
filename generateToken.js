const jwt = require('jsonwebtoken');

const SECRET = 'c8d57954a14e0c0ed47b30817ff933eaf06de2475b34a179187a2c13adf02e2e';
const artistId = '68bde1fbcd2e93059ea312d5';

const payload = { 
    sub: artistId,
    email: 'artist@test.com',
    role: 'artist',
    sessionRole: 'artist'
};

const token = jwt.sign(payload, SECRET, { expiresIn: '7d' });

console.log('Generated JWT token for artist:');
console.log(token);
console.log('\nTo use this token:');
console.log('1. Open browser developer tools (F12)');
console.log('2. Go to Application/Storage tab > Local Storage');
console.log('3. Set:');
console.log(`   token: ${token}`);
console.log(`   userId: ${artistId}`);
console.log('4. Refresh the page');