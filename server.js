require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const profileRoutes = require('./routes/profileRoutes');
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const paymentController = require('./controllers/paymentController');
const authController = require('./controllers/authController');
const User = require('./models/User');
const Profile = require('./models/Profile');
const AdminCredential = require('./models/AdminCredential');
const { encrypt, decrypt } = require('./utils/credCrypto');
const UserPreferences = require('./models/UserPreferences');
const Booking = require('./models/Booking');
const axios = require('axios');
const http = require('http');
const socketio = require('socket.io');
const https = require('https');
const fs = require('fs');
const contactRoutes = require("./routes/contact");
const profileController = require('./controllers/profilecontroller'); // ensure path/name matches project
const authMw = require('./middleware/auth');



const multer = require('multer');
// Simple in-memory multer storage for uploads (safe default). Change to diskStorage if needed.
const upload = multer({ storage: multer.memoryStorage() });
;
const gcsUpload = require('./gcsUpload');


const app = express();

// Persist basic incoming request info to logs/requests.log for debugging
try {
  const reqLogDir = require('path').join(__dirname, 'logs');
  if (!fs.existsSync(reqLogDir)) fs.mkdirSync(reqLogDir, { recursive: true });
  const reqLogFile = require('path').join(reqLogDir, 'requests.log');
  app.use((req, res, next) => {
    try {
      const short = { t: new Date().toISOString(), m: req.method, u: req.originalUrl };
      fs.appendFile(reqLogFile, JSON.stringify(short) + '\n', () => {});
    } catch (e) { /* ignore */ }
    next();
  });
} catch (e) { console.warn('Could not initialize request logger', e && e.message); }

// Helper: find profile by either userId or profile _id if valid ObjectId
async function findProfileByIdOrUserId(id) {
  if (!id) return null;
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { $or: [{ userId: id }, { _id: id }] } : { userId: id };
    return await Profile.findOne(query);
  } catch (err) {
    console.error('findProfileByIdOrUserId error for id=', id, err);
    return null;
  }
}

// Basic middleware setup
const bodyParser = require('body-parser');

// Capture raw body for webhook signature verification
app.use(bodyParser.json({
  verify: function (req, res, buf) {
    try {
      req.rawBody = buf.toString('utf8');
    } catch (e) {
      req.rawBody = undefined;
    }
  }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use("/api/contacts", contactRoutes);

// Simple request logger for debugging (prints method, url and content-type)
app.use((req, res, next) => {
  try {
    if (req.url && req.url.startsWith('/api/escrow')) {
      console.log('[REQ]', req.method, req.url, 'content-type:', req.headers['content-type'] || '');
      // limit body preview for logs
      if (req.body) {
        const preview = Object.assign({}, req.body);
        if (preview.notes) preview.notes = '[trimmed]';
        console.log('[REQ BODY PREVIEW]', preview);
      }
    }
  } catch (e) { /* ignore logging errors */ }
  next();
});
// Configure CORS
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-rtb-fingerprint-id'], // added custom header
    credentials: true,
    maxAge: 86400
}));

// Ensure response exposes the header to browsers (so response.headers.get('x-rtb-fingerprint-id') works)
app.use((req, res, next) => {
  // add any other headers you need to expose as a comma-separated list
  res.setHeader('Access-Control-Expose-Headers', 'x-rtb-fingerprint-id');
  next();
});

// Permissive CORS response headers middleware (helpful during dev; tighten in production)
app.use((req, res, next) => {
  try {
    const allowedOrigins = [
      'https://localhost:5000',
      'http://localhost:3000',
      'https://connectartist.in'
    ];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
  } catch (e) { /* ignore */ }
  next();
});

// If client sends x-rtb-fingerprint-id, echo it back on responses so browser JS can read it.
app.use((req, res, next) => {
  try {
    const fp = req.header('x-rtb-fingerprint-id');
    if (fp) res.setHeader('x-rtb-fingerprint-id', fp);
  } catch (e) {
    // ignore
  }
  next();
});

app.use(cookieParser()); // must run before auth middleware

function getTokenFromReq(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'] || req.headers['x-access-token'];
  if (auth) return auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (req.query && req.query.token) return req.query.token;
  if (req.cookies && req.cookies.token) return req.cookies.token;
  if (req.body && req.body.token) return req.body.token;
  return null;
}

// API Routes
// Serve favicon safely (must be before static middleware)
app.get('/favicon.ico', (req, res) => {
  try {
    const favPath = path.join(__dirname, 'public', 'favicon.ico');
    if (fs.existsSync(favPath)) {
      return res.sendFile(favPath, (err) => {
        if (err) {
          console.warn('favicon sendFile error', err && err.message);
          // don't leak stack to client; return no content
          try { res.status(204).end(); } catch (e) {}
        }
      });
    } else {
      // If no favicon present, return no-content (204) not an error
      return res.status(204).end();
    }
  } catch (err) {
    console.error('favicon handler unexpected error', err && (err.stack || err.message));
    try { res.status(204).end(); } catch (e) {}
  }
});

// Ensure JSON and urlencoded middlewares are available (some routes rely on express.json())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
// mount organizer routes
const organizerRoutes = require('./routes/organizerRoutes');
app.use('/api/organizer', organizerRoutes);
// mount artist routes
const artistRoutes = require('./routes/artistRoutes');
app.use('/api/artist', artistRoutes);

// public key for client
app.get('/api/public/razorpay-key', (req,res) => res.json({ key_id: process.env.RAZORPAY_KEY_ID || '' }));

// webhook is registered in routes/escrowRoutes.js (uses express.raw there)

