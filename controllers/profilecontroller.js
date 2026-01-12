const Profile = require('../models/Profile');

// ✅ Get user profile (for /api/profile/me)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId; // Use req.userId from auth middleware
    let profile = await Profile.findOne({ userId });
    // Auto-create a minimal profile for first-time users to avoid 404s on profile page
    if (!profile) {
      profile = new Profile({ userId, displayName: 'New Artist' });
      await profile.save();
    }
    res.json(profile);
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({ message: error.message || 'Server error fetching profile' });
  }
};

// ✅ Get all profiles (for discover + admin dashboard)
exports.getAllProfiles = async (req, res) => {
  try {
    const profiles = await Profile.find({}); // fetch ALL fields
    res.json({ success: true, profiles });
  } catch (error) {
    console.error('Error in getAllProfiles:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error fetching all profiles' });
  }
};

// ✅ Create/update profile
exports.updateProfile = async (req, res) => {
  try {
  const { displayName, bio, artistType, price, location } = req.body;
    const userId = req.userId; // Use req.userId from auth middleware

    const avatarUrl = req.files && req.files.avatar && req.files.avatar[0] ? `/uploads/${req.files.avatar[0].filename}` : undefined;
  const audioUrl = req.files && req.files.audio && req.files.audio[0] ? `/uploads/${req.files.audio[0].filename}` : undefined;
    const bannerUrl = req.files && req.files.banner && req.files.banner[0] ? `/uploads/${req.files.banner[0].filename}` : undefined;
  const videoUrl = req.files && req.files.video && req.files.video[0] ? `/uploads/${req.files.video[0].filename}` : undefined;

    const profileData = {
      displayName,
      bio,
      ...(avatarUrl && { avatarUrl }),
      ...(bannerUrl && { bannerUrl }),
      // map artistType -> genre and include numeric price/location when provided
      ...(artistType ? { genre: artistType } : {}),
      ...(price ? { price: Number(price) || 0 } : {}),
      ...(location ? { location } : {}),
      updatedAt: new Date()
    };

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: profileData },
      { new: true, upsert: true }
    );

    res.status(200).json(profile);
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(400).json({ message: error.message || 'Error updating profile' });
  }
};
