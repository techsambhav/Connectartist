const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  artistName: { type: String },
  artistEmail: { type: String },
  artistPhone: { type: String },
  organizerName: { type: String },
  organizerEmail: { type: String },
  organizerPhone: { type: String },
  eventDate: { type: Date },
  startTime: { type: String },
  endTime: { type: String },
  venue: { type: String },
  notes: { type: String },
  price: { type: Number },
  durationHours: { type: Number },
  status: { type: String, enum: ['pending','confirmed','cancelled','completed'], default: 'pending' },
  // paymentStatus tracked through lifecycle: created -> order_created -> captured | failed | refunded
  paymentStatus: { type: String, enum: ['pending','created','order_created','captured','failed','refunded'], default: 'pending' },
  razorpay: {
    orderId: { type: String },
    paymentId: { type: String }
  },
  files: {
    bookingOrgUrl: { type: String },
    receiptUrl: { type: String },
    bookingArtistUrl: { type: String }
  },
  notificationStatus: { type: mongoose.Schema.Types.Mixed },
  payoutStatus: { type: String, enum: ['pending','requested','completed','failed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
