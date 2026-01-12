const axios = require('axios');

// Use HTTPS server directly and allow self-signed certs in local dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE = 'https://localhost:5000';
const artistId = '68bde1fbcd2e93059ea312d5';

async function main() {
  try {
    const payload = {
      eventDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
      eventTime: '18:00',
      eventLocation: 'Test Venue',
      organizerPhone: '+919876543210',
      notes: 'Test booking via script'
    };

  console.log('Posting create-order for artist', artistId, 'to', BASE);
  const res = await axios.post(`${BASE}/api/escrow/bookings/artist/${artistId}/create-order`, payload, { withCredentials: true, headers: { 'Content-Type': 'application/json' }, httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
  console.log('create-order status', res.status);
  console.log('create-order response:', JSON.stringify(res.data, null, 2));

    const bookingId = res.data && (res.data.bookingId || (res.data.booking && res.data.booking._id));
    if (!bookingId) {
      console.log('No bookingId returned; finishing');
      return;
    }

    console.log('Fetching booking', bookingId);
    const g = await axios.get(`${BASE}/api/escrow/bookings/${bookingId}`, { withCredentials: true });
    console.log('GET booking status', g.status);
    console.log('GET booking response:', JSON.stringify(g.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('HTTP error', err.response.status, JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error', err.message);
    }
    process.exitCode = 1;
  }
}

main();
