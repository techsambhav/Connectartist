const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: { 
    type: String,
    // Add required: true here if name is mandatory for every user registration
  },
  artistType: { 
    type: String,
    default: 'General Artist'
  },
  role: { 
    type: String,
    default: 'artist'
  },
  // Track password change attempts and optional phone verification
  passwordChangeCount: {
    type: Number,
    default: 0
  },
  phoneNumber: {
    type: String,
    default: null
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  createdByAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving (pre-save hook)
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    // Generate a salt and hash the password
    this.password = await bcrypt.hash(this.password, 10);
  }
  next(); // Proceed to save
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  // Compare the provided plain-text password with the stored hashed password
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate auth token
userSchema.methods.generateAuthToken = function() {
  // Sign the JWT with the user's _id and the secret key
  return jwt.sign({ userId: this._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

module.exports = mongoose.model('User', userSchema);