// Razorpay (or payment gateway) success webhook/endpoint
// Expects body: { razorpay: {...}, booking: {...} }
app.post('/api/payments/success', express.json(), async (req, res) => {
  return paymentController.paymentSuccessHandler(req, res);
});

// Single get-by-id-or-userId route is defined below. Remove duplicate to avoid confusion.

app.get('/api/profile', authMw.ensureAuth, profileController.getProfile);
// Get all profiles (for discover + admin dashboard)
app.get('/api/profiles', profileController.getAllProfiles);

// Get a single profile by userId (for card.html)
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
  const profile = await findProfileByIdOrUserId(userId);

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    const out = profile.toObject ? profile.toObject() : profile;
    out.artistType = out.genre || null;

    res.json(out);
  } catch (err) {
    console.error("Error fetching profile by id/userId:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Create or update a profile (for normal users)
app.post('/api/profile/save', authMw.ensureAuth, authMw.requireSessionRole ? authMw.requireSessionRole('artist') : (req,res,next)=>next(), upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'photos' },
  { name: 'audios' },
  { name: 'videos' },
  { name: 'bannerImage', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Request received at /api/profile/save');
    console.log('req.body:', req.body);
    console.log('req.files:', Object.keys(req.files || {}));

    const { displayName, bio, artistType, price, profileId } = req.body;

    // ✅ Get ownerId securely
    let ownerId = null;
    try {
      const headerToken = req.headers.authorization?.split(' ')[1];
      const token = headerToken || req.cookies?.token || req.body?.token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        ownerId = decoded.userId || decoded.sub || decoded._id || decoded.id || null;
      }
    } catch (err) {
      console.warn('No valid token found in request for /api/profile/save');
    }

    // Strict binding: do not accept arbitrary body.userId here. Require auth token.
    if (!ownerId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Use your existing GCS helper to process uploads
    const uploads = await gcsUpload.handleUploads(req);

    // ✅ Find profile by ownerId first, fallback to profileId if editing existing
    let profile = null;
    if (ownerId) profile = await Profile.findOne({ userId: ownerId });
    if (!profile && profileId && mongoose.Types.ObjectId.isValid(profileId)) {
      profile = await Profile.findById(profileId);
    }
    if (!profile) {
      profile = new Profile({ userId: ownerId });
    }

    // Update fields safely
  if (displayName !== undefined) profile.displayName = displayName;
  if (bio !== undefined) profile.bio = bio;
  // Map artistType -> genre field used in schema
  if (artistType !== undefined) profile.genre = artistType;
  if (price !== undefined && price !== '') profile.price = Number(price) || 0;
  if (req.body.location !== undefined) profile.location = req.body.location;

    // Merge uploaded media (append new items)
    if (uploads.avatarUrl) profile.avatarUrl = uploads.avatarUrl;
    if (uploads.bannerUrl) profile.bannerUrl = uploads.bannerUrl;
    if (uploads.photos && uploads.photos.length) profile.photos = (profile.photos || []).concat(uploads.photos);
    if (uploads.audios && uploads.audios.length) profile.audios = (profile.audios || []).concat(uploads.audios);
    if (uploads.videos && uploads.videos.length) profile.videos = (profile.videos || []).concat(uploads.videos);

    await profile.save();
    return res.json({ success: true, profile });
  } catch (err) {
    console.error('Error in /api/profile/save:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: Update any profile (override existing data)
app.post('/api/admin/profile/update', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'photos' },
  { name: 'audios' },
  { name: 'videos' },
  { name: 'bannerImage', maxCount: 1 }
]), async (req, res) => {
  try {
    // Check admin permissions first (use getTokenFromReq helper instead of undefined extractToken)
    const token = getTokenFromReq(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }
    let adminUser;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      adminUser = await User.findById(decoded.userId || decoded.sub);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid admin token' });
    }

    const permissionCheck = checkAdminPermission(adminUser, 'update');
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ success: false, message: permissionCheck.message });
    }

  // Accept both profileId (document _id) and userId (owner id)
  const { profileId, userId, displayName, bio, artistType, price, location, removedMedia } = req.body;
  console.log('Admin update called for profileId/userId:', profileId, userId);
    // Use the helper exported from gcsUpload module to process multipart files
    const uploads = await gcsUpload.handleUploads(req);

    // Prefer explicit profileId if provided, else try userId
    let profile = null;
    if (profileId) {
      try {
        profile = await Profile.findById(profileId);
      } catch (err) {
        console.warn('Invalid profileId in admin update:', profileId);
      }
    }
    if (!profile) profile = await findProfileByIdOrUserId(userId);
    console.log('Admin update profile lookup result:', !!profile);
    console.log('Admin update profile lookup result:', !!profile);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    // 🔹 Update text fields
  profile.displayName = displayName;
  profile.bio = bio;
  // The Profile schema uses `genre`; map incoming `artistType` to `genre` for compatibility
  if (artistType) profile.genre = artistType;
    profile.price = price;
    profile.location = location;

    // 🔹 Replace media if new uploaded
    if (uploads.avatarUrl) profile.avatarUrl = uploads.avatarUrl;
    if (uploads.bannerUrl) profile.bannerUrl = uploads.bannerUrl;
    if (uploads.photos.length > 0) profile.photos.push(...uploads.photos);
    if (uploads.audios.length > 0) profile.audios.push(...uploads.audios);
    if (uploads.videos.length > 0) profile.videos.push(...uploads.videos);

    // 🔹 Handle removals
    const parsedRemovals = removedMedia ? JSON.parse(removedMedia) : {};
    // When removing by index, remove from highest index to lowest to avoid reindexing issues
    ['photos', 'videos', 'audios'].forEach(type => {
      if (Array.isArray(parsedRemovals[type]) && parsedRemovals[type].length > 0) {
        const indices = parsedRemovals[type]
          .map(i => parseInt(i, 10))
          .filter(n => !Number.isNaN(n))
          .sort((a, b) => b - a);

        indices.forEach(idx => {
          if (profile[type] && profile[type][idx]) profile[type].splice(idx, 1);
        });
      }
    });

    await profile.save();
    res.json({ success: true, profile });

  } catch (err) {
    console.error("Admin update error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Middleware - UPDATE CORS TO INCLUDE YOUR FRONTEND PORT
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:5000', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// remove duplicate express.json() - bodyParser.json() already added above
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true
  },
  // For production, you'd want to use a proper store like Redis or MongoDB
  // For now, disable sessions entirely since we're using JWT
  saveUninitialized: false,
  resave: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Static Files - ENSURE PROPER PATHS
app.use(express.static(path.join(__dirname, 'public')));
app.use('/js', express.static(path.join(__dirname, 'public/js'))); // Add this for JS files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Passport Serialization
passport.serializeUser((user, done) => {
  // Handle both MongoDB User objects and Google profile objects
  if (user._dbUser && user._dbUser._id) {
    // This is a Google profile with attached DB user
    done(null, user._dbUser._id);
  } else if (user._id) {
    // This is a MongoDB User object
    done(null, user._id);
  } else {
    // Fallback - this shouldn't happen but handle gracefully
    console.warn('serializeUser: unexpected user object structure', user);
    done(null, user.id);
  }
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error('deserializeUser error:', err);
    done(err, null);
  }
});

