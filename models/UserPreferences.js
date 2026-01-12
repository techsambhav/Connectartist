const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  likedArtists: [{
    artistId: { type: String, required: true },
    likedAt: { type: Date, default: Date.now }
  }],
  preferredGenres: [{
    genre: {
      type: String,
      enum: ['Musician', 'Singer', 'DJ', 'Comedian', 'Magician', 'Dancer', 'General Artist']
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);