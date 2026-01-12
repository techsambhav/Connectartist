// models/profile.js

const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  bio: {
    type: String,
    trim: true
  },
  genre: {
    type: String,
    enum: ['Musician', 'Singer', 'DJ', 'Comedian', 'Magician', 'Dancer', 'General Artist', 'Other'],
    default: 'General Artist'
  },
  price: { // Added price field to match your forms
    type: Number,
    default: 0
  },
  location: { // Added location field
    type: String,
    trim: true
  },
  avatarUrl: String,
  bannerUrl: String,
  
  // ✅ CORRECTED: Added fields to store arrays of media files.
  // Each array will hold objects, with each object containing the URL to the file.
  videos: [{
    url: String,
    title: String
  }],
  audios: [{
    url: String,
    title: String
  }],
  photos: [{
    url: String,
    title: String
  }],

  // Social tracking fields
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  comments: [{
    userId: { type: String, required: true },
    username: { type: String, required: true },
    userAvatar: { type: String }, // To store the commenter's avatar
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  }],
}, {
  timestamps: true 
});

module.exports = mongoose.model('Profile', profileSchema);