// Google OAuth Strategy (updated to create UserPreferences)
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google OAuth Strategy: profile received', {
          id: profile.id,
          email: profile.emails && profile.emails[0] && profile.emails[0].value,
          displayName: profile.displayName
        });

        // Store the Google profile on the profile object so callback handler can access it
        // The callback handler expects req.user to be the Google profile, not the MongoDB user
        profile._dbUser = null; // We'll store the DB user here for reference if needed

        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
                user.googleId = profile.id;
                await user.save();
            } else {
                user = new User({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    name: profile.displayName,
                    password: Math.random().toString(36).slice(-8),
                    role: 'artist'
                });
                await user.save();
                await new UserPreferences({ userId: user._id }).save(); // Create preferences
            }
        }

        // Grant admin roles based on email
        try {
            const ownerEmail = (profile.emails && profile.emails[0] && profile.emails[0].value) ? profile.emails[0].value : null;
            if (ownerEmail) {
                const emailLower = ownerEmail.toLowerCase();
                if (emailLower === 'shubhamag1412@gmail.com') {
                    user.role = 'admin'; // Full admin access (can delete)
                    await user.save();
                } else if (emailLower === 'connectartistpushp@gmail.com') {
                    user.role = 'admin-create'; // Admin access without delete permission
                    await user.save();
                }
            }
        } catch (err) {
            console.warn('Error checking admin emails for role grant:', err && err.message);
        }

        // Attach the DB user to the profile for the callback handler to use
        profile._dbUser = user;

        // Pass the Google profile to the callback handler (not the MongoDB user)
        done(null, profile);
    } catch (err) {
        console.error('Google OAuth Strategy error:', err);
        done(err, null);
    }
}));
// START GOOGLE OAuth for artist (state='artist')
app.get('/api/auth/google', (req, res, next) => {
  try {
    try { res.clearCookie('session_role'); } catch (e) {}
    return passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',
      state: 'artist'
    })(req, res, next);
  } catch (err) { next(err); }
});
// START GOOGLE OAuth for organizer (state='organizer')
app.get('/api/auth/google/organizer', (req, res, next) => {
  try {
    try { res.clearCookie('session_role'); } catch (e) {}
    return passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',
      state: 'organizer'
    })(req, res, next);
  } catch (err) { next(err); }
});

app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login.html' }), authController.handleOAuthCallback);

// Simple organizer gate endpoint that clients can call to decide if they should show organizer dashboard
app.get('/api/auth/session-role', authMw.ensureAuth, (req, res) => {
  return res.json({ sessionRole: req.sessionRole || (req.authPayload && req.authPayload.sessionRole) || null, role: (req.user && req.user.role) || null });
});

// Database Connection
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

// API Routes
app.use('/api', authRoutes);
// Escrow / booking routes (create-order + booking status + confirmation PDF)
const escrowRoutes = require('./routes/escrowRoutes');
app.use('/api/escrow', escrowRoutes);

// Debug routes for local testing
try {
  const debugRoutes = require('./routes/debugRoutes');
  app.use('/api/debug', debugRoutes);
} catch (e) { console.warn('Could not mount debugRoutes', e && e.message); }

// add this (preferably near other app.use route registrations)
const bookingsRoutes = require('./routes/bookingsRoutes');
app.use('/api/bookings', bookingsRoutes);

// Logout endpoint to clear server-set cookie
app.post('/api/auth/logout', (req, res) => {
  try {
    // Clear the token cookie using same options as when it was set to ensure proper removal
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
    try { res.clearCookie('session_role', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }); } catch (e) {}
  } catch (e) { /* ignore */ }
  return res.json({ success: true });
});

// Also support GET logout which clears cookie and redirects (useful for full-navigation logout)
app.get('/api/auth/logout', (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
    try { res.clearCookie('session_role', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }); } catch (e) {}
  } catch (e) { /* ignore */ }
  const redirectTo = req.query.redirect || '/frontend.html';
  return res.redirect(redirectTo);
});

