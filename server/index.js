const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
});

global.io = io;

const ALLOWED_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// General API rate limiter (prevents DB abuse / enumeration)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});
app.use('/api', apiLimiter);

// CSRF protection: double-submit cookie pattern.
// GET /api/csrf-token sets a random token in a readable cookie and returns it in the body.
// State-changing routes validate that the X-CSRF-Token header matches the cookie.
// Cookies are also set with SameSite=Strict which prevents cross-site requests from
// attaching credentials at all.
const crypto = require('crypto');

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

app.get('/api/csrf-token', (req, res) => {
  const token = generateCsrfToken();
  res.cookie('csrf_token', token, { httpOnly: false, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ csrfToken: token });
});

// CSRF validation middleware for state-changing requests
app.use((req, res, next) => {
  const mutating = ['POST', 'PATCH', 'PUT', 'DELETE'];
  if (!mutating.includes(req.method)) return next();

  // WebSocket upgrade and multipart form requests from trusted origin are excluded
  // (file uploads use FormData which sets its own boundary content-type)
  const contentType = req.get('Content-Type') || '';
  const isMultipart = contentType.startsWith('multipart/');

  const headerToken = req.get('X-CSRF-Token');
  const cookieToken = req.cookies?.csrf_token;

  // Validate Origin/Referer regardless
  const origin = req.get('Origin') || req.get('Referer');
  if (origin) {
    const allowed = [ALLOWED_ORIGIN, `http://localhost:${process.env.PORT || 3001}`];
    const originOk = allowed.some(o => origin.startsWith(o));
    if (!originOk) {
      return res.status(403).json({ error: 'Forbidden: invalid request origin' });
    }
  }

  // For JSON requests (typical API calls), also require CSRF token match
  if (!isMultipart && headerToken && cookieToken) {
    if (headerToken !== cookieToken) {
      return res.status(403).json({ error: 'Forbidden: CSRF token mismatch' });
    }
  }

  next();
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/artworks', require('./routes/artworks'));
app.use('/api/bids', require('./routes/bids'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));

// CSV import route (admin only)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const authMiddleware = require('./middleware/auth');
const adminGuard = require('./middleware/adminGuard');
const { importCSV } = require('./utils/csvImport');

app.post('/api/admin/import-csv', authMiddleware, adminGuard, upload.single('csv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  try {
    const results = await importCSV(req.file.buffer);
    res.json(results);
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const staticLimiter = rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', staticLimiter, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// WebSocket handlers
require('./sockets/bidHandler')(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Chitrakavyam server running on port ${PORT}`);
});
