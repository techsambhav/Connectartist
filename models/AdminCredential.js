const mongoose = require('mongoose');

const AdminCredentialSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who created it
  email: { type: String, required: true },
  passwordEncrypted: { type: String, required: true }, // AES ciphertext
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminCredential', AdminCredentialSchema);