// Token refresh endpoint
app.post('/api/auth/refresh', authMw.refreshToken);

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  };

  // Check PDF generation capability
  try {
    const puppeteer = require('puppeteer');
    health.pdfGeneration = {
      puppeteerAvailable: true,
      cacheDir: process.env.PUPPETEER_CACHE_DIR || 'default'
    };
  } catch (error) {
    health.pdfGeneration = {
      puppeteerAvailable: false,
      error: error.message
    };
  }

  res.status(200).json(health);
});

// Serve profile.html
app.get('/profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// New: Serve view-profile.html
app.get('/view-profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'view-profile.html'));
});

// Organizer dashboard page (static)
app.get('/organizer/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'organizerDashboard.html'));
});

// Shared profile endpoint (updated to increment viewCount)
app.get('/api/profile/shared/:userId', async (req, res) => {
    try {
  const profile = await findProfileByIdOrUserId(req.params.userId);
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        profile.viewCount += 1;
        await profile.save();
        res.json(profile);
    } catch (error) {
        console.error('Error fetching shared profile:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// New endpoint: Like profile
app.post('/api/profile/:userId/like', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Authorization token required' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const profile = await findProfileByIdOrUserId(req.params.userId);
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        const userPrefs = await UserPreferences.findOne({ userId: decoded.userId });
        if (!userPrefs) {
            return res.status(404).json({ message: 'User preferences not found' });
        }
        const alreadyLiked = userPrefs.likedArtists.some(artist => artist.artistId === req.params.userId);
        if (alreadyLiked) {
            return res.status(400).json({ message: 'Profile already liked' });
        }
        userPrefs.likedArtists.push({ artistId: req.params.userId });
        if (profile.genre) {
            userPrefs.preferredGenres.push({ genre: profile.genre });
        }
        profile.likeCount += 1;
        await Promise.all([userPrefs.save(), profile.save()]);
        res.json({ message: 'Profile liked', likeCount: profile.likeCount });
    } catch (error) {
        console.error('Error liking profile:', error);
        res.status(500).json({ message: 'Error liking profile' });
    }
});

// New endpoint: Share profile
app.post('/api/profile/:userId/share', async (req, res) => {
    try {
  const profile = await findProfileByIdOrUserId(req.params.userId);
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        profile.shareCount += 1;
        await profile.save();
        res.json({ message: 'Profile shared', shareCount: profile.shareCount });
    } catch (error) {
        console.error('Error sharing profile:', error);
        res.status(500).json({ message: 'Error sharing profile' });
    }
});

// New endpoint: Comment on profile
app.post('/api/profile/:userId/comment', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Authorization token required' });
        }
        const { text } = req.body;
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ message: 'Comment text is required' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const profile = await Profile.findOne({ userId: req.params.userId });
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        profile.comments.push({
            userId: decoded.userId,
            username: user.name,
            text: text.trim()
        });
        await profile.save();
        res.json({ message: 'Comment added', comments: profile.comments });
    } catch (error) {
        console.error('Error commenting on profile:', error);
        res.status(500).json({ message: 'Error commenting on profile' });
    }
});

// New endpoint: Artist registration count
app.get('/api/analytics/artist-count', async (req, res) => {
    try {
        const count = await User.countDocuments({ role: 'artist' });
        res.json({ artistCount: count });
    } catch (error) {
        console.error('Error fetching artist count:', error);
        res.status(500).json({ message: 'Error fetching artist count' });
    }
});

// New endpoint: Featured artists
app.get('/api/analytics/featured-artists', async (req, res) => {
    try {
        const { period = 'day', sortBy = 'viewCount' } = req.query;
        let dateFilter = {};
        const now = new Date();
        if (period === 'day') {
            dateFilter = { updatedAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) } };
        } else if (period === 'week') {
            dateFilter = { updatedAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
        } else if (period === 'month') {
            dateFilter = { updatedAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
        }
        const artists = await Profile.find(dateFilter)
            .sort({ [sortBy]: -1 })
            .limit(4)
            .populate('userId', 'name');
        res.json(artists);
    } catch (error) {
        console.error('Error fetching featured artists:', error);
        res.status(500).json({ message: 'Error fetching featured artists' });
    }
});

// New endpoint: Audience preferences
app.get('/api/analytics/audience-preferences', async (req, res) => {
    try {
        const preferences = await UserPreferences.aggregate([
            { $unwind: '$preferredGenres' },
            {
                $group: {
                    _id: '$preferredGenres.genre',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        res.json(preferences);
    } catch (error) {
        console.error('Error fetching audience preferences:', error);
        res.status(500).json({ message: 'Error fetching audience preferences' });
    }
});

// New endpoint: Create booking
app.post('/api/booking', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Authorization token required' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { artistId, eventDate, eventTime, eventLocation, additionalRequirements } = req.body;
        if (!artistId || !eventDate || !eventTime || !eventLocation) {
            return res.status(400).json({ message: 'Missing required booking fields' });
        }
        const booking = new Booking({
            userId: decoded.userId,
            artistId,
            eventDate,
            eventTime,
            eventLocation,
            additionalRequirements
        });
        await booking.save();
        res.json({ message: 'Booking created', booking });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ message: 'Error creating booking' });
    }
});

