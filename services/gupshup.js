const axios = require('axios');

// NOTE: This is a minimal wrapper — adapt payloads & endpoints to your Gupshup account type (business API vs sandbox)
const GUPSHUP_API = process.env.GUPSHUP_API_URL || 'https://api.gupshup.io/sm/api/v1/msg'; // example endpoint

exports.sendWhatsApp = async (phone, message) => {
  const payload = {
    source: process.env.GUPSHUP_APP_NAME || 'ConnectArtist',
    destination: phone,
    message: message
  };
  const headers = { 'Content-Type': 'application/json', 'apikey': process.env.GUPSHUP_API_KEY };
  try {
    const resp = await axios.post(GUPSHUP_API, payload, { headers });
    return resp.data;
  } catch (err) {
    // rethrow with more context
    throw new Error(`Gupshup sendWhatsApp failed: ${err.response?.data || err.message}`);
  }
};

exports.sendSms = async (phone, text) => {
  const payload = {
    channel: 'sms',
    source: process.env.GUPSHUP_APP_NAME || 'ConnectArtist',
    destination: phone,
    message: text
  };
  const headers = { 'Content-Type': 'application/json', 'apikey': process.env.GUPSHUP_API_KEY };
  try {
    const resp = await axios.post(GUPSHUP_API, payload, { headers });
    return resp.data;
  } catch (err) {
    throw new Error(`Gupshup sendSms failed: ${err.response?.data || err.message}`);
  }
};
