const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  location: { type: String, required: true },
  email: { type: String },
  altNumber: { type: String },
  altEmail: { type: String },
  // Optional reference to a Profile (artist) so contacts are associated with an artist
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
});

module.exports = mongoose.model("Contact", contactSchema);
