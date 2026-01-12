const express = require('express');
const router = express.Router();
const { upload, uploadToGCS } = require('../gcsUpload');
const Profile = require('../models/Profile');
const jwt = require('jsonwebtoken');

// Check if current user is the profile owner
router.get('/check-owner/:profileId', async (req, res) => {
    try {
        const token = req.cookies.token; // Assuming token is stored in cookies
        if (!token) {
            return res.json({ isOwner: false });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        const profileId = req.params.profileId;

        const profile = await Profile.findById(profileId);
        if (!profile) {
            return res.json({ isOwner: false });
        }

        const isOwner = profile.userId.toString() === userId.toString();
        res.json({ isOwner });
    } catch (error) {
        console.error('Error checking profile ownership:', error);
        res.json({ isOwner: false });
    }
});

// Note: Profile creation/update is handled in server.js at POST /api/profile/save

module.exports = router;
