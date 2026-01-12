// models/PaymentTransaction.js
const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true }, // keep unique here
  orderId: { type: String },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  amount: { type: Number },
  currency: { type: String },
  status: { type: String },
  rawGatewayPayload: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

// Removed duplicate explicit index creation (unique is declared above).
// If you prefer to create indexes manually in production, remove `unique: true` and create index via migration.

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
