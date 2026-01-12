const axios = require('axios');
const https = require('https');

async function run() {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await axios.post('https://localhost:5000/api/escrow/bookings/artist/68bde1fbcd2e93059ea312d5/create-order', { eventDate: '2025-09-20' }, { httpsAgent: agent, headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
    console.log('status', res.status);
    console.log('data', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('status', err.response.status);
      try { console.error('body', JSON.stringify(err.response.data, null, 2)); } catch(e){ console.error('body raw', err.response.data); }
    } else {
      console.error('err', err.message);
    }
    process.exit(1);
  }
}

run();
