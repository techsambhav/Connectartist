const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { issueToken, getTokenFromReq } = require('../middleware/auth');
const UserPreferences = require('../models/UserPreferences');
const authMw = require('../middleware/auth');
const crypto = require('crypto');

function randomPassword() {
  return crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
}

// Temporary in-memory OTP store for phone verification.
// For production use a persistent store (Redis, DB) and integrate with an SMS provider.
const otpStore = new Map();

exports.register = async (req, res) => {
  try {
    // Accept all fields from frontend
    const { name, email, password, artistType, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    // Pass all fields to User model
    const user = new User({ name, email, password, artistType, role }); // Password will be hashed by pre-save hook
    await user.save();
    
  // Issue token and set cookie; default sessionRole to 'artist' for regular signup
  const token = issueToken(user, res, { sessionRole: 'artist' });
  res.status(201).json({ token, userId: user._id, role: user.role });
  } catch (error) {
    // Log the error for debugging purposes
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Authentication failed: Invalid email or password' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Authentication failed: Invalid email or password' });
    }
    
  const token = issueToken(user, res, { sessionRole: 'artist' });
  res.json({ token, userId: user._id, role: user.role });
  } catch (error) {
    // Log the error for debugging purposes
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Server error during login' });
  }
};

// OAuth callback helper for routes that use passport or other OAuth flows
// Safe OAuth upsert helper: create user with default persistent role 'artist' when missing,
// but DO NOT overwrite existing user.role (prevents accidental conversions).
exports.handleOAuthUpsert = async (profileObj, res, redirectToDashboard) => {
  const profile = profileObj;
  if (!profile || (!profile.emails && !profile.email)) {
    throw new Error('Missing profile');
  }
  const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || profile.email;
  const name = profile.displayName || profile.name || '';
  const photo = (profile.photos && profile.photos[0] && profile.photos[0].value) || profile.photo || '';
  const googleId = profile.id || profile.sub;

  // Find existing user by googleId first, then by email
  let userDoc = await User.findOne({ googleId });
  if (!userDoc) userDoc = await User.findOne({ email });

  if (!userDoc) {
    // create new user; default persistent role remains 'artist'
    userDoc = new User({
      googleId,
      email,
      name,
      photoUrl: photo,
      role: 'artist'
    });
    await userDoc.save();
    try { await new UserPreferences({ userId: userDoc._id }).save(); } catch (e) { /* ignore */ }
  } else {
    // update profile fields if missing but preserve existing userDoc.role
    let changed = false;
    if (!userDoc.googleId && googleId) { userDoc.googleId = googleId; changed = true; }
    if (!userDoc.name && name) { userDoc.name = name; changed = true; }
    if (!userDoc.photoUrl && photo) { userDoc.photoUrl = photo; changed = true; }
    if (!userDoc.email && email) { userDoc.email = email; changed = true; }
    if (changed) await userDoc.save();
  }

  // Issue token with sessionRole (organizer iff redirectToDashboard true)
  const token = issueToken(userDoc, res, { sessionRole: redirectToDashboard ? 'organizer' : 'artist' });

  if (redirectToDashboard) {
    return { redirect: '/organizerDashboard.html' };
  }
  return { token, user: { _id: userDoc._id, email: userDoc.email, name: userDoc.name } };
};