// Instagram OAuth (updated to create UserPreferences)
app.get('/api/auth/instagram/login-url', (req, res) => {
    const loginUrl = `https://api.instagram.com/oauth/authorize` +
        `?client_id=${process.env.INSTAGRAM_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}` +
        `&scope=user_profile,user_media` +
        `&response_type=code`;
    console.log('Generated Instagram login URL:', loginUrl);
    res.json({ url: loginUrl });
});

app.get('/api/auth/instagram/callback', async (req, res) => {
    console.log('Instagram callback URL:', req.originalUrl);
    console.log('Query parameters:', req.query);
    const code = req.query.code;
    const redirectUri = process.env.REDIRECT_URI;
    if (!code) {
        return res.status(400).send(`Missing code parameter. Got query: ${JSON.stringify(req.query)}`);
    }
    try {
        console.log('Sending to Instagram:', {
            client_id: process.env.INSTAGRAM_CLIENT_ID,
            client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code,
        });
        const tokenResponse = await axios.post('https://api.instagram.com/oauth/access_token', null, {
            params: {
                client_id: process.env.INSTAGRAM_CLIENT_ID,
                client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code,
            },
        });
        const access_token = tokenResponse.data.access_token;
        const user_id = tokenResponse.data.user_id;
        const userResponse = await axios.get('https://graph.instagram.com/me', {
            params: {
                fields: 'id,username,account_type,media_count',
                access_token,
            },
        });
        let user = await User.findOne({ instagramId: userResponse.data.id });
        if (!user) {
            user = new User({
                instagramId: userResponse.data.id,
                name: userResponse.data.username,
                email: `${userResponse.data.username}@instagram.com`,
                password: Math.random().toString(36).slice(-8),
                role: 'artist'
            });
            await user.save();
            await new UserPreferences({ userId: user._id }).save(); // Create preferences
        }
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.redirect(`/login.html?token=${token}&userId=${user._id}`);
    } catch (error) {
        console.error('Instagram OAuth error:', error.response?.data || error.message);
        res.redirect('/login.html?error=instagram_login_failed');
    }
});

// Error Handling Middleware - ENHANCED
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Multer setup for media uploads


// Get All Profiles for Discover Page
// (Duplicate inline GET /api/profiles removed; controller-based route earlier handles this)

// Edit profile
app.put('/api/profiles/:id', async (req, res) => {
  try {
    const { displayName, bio, artistType, price } = req.body;
    const profile = await Profile.findByIdAndUpdate(
      req.params.id,
      { displayName, bio, artistType, price },
      { new: true }
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// Delete profile
app.delete('/api/profiles/:id', async (req, res) => {
  try {
    // Check admin permissions - delete requires full admin role
    const token = getTokenFromReq(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }

    let adminUser;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      adminUser = await User.findById(decoded.userId || decoded.sub);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid admin token' });
    }

    const permissionCheck = checkAdminPermission(adminUser, 'delete');
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ success: false, message: permissionCheck.message });
    }

    const profile = await Profile.findByIdAndDelete(req.params.id);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete profile.' });
  }
});

// [Socket.IO configuration remains the same]



