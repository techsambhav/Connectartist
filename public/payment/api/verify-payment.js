const express = require('express');
const router = express.Router();
const crypto = require('crypto');

router.post('/', async (req, res) => {
  const { order_id, payment_id, signature } = req.body;
  
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(order_id + "|" + payment_id)
    .digest('hex');
    
  if (generatedSignature === signature) {
    // Payment is legitimate - save to database
    await saveSuccessfulPayment(order_id, payment_id);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

async function saveSuccessfulPayment(orderId, paymentId) {
  // Implement your database logic here
}

module.exports = router;