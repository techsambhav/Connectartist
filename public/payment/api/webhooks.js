const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const razorpaySignature = req.headers['x-razorpay-signature'];
  const isValid = razorpay.validateWebhookSignature(
    JSON.stringify(req.body),
    razorpaySignature,
    process.env.RAZORPAY_WEBHOOK_SECRET
  );
  
  if (!isValid) return res.status(400).send('Invalid signature');
  
  const event = req.body.event;
  const paymentId = req.body.payload.payment.entity.id;
  
  switch(event) {
    case 'payment.authorized':
      await processAuthorizedPayment(paymentId);
      break;
    case 'payment.failed':
      await handleFailedPayment(paymentId);
      break;
    case 'payment.captured':
      await confirmSuccessfulPayment(paymentId);
      break;
  }
  
  res.status(200).send('Webhook processed');
});

module.exports = router;