// Catch-all route (updated to serve discover.html)
app.get(/^\/(?!api).*/, (req, res) => {
    if (req.path === '/signup.html') {
        res.sendFile(path.join(__dirname, 'public', 'signup.html'));
    } else if (req.path === '/login.html') {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    } else if (req.path === '/discover.html') {
        res.sendFile(path.join(__dirname, 'public', 'discover.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'frontend.html'));
    }
});

// Helper: read token from common locations
function getTokenFromReq(req) {
  // 1) Authorization header (Bearer <token>) or plain token header
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || req.headers['x-access-token'];
  if (authHeader) {
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
    return authHeader;
  }

  // 2) Query string ?token=...
  if (req.query && req.query.token) return req.query.token;

  // 3) Cookie (cookie-parser must be used)
  if (req.cookies && req.cookies.token) return req.cookies.token;

  // 4) Body (works if multer/body-parser has run before auth for that route)
  if (req.body && req.body.token) return req.body.token;

  return null;
}

// ---------- Backwards-compatible alias (some legacy handlers used extractToken) ----------
function extractToken(req) {
  return getTokenFromReq(req);
}

// Helper function to check admin permissions
function checkAdminPermission(user, requiredPermission = 'read') {
  if (!user || (!user.role || (user.role !== 'admin' && user.role !== 'admin-create'))) {
    return { hasPermission: false, message: 'Admin access required' };
  }

  // Full admin has all permissions
  if (user.role === 'admin') {
    return { hasPermission: true };
  }

  // admin-create has limited permissions
  if (user.role === 'admin-create') {
    const allowedPermissions = ['read', 'create', 'update', 'reset-password'];
    if (allowedPermissions.includes(requiredPermission)) {
      return { hasPermission: true };
    } else {
      return { hasPermission: false, message: 'Insufficient admin permissions. Cannot delete profiles.' };
    }
  }

  return { hasPermission: false, message: 'Invalid admin role' };
}


// Admin: Create artist (admin must be authenticated) - accepts provided email & password and stores encrypted copy
app.post('/api/admin/create-artist', authMw.ensureAuth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    const permissionCheck = checkAdminPermission(adminUser, 'create');
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ success: false, message: permissionCheck.message });
    }

    let { name, email, password } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, message: 'name and email required' });
    // If admin UI omitted password, generate a secure random one and return it to the caller
    const crypto = require('crypto');
    const genPassword = () => {
      // base64 then strip non-alphanum to ensure length and safety
      return crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    };
    if (!password || typeof password !== 'string' || password.length < 6) {
      // Replace weak or missing password with a generated one to satisfy schema validation
      const old = password;
      password = genPassword();
      console.warn(`Admin create-artist: replaced weak/missing password (${old}) with generated password`);
    }

    // Prevent duplicate user email
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });

    // create user - User schema will hash password in pre-save hook
    const user = new User({
      name,
      email,
      password,
      role: 'artist',
      createdByAdmin: true // OPTIONAL flag - add this field to User schema if you want
    });
    await user.save();

    // create empty profile linked to user
    const profile = new Profile({ userId: user._id, displayName: name, createdByAdmin: true });
    await profile.save();

    // save encrypted credential for admin viewing
    const encrypted = encrypt(password);
    const cred = new AdminCredential({
      userId: user._id,
      adminId: adminUser._id,
      email,
      passwordEncrypted: encrypted
    });
    await cred.save();

  // Return created credentials (password is only returned here for admin to copy)
  return res.json({ success: true, message: 'Artist created', userId: user._id, email: user.email, password });
  } catch (err) {
    console.error('create-artist error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: Reset user's password (admin must be authenticated)
app.post('/api/admin/reset-password', authMw.ensureAuth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    const permissionCheck = checkAdminPermission(adminUser, 'reset-password');
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ success: false, message: permissionCheck.message });
    }
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const newPassword = Math.random().toString(36).slice(-10);
    user.password = newPassword;
    // optionally reset passwordChangeCount so user can change without phone first time
    user.passwordChangeCount = 0;
    await user.save();

    return res.json({ success: true, message: 'Password reset', email: user.email, password: newPassword, userId: user._id });
  } catch (err) {
    console.error('reset-password error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: List all artist accounts (no passwords)
app.get('/api/admin/list-artists', authMw.ensureAuth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    const permissionCheck = checkAdminPermission(adminUser, 'read');
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ success: false, message: permissionCheck.message });
    }

    const artists = await User.find({ role: 'artist' })
      .select('name email _id createdAt'); // exclude password
    return res.json({ success: true, artists });
  } catch (err) {
    console.error('list-artists error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: List all organizer accounts (with lightweight profile enrichment if exists)
app.get('/api/admin/list-organizers', authMw.ensureAuth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    const permissionCheck = checkAdminPermission(adminUser, 'read');
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ success: false, message: permissionCheck.message });
    }

    const organizers = await User.find({ role: 'organizer' })
      .select('name email _id createdAt');

    const userIds = organizers.map(o => o._id);
    let profileMap = {};
    if (userIds.length) {
      const profiles = await Profile.find({ userId: { $in: userIds } });
      profiles.forEach(p => {
        profileMap[p.userId.toString()] = {
          _id: p._id,
          userId: p.userId,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          bannerUrl: p.bannerUrl,
          artistType: p.genre || p.artistType, // normalize for frontend
          location: p.location,
          bio: p.bio,
          price: p.price,
          viewCount: p.viewCount,
          likeCount: p.likeCount,
          shareCount: p.shareCount,
          photos: p.photos,
          videos: p.videos,
          audios: p.audios
        };
      });
    }

    const result = organizers.map(o => ({
      _id: o._id,
      name: o.name,
      email: o.email,
      createdAt: o.createdAt,
      profile: profileMap[o._id.toString()] || null
    }));

    return res.json({ success: true, organizers: result });
  } catch (err) {
    console.error('list-organizers error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: List all events (bookings) with enrichment
app.get('/api/admin/list-events', authMw.ensureAuth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    const permissionCheck = checkAdminPermission(adminUser, 'read');
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ success: false, message: permissionCheck.message });
    }

    const bookings = await Booking.find({}).sort({ createdAt: -1 }).lean();

    const artistIdSet = new Set();
    const organizerIdSet = new Set();
    bookings.forEach(b => {
      if (b.artistId) artistIdSet.add(String(b.artistId));
      if (b.organizerId) organizerIdSet.add(String(b.organizerId));
      if (b.userId) organizerIdSet.add(String(b.userId)); // fallback if organizer stored as userId
    });

    const toObjAndStr = (arr) => {
      const objIds = arr.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      const strIds = arr.filter(id => !mongoose.Types.ObjectId.isValid(id));
      return { objIds, strIds };
    };

    const artistParts = toObjAndStr(Array.from(artistIdSet));
    const organizerParts = toObjAndStr(Array.from(organizerIdSet));

    const buildProfileQuery = (parts) => {
      const clauses = [];
      if (parts.objIds.length) clauses.push({ _id: { $in: parts.objIds } });
      if (parts.strIds.length) clauses.push({ _id: { $in: parts.strIds } });
      if (parts.objIds.length) clauses.push({ userId: { $in: parts.objIds } });
      if (parts.strIds.length) clauses.push({ userId: { $in: parts.strIds } });
      return clauses.length ? { $or: clauses } : null;
    };

    const artistProfileQuery = buildProfileQuery(artistParts);
    const organizerProfileQuery = buildProfileQuery(organizerParts);

    let artistProfiles = [];
    let organizerProfiles = [];
    if (artistProfileQuery) {
      try { artistProfiles = await Profile.find(artistProfileQuery).lean(); } catch (e) { artistProfiles = []; }
    }
    if (organizerProfileQuery) {
      try { organizerProfiles = await Profile.find(organizerProfileQuery).lean(); } catch (e) { organizerProfiles = []; }
    }

    const profileById = {};
    const profileByUserId = {};
    [...artistProfiles, ...organizerProfiles].forEach(p => {
      if (p._id) profileById[String(p._id)] = p;
      if (p.userId) profileByUserId[String(p.userId)] = p;
    });

    let organizerUsers = [];
    if (organizerParts.objIds.length) {
      try { organizerUsers = await User.find({ _id: { $in: organizerParts.objIds } }).select('name email _id').lean(); } catch (e) { organizerUsers = []; }
    }
    const organizerUserMap = {};
    organizerUsers.forEach(u => { organizerUserMap[String(u._id)] = u; });

    const events = bookings.map(b => {
      const artistKey = b.artistId ? String(b.artistId) : null;
      const organizerKey = b.organizerId ? String(b.organizerId) : (b.userId ? String(b.userId) : null);
      const artistProfile = artistKey && (profileById[artistKey] || profileByUserId[artistKey]) || null;
      const organizerProfile = organizerKey && (profileById[organizerKey] || profileByUserId[organizerKey]) || null;
      const organizerUser = organizerKey && organizerUserMap[organizerKey] || null;
      return { booking: b, artistProfile, organizerProfile, organizerUser };
    });

    return res.json({ success: true, events });
  } catch (err) {
    console.error('admin list-events error', err && (err.stack || err.message));
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: Update booking status (pending/confirmed/cancelled/completed)
app.post('/api/admin/bookings/:id/status', authMw.ensureAuth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    const permissionCheck = checkAdminPermission(adminUser, 'update');
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ success: false, message: permissionCheck.message });
    }

    const bookingId = req.params.id;
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const booking = await Booking.findByIdAndUpdate(bookingId, { status }, { new: true }).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Optional realtime emit (ignore errors quietly)
    try {
      if (typeof io !== 'undefined' && io && booking.organizerId) {
        io.to(String(booking.organizerId)).emit('booking:status-updated', { bookingId: booking._id, status });
      }
    } catch (e) { /* ignore */ }

    return res.json({ success: true, booking });
  } catch (err) {
    console.error('admin update booking status error', err && (err.stack || err.message));
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: List stored credentials created by this admin (decrypted)
app.get('/api/admin/list-credentials', authMw.ensureAuth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.userId);
    const permissionCheck = checkAdminPermission(adminUser, 'read');
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ success: false, message: permissionCheck.message });
    }

    // Fetch creds created by this admin (change filter to {} to list all admin-created creds)
    const creds = await AdminCredential.find({ adminId: adminUser._id }).sort({ createdAt: -1 });

    const result = creds.map(c => {
      let password = '';
      try { password = decrypt(c.passwordEncrypted); } catch (e) { password = 'decrypt_error'; }
      return {
        userId: c.userId,
        email: c.email,
        password,
        createdAt: c.createdAt
      };
    });

    return res.json({ success: true, credentials: result });
  } catch (err) {
    console.error('list-credentials error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current admin user info (including role)
app.get('/api/admin/user-info', authMw.ensureAuth, async (req, res) => {
  try {
    const adminUser = req.user; // ensureAuth attached
    if (!adminUser) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const elevated = (adminUser.role === 'admin' || adminUser.role === 'admin-create' || adminUser.isAdmin);
    if (!elevated) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    return res.json({
      success: true,
      user: {
        id: adminUser._id,
        email: adminUser.email,
        role: adminUser.role,
        isAdmin: !!adminUser.isAdmin
      }
    });
  } catch (err) {
    console.error('admin user-info error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Authentication middleware
function authenticateUser(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// Get artist profile by ID
app.get('/api/artists/:id', async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id)
      .populate('videos')
      .populate('audios')
      .populate('photos')
      .populate('comments.user', 'username avatarUrl');

    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist not found' });
    }

    // Increment view count
    artist.views = (artist.views || 0) + 1;
    await artist.save();

    res.json({ success: true, ...artist.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Like an artist profile
app.post('/api/profiles/:id/like', authenticateUser, async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist not found' });
    }

    const userId = req.user._id;
    const likeIndex = artist.likes.indexOf(userId);

    if (likeIndex === -1) {
      artist.likes.push(userId);
    } else {
      artist.likes.splice(likeIndex, 1);
    }

    await artist.save();
    res.json({ success: true, likes: artist.likes.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Track profile shares
app.post('/api/profiles/:id/share', async (req, res) => {
  try {
    const artist = await Artist.findByIdAndUpdate(
      req.params.id,
      { $inc: { shares: 1 } },
      { new: true }
    );
    res.json({ success: true, shares: artist.shares });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Add comment to profile
app.post('/api/profiles/:id/comment', authenticateUser, async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) {
      return res.status(404).json({ success: false, message: 'Artist not found' });
    }

    const newComment = {
      text: req.body.text,
      user: req.user._id,
      username: req.user.username,
      userAvatar: req.user.avatarUrl,
      timestamp: new Date()
    };

    artist.comments.unshift(newComment);
    await artist.save();

    res.json({
      success: true,
      comment: newComment
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Get shared profile (public view)
app.get('/api/profile/shared/:id', async (req, res) => {
  try {
    const artist = await Artist.findOne({ shareableId: req.params.id })
      .populate('videos')
      .populate('audios')
      .populate('photos')
      .populate('comments.user', 'username avatarUrl');

    if (!artist) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    res.json({ success: true, ...artist.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// GCS is handled by service modules (services/gcsClient.js, gcsUpload.js) which
// initialize the Storage client lazily when needed. This avoids startup errors
// when the GCS bucket is not configured in the environment.

// ✅ CORRECTED: Single route to get a profile by its unique _id
app.get('/api/profiles/:id', async (req, res) => {
  try {
    // Find the profile using either its primary key (_id) or the owner's userId
    const requestedId = req.params.id;
    let profile = null;
    // Try by ObjectId first when possible
    if (mongoose.Types.ObjectId.isValid(requestedId)) {
      profile = await Profile.findById(requestedId);
    }
    // Fallback: try to find by profile.userId (string identifier)
    if (!profile) {
      profile = await Profile.findOne({ userId: requestedId });
    }

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Increment view count for tracking
    profile.viewCount = (profile.viewCount || 0) + 1;
    await profile.save();

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Error fetching profile by ID:', error);
    // Handle cases like an invalid ID format
    if (error.kind === 'ObjectId') {
        return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ⛔️ IMPORTANT: Delete all other /api/profile/:userId, /api/profile/shared/:userId,
// and /api/artists/:id routes from your server.js file to avoid conflicts.


// ✅ Mount profileRoutes only once, after inline handlers
app.use('/api/profile', profileRoutes);

// Global error handler to catch any unhandled errors
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

let server;

// For Render deployment, use HTTP server (Render handles SSL termination)
// For local development, try HTTPS if certificates exist, fallback to HTTP
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
  // Production/Render: Use HTTP server
  server = http.createServer(app);
  console.log('Using HTTP server for production deployment');
} else {
  // Local development: Try HTTPS with certificates, fallback to HTTP
  try {
    const keyPath = path.join(__dirname, 'key.pem');
    const certPath = path.join(__dirname, 'cert.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      const privateKey = fs.readFileSync(keyPath, 'utf8');
      const certificate = fs.readFileSync(certPath, 'utf8');
      const credentials = { key: privateKey, cert: certificate };
      server = https.createServer(credentials, app);
      console.log('Using HTTPS server for local development');
    } else {
      server = http.createServer(app);
      console.log('SSL certificates not found, using HTTP server for local development');
    }
  } catch (err) {
    console.warn('Failed to setup HTTPS, falling back to HTTP:', err.message);
    server = http.createServer(app);
  }
}
const PORT = process.env.PORT || 5000;

// Start Server - ADD BETTER ERROR HANDLING
async function startServer() {
  try {
    await connectDB();

    // Render requires binding to 0.0.0.0, not localhost
    // Check multiple Render environment indicators
    const isRender = process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_SERVICE_NAME;
    const isProduction = process.env.NODE_ENV === 'production';
    const host = isProduction || isRender ? '0.0.0.0' : 'localhost';
    const protocol = server instanceof https.Server ? 'https' : 'http';

    console.log(`🔧 Environment Detection:`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`   RENDER: ${process.env.RENDER || 'undefined'}`);
    console.log(`   Using host: ${host}`);
    console.log(`   Server type: ${protocol.toUpperCase()}`);

    server.listen(PORT, host, () => {
      console.log(`🚀 Server is running on ${protocol}://${host}:${PORT}/`);
      console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔑 JWT Expiry: ${process.env.TOKEN_EXPIRES_IN || '7d'}`);
    });
  } catch (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
}

startServer();

// Global Express error handler (should be after all routes)
app.use((err, req, res, next) => {
  console.error('UNCAUGHT EXPRESS ERROR:', err && err.stack ? err.stack : err);
  const resp = { success: false, message: 'Internal server error' };
  if (process.env.NODE_ENV !== 'production') resp.error = err && err.message ? err.message : String(err);
  res.status(500).json(resp);
});

// Simple HTTP proxy at port 3000 to accept requests from file:// pages or HTTP
// clients and forward them to the HTTPS server. This avoids browser TLS errors
// when the frontend is opened directly from the filesystem and the server uses
// a self-signed certificate.
// ONLY RUN IN DEVELOPMENT - Render doesn't need this proxy
const isRender = process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_SERVICE_NAME;
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction && !isRender) {
  const REDIRECT_PORT = process.env.HTTP_PORT || 3000;
  try {
    // determine whether the target server is HTTPS or HTTP
    const targetIsHttps = server instanceof https.Server;
    const targetProtocol = targetIsHttps ? 'https' : 'http';

    const proxyServer = http.createServer((req, res) => {
      // Handle favicon requests locally to prevent 500 errors
      if (req.url === '/favicon.ico') {
        console.log('Proxy: Favicon request handled locally');
        res.writeHead(204, { 'Content-Type': 'image/x-icon' });
        res.end();
        return;
      }

      // Collect request body
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const options = {
          hostname: 'localhost',
          port: PORT,
          path: req.url,
          method: req.method,
          headers: Object.assign({}, req.headers)
        };

        // Remove hop-by-hop headers that may confuse the target
        delete options.headers['host'];
        delete options.headers['content-length'];

        // Choose proper request function based on target protocol to avoid TLS negotiation against an HTTP server
        const requestLib = targetIsHttps ? https : http;
        if (targetIsHttps) options.rejectUnauthorized = false;

        const proxyReq = requestLib.request(options, proxyRes => {
          // Forward status and headers
          try {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          } catch (err) {
            console.warn('Proxy response forward error', err && err.message);
            try { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('Bad Gateway'); } catch(e){}
          }
        });

        proxyReq.on('error', err => {
          console.warn('Proxy request error', err && (err.message || err));
          try { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('Bad Gateway'); } catch(e){}
        });

        if (body && body.length) proxyReq.write(body);
        proxyReq.end();
      });
    });

    proxyServer.listen(REDIRECT_PORT, () => console.log(`🔄 HTTP proxy listening on http://localhost:${REDIRECT_PORT} -> ${targetProtocol}://localhost:${PORT}`));
  } catch (err) {
    console.warn('Failed to start HTTP proxy:', err && err.message);
  }
} else {
  console.log('🚫 Skipping HTTP proxy in production/Render environment');
}
