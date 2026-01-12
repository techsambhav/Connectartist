const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SECRET = process.env.JWT_SECRET || 'replace_this_with_env_secret';

function getTokenFromReq(req) {
  // 1) Authorization header (Bearer <token>)
  const authHeader = req.get('Authorization') || req.get('authorization') || req.headers['x-access-token'] || req.headers['authorization'];
  if (authHeader) {
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
    return authHeader;
  }

  // 2) cookie
  if (req.cookies && req.cookies.token) return req.cookies.token;

  // 3) query string
  if (req.query && req.query.token) return req.query.token;

  // 4) body
  if (req.body && req.body.token) return req.body.token;

  return null;
}

async function ensureAuth(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: 'Token expired', 
          error: 'TOKEN_EXPIRED',
          expiredAt: jwtError.expiredAt 
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          message: 'Invalid token', 
          error: 'INVALID_TOKEN' 
        });
      } else {
        return res.status(401).json({ 
          message: 'Token verification failed', 
          error: 'TOKEN_VERIFICATION_FAILED' 
        });
      }
    }

    // attach decoded for downstream role checks
    req.authPayload = decoded;
    // support both userId or sub style
    const userId = decoded.userId || decoded.sub || decoded.id || decoded._id;
    if (!userId) return res.status(401).json({ message: 'Invalid token payload' });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.userId = String(user._id);
    req.sessionRole = decoded.sessionRole || null;
    req.user = user;
    return next();
  } catch (err) {
    console.error('Auth verify failed:', err && err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

async function optionalAuth(req, res, next) {
  // Non-fatal: if token present validate and attach user, otherwise continue.
  try {
    const token = getTokenFromReq(req);
    if (!token) return next();

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET);
    } catch (e) {
      // invalid token — do not block the request, just continue without user
      console.warn('optionalAuth: invalid token:', e && e.message);
      return next();
    }
    req.authPayload = decoded;
    const userId = decoded.userId || decoded.sub || decoded.id || decoded._id;
    if (!userId) return next();

    const user = await User.findById(userId).lean();
    if (!user) return next();

    req.userId = String(user._id);
    req.sessionRole = decoded.sessionRole || null;
    req.user = user;
    return next();
  } catch (err) {
    // defensive: never throw from optionalAuth
    console.warn('optionalAuth error:', err && err.message);
    return next();
  }
}

function issueToken(user, res, opts = {}) {
  // user can be mongoose doc or plain object with _id
  const payload = { userId: user._id ? String(user._id) : String(user.id || user) };
  if (opts.sessionRole) payload.sessionRole = opts.sessionRole; // 'artist' | 'organizer'
  const token = jwt.sign(payload, SECRET, { expiresIn: opts.expiresIn || '7d' });

  // set httpOnly cookie
  try {
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: (opts.maxAgeMs) || 7 * 24 * 60 * 60 * 1000
    });
    // Also set non-HTTPOnly session role cookie for light UI gating
    if (opts.sessionRole) {
      res.cookie('session_role', opts.sessionRole, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: (opts.maxAgeMs) || 7 * 24 * 60 * 60 * 1000
      });
    } else {
      try { res.clearCookie('session_role'); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore cookie failures */ }

  return token;
}

// Token refresh function
async function refreshToken(req, res) {
  try {
    const token = getTokenFromReq(req);
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    let decoded;
    try {
      // Try to verify token, even if expired (for refresh purposes)
      decoded = jwt.verify(token, SECRET, { ignoreExpiration: true });
    } catch (jwtError) {
      return res.status(401).json({ 
        message: 'Invalid token', 
        error: 'INVALID_TOKEN' 
      });
    }

    // Check if user still exists
    const userId = decoded.userId || decoded.sub || decoded.id || decoded._id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Issue new token
    const newToken = issueToken(user, res, { sessionRole: decoded.sessionRole });
    
    return res.json({ 
      success: true, 
      message: 'Token refreshed successfully',
      token: newToken 
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    return res.status(500).json({ message: 'Token refresh failed' });
  }
}

// Require the current session to have a specific role
function requireSessionRole(expected) {
  return function(req, res, next) {
    const role = (req.authPayload && req.authPayload.sessionRole) || req.sessionRole || null;
    if (role !== expected) {
      return res.status(403).json({ message: 'Forbidden: incorrect session role', required: expected, have: role || null });
    }
    return next();
  }
}

module.exports = ensureAuth;
// attach helpers so existing require(...) usages still work
module.exports.ensureAuth = ensureAuth;
module.exports.optionalAuth = optionalAuth;
module.exports.getTokenFromReq = getTokenFromReq;
module.exports.issueToken = issueToken;
module.exports.refreshToken = refreshToken;
module.exports.requireSessionRole = requireSessionRole;