const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const rateLimit = require('express-rate-limit');
const router = express.Router();

function getClientIp(req) {
  // req.ip already respects Express trust proxy settings.
  return req.ip || req.connection?.remoteAddress || '';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.SIGNUP_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const email = normalizeEmail(req.body?.email);
    return email ? `${ip}:${email}` : ip;
  },
  message: { error: 'Too many signup attempts' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const email = normalizeEmail(req.body?.email);
    return email ? `${ip}:${email}` : ip;
  },
  message: { error: 'Too many login attempts' },
});

const JWT_SECRET = process.env.JWT_SECRET || 'chitrakavyam_secret';
const USE_HTTPS = process.env.USE_HTTPS === 'true';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === 'production' || USE_HTTPS,
};

function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, isAdmin: user.is_admin, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function recordLoginFingerprint({ userId = null, email = null, ipAddress = null, forwardedFor = null, userAgent = '', success = false }) {
  try {
    await pool.query(
      `INSERT INTO login_fingerprints (user_id, email, ip_address, forwarded_for, user_agent, success)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, email, ipAddress, forwardedFor, userAgent, success]
    );
  } catch (err) {
    console.error('Login fingerprint log failed:', err.message);
  }
}

// POST /api/auth/signup
router.post('/signup', signupLimiter, async (req, res) => {
  const { email, username, password, roll_number, contact_number } = req.body;

  if (!email || !email.endsWith('@iiserkol.ac.in')) {
    return res.status(403).json({ error: 'Only @iiserkol.ac.in email addresses are permitted' });
  }
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, username, password_hash, roll_number, contact_number) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, username, is_admin',
      [email, username.trim(), password_hash, roll_number || null, contact_number || null]
    );

    const user = result.rows[0];
    const token = signToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ message: 'Account created successfully', user: { id: user.id, email: user.email, username: user.username, isAdmin: user.is_admin } });
  } catch (err) {
    console.error('Signup error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    if (err.code === '23514') return res.status(403).json({ error: 'Only @iiserkol.ac.in email addresses are permitted' });
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const forwardedFor = req.get('x-forwarded-for') || '';
  const ipAddress = req.ip || req.connection?.remoteAddress || '';
  const userAgent = req.get('User-Agent') || '';

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      await recordLoginFingerprint({ email, ipAddress, forwardedFor, userAgent, success: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.lockout_until) - new Date()) / 60000);
      await recordLoginFingerprint({ userId: user.id, email, ipAddress, forwardedFor, userAgent, success: false });
      return res.status(423).json({ error: `Account locked. Try again in ${remaining} minute(s)` });
    }

    if (user.is_banned) {
      await recordLoginFingerprint({ userId: user.id, email, ipAddress, forwardedFor, userAgent, success: false });
      return res.status(403).json({ error: 'Your account has been suspended' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockout = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.query(
        'UPDATE users SET failed_login_attempts = $1, lockout_until = $2 WHERE id = $3',
        [attempts, lockout, user.id]
      );
      await recordLoginFingerprint({ userId: user.id, email, ipAddress, forwardedFor, userAgent, success: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = $1', [user.id]);

    const token = signToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);
    await recordLoginFingerprint({ userId: user.id, email, ipAddress, forwardedFor, userAgent, success: true });
    res.json({ message: 'Login successful', user: { id: user.id, email: user.email, username: user.username, isAdmin: user.is_admin } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: COOKIE_OPTIONS.secure,
  });
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, roll_number, contact_number, is_admin, is_verified, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/auth/profile
router.patch('/profile', authMiddleware, async (req, res) => {
  const { username, roll_number, contact_number } = req.body;
  if (username !== undefined && username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }
  try {
    const result = await pool.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           roll_number = COALESCE($2, roll_number),
           contact_number = COALESCE($3, contact_number)
       WHERE id = $4
       RETURNING id, email, username, roll_number, contact_number, is_admin`,
      [username?.trim() || null, roll_number || null, contact_number || null, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error during profile update' });
  }
});

module.exports = router;