// Change password (requires token or body.token). If user already changed password once,
// require phoneVerified to be true before allowing another change.
exports.changePassword = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.body.token;
    if (!token) return res.status(401).json({ message: 'No auth token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Missing passwords' });

    // if user already changed password once, require phone verification
    if ((user.passwordChangeCount || 0) >= 1 && !user.phoneVerified) {
      return res.status(403).json({ message: 'Phone verification required to change password again' });
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) return res.status(401).json({ message: 'Old password incorrect' });

    user.password = newPassword;
    user.passwordChangeCount = (user.passwordChangeCount || 0) + 1;
    await user.save();
    return res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    console.error('changePassword error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Link phone (send OTP) - placeholder implementation
exports.linkPhone = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: 'phoneNumber required' });

    // Generate a 6-digit OTP and store temporarily
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phoneNumber, { otp, createdAt: Date.now() });

    // TODO: integrate with SMS provider (Twilio/Gupshup) to send the OTP
    console.log(`Simulated sending OTP ${otp} to ${phoneNumber}`);

    return res.json({ success: true, message: 'OTP sent (simulated)' });
  } catch (err) {
    console.error('linkPhone error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Verify phone (check OTP) - placeholder implementation
exports.verifyPhone = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.body.token;
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) return res.status(400).json({ message: 'phoneNumber and otp required' });

    const entry = otpStore.get(phoneNumber);
    if (!entry) return res.status(400).json({ message: 'No OTP requested for this number' });
    if (entry.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });

    // If token present, link phone to authenticated user
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        user.phoneNumber = phoneNumber;
        user.phoneVerified = true;
        await user.save();
        otpStore.delete(phoneNumber);
        return res.json({ success: true, message: 'Phone verified and linked' });
      } catch (err) {
        console.warn('Token invalid during verifyPhone:', err && err.message);
        // fall through to response below if token invalid
      }
    }

    // If no token, simply acknowledge verification (admin flow may set phone via other means)
    otpStore.delete(phoneNumber);
    return res.json({ success: true, message: 'Phone verified (no user linked)' });
  } catch (err) {
    console.error('verifyPhone error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// OAuth callback handler — sets transient sessionRole, leaves persistent user.role unchanged
exports.handleOAuthCallback = async (req, res) => {
  try {
    const profile = req.user;
    console.log('OAuth callback: received profile', { 
      hasProfile: !!profile, 
      hasEmails: !!(profile && profile.emails && profile.emails.length),
      hasDbUser: !!(profile && profile._dbUser)
    });
    
    if (!profile || !(profile.emails && profile.emails.length)) {
      console.error('OAuth callback: missing profile or email', { profile });
      return res.redirect('/login.html?error=oauth_profile_missing');
    }

    // Use the DB user that was attached by the Passport strategy
    let user = profile._dbUser;
    
    if (!user) {
      console.error('OAuth callback: no DB user attached to profile');
      return res.redirect('/login.html?error=oauth_db_user_missing');
    }

    // Prefer OAuth state parameter for role intent, fallback to legacy cookie if present
    const oauthState = (req.query && req.query.state) ? String(req.query.state) : null;
    const oauthRedirectCookie = (req.cookies && req.cookies.oauth_redirect) ? String(req.cookies.oauth_redirect) : ((req.query && req.query.oauth_redirect) || null);
    const oauthIntent = oauthState || oauthRedirectCookie || null;
    const sessionRole = (oauthIntent === 'organizer') ? 'organizer' : 'artist';

    // Persist organizer role if intent is organizer and user is not already admin / admin-create.
    try {
      if (sessionRole === 'organizer' && user && user.role && !['admin','admin-create','organizer'].includes(user.role)) {
        user.role = 'organizer';
        await user.save();
      } else if (sessionRole === 'organizer' && user && !user.role) { // user.role missing
        user.role = 'organizer';
        await user.save();
      }
    } catch (persistErr) {
      console.warn('OAuth callback: failed to persist organizer role', persistErr && persistErr.message);
    }

    console.log('OAuth callback: determined sessionRole', { oauthState, oauthRedirectCookie, sessionRole });

    try { res.clearCookie('oauth_redirect'); } catch (e) {}

    const token = authMw.issueToken(user, res, { sessionRole });

    const redirectTarget = (sessionRole === 'organizer') ? '/organizerDashboard.html' : '/profile.html';
    const safeToken = token || '';
    const safeUserId = user && user._id ? String(user._id) : '';
    const safeRole = sessionRole;
    const safeEmail = user && user.email ? user.email : '';

    console.log('OAuth callback: issuing token and redirecting', { 
      redirectTarget, 
      sessionRole, 
      userId: safeUserId,
      hasToken: !!safeToken 
    });

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Login complete</title></head><body>
      <script>
        try {
          if (window && window.localStorage) {
            ${JSON.stringify(safeToken)} && localStorage.setItem('token', ${JSON.stringify(safeToken)});
            ${JSON.stringify(safeUserId)} && localStorage.setItem('userId', ${JSON.stringify(safeUserId)});
            ${JSON.stringify(safeRole)} && localStorage.setItem('role', ${JSON.stringify(safeRole)});
            ${JSON.stringify(safeEmail)} && localStorage.setItem('userEmail', ${JSON.stringify(safeEmail)});
            if (${JSON.stringify(safeRole)} === 'organizer') {
              localStorage.removeItem('artistDraftProfile');
            } else {
              localStorage.removeItem('organizerFilterState');
            }
          }
        } catch(e){
          console.error('localStorage error:', e);
        }
        window.location.replace(${JSON.stringify(redirectTarget)});
      </script>
      <noscript>Login complete. <a href="${redirectTarget}">Continue</a></noscript>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    console.error('OAuth callback unexpected error', err && (err.stack || err.message || err));
    try { if (!res.headersSent) res.status(500).send('OAuth login failed'); else res.end(); } catch (e) {}
    return;
  }
};// Return the authenticated user's basic info
exports.me = async (req, res) => {
  try {
    // middleware/ensureAuth attaches req.user
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const u = req.user;
    return res.json({ user: { _id: u._id, email: u.email, name: u.name, role: u.role, photoUrl: u.photoUrl || u.avatar } });
  } catch (err) {
    console.error('me error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
