const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Fixed case to match file name
const ensureAuth = require('../middleware/auth');
// Route for user registration (signup)
// This will be accessed via /api/signup
router.post('/signup', authController.register); // Use direct controller, do not destructure req.body here

// Route for user login
// This will be accessed via /api/login
router.post('/login', authController.login);

// Change password (requires token or token in body)
router.post('/change-password', authController.changePassword);

// Phone linking / verification (placeholders)
router.post('/link-phone', authController.linkPhone);
router.post('/verify-phone', authController.verifyPhone);

// Return current logged-in user
router.get('/me', ensureAuth, authController.me);

module.exports = router;
