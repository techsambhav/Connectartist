const jwt = require('jsonwebtoken');
const User = require('./models/User');

const SECRET = process.env.JWT_SECRET || 'replace_this_with_env_secret';
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '7d';

function issueToken(user, res, opts = {}) {
  // user: mongoose user doc or plain object with at least {_id, email}
  const sessionRole = opts.sessionRole || null; // 'artist' or 'organizer'
  const payload = {
    sub: user._id ? String(user._id) : String(user.id || user),
    email: user.email,
    role: user.role || 'organizer',
    ...(sessionRole ? { sessionRole } : {})
  };
  const token = jwt.sign(payload, SECRET, { expiresIn: TOKEN_EXPIRES_IN });

  // Set httpOnly cookie
  try {
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    // Also set a non-HTTPOnly cookie showing current session role for simple UI gating (not for security)
    if (sessionRole) {
      res.cookie('session_role', sessionRole, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    } else {
      // clear if not provided
      res.clearCookie('session_role');
    }
  } catch (e) {
    // ignore cookie setting errors
  }

  return token;
}

function getTokenFromReq(req) {
  // 1) cookie
  if (req.cookies && req.cookies.token) return req.cookies.token;

  // 2) Authorization header "Bearer <token>"
  const authHeader = req.get('Authorization') || req.get('authorization') || req.get('x-access-token') || req.headers['x-access-token'];
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
    return authHeader;
  }

  // 3) local storage token sent in body/header (rare)
  if (req.headers['x-client-token']) return req.headers['x-client-token'];

  // 4) query/body fallback
  if (req.query && req.query.token) return req.query.token;
  if (req.body && req.body.token) return req.body.token;

  return null;
}

async function ensureAuth(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Unauthenticated' });
    const decoded = jwt.verify(token, SECRET);
    const userId = decoded.sub || decoded.userId || decoded.id;
    if (!userId) return res.status(401).json({ error: 'Invalid token' });
    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ error: 'Invalid token - user not found' });

    req.user = user;
    req.userId = String(user._id);
    return next();
  } catch (err) {
    console.error('Auth error', err && err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  issueToken,
  getTokenFromReq,
  ensureAuth,
};
