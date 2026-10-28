'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');

const { Users } = require('./db');
const { hashPassword, verifyPassword, signToken, sanitizeUser, getJwtSecret } = require('./auth');
const { authenticate, requireRole } = require('./middleware');

// Fail fast if the JWT secret is not configured.
getJwtSecret();

const app = express();
app.use(express.json());

// Serve the minimal test frontend.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rate-limit auth endpoints to blunt brute-force / credential-stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// --- Validation helper -----------------------------------------------------

function validateCredentials(body) {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    return { ok: false, message: 'Username and password are required.' };
  }
  if (username.length < 3 || username.length > 32) {
    return { ok: false, message: 'Username must be 3-32 characters.' };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return { ok: false, message: 'Username may contain letters, numbers, and . _ - only.' };
  }
  if (password.length < 8 || password.length > 128) {
    return { ok: false, message: 'Password must be 8-128 characters.' };
  }
  return { ok: true, username, password };
}

// --- Data access -----------------------------------------------------------
// All lookups go through the Users store. Values are never concatenated into
// query strings, so there is no SQL-injection surface.

function listUsersSafe() {
  return Users.all().map(({ id, username, role, created_at }) => ({
    id,
    username,
    role,
    created_at,
  }));
}

// ===========================================================================
// PUBLIC endpoint — accessible to anyone.
// ===========================================================================
app.get('/api/public', (req, res) => {
  res.json({
    scope: 'public',
    message: 'This is a public endpoint. No authentication required.',
  });
});

// ===========================================================================
// AUTH — register, login, me, logout
// ===========================================================================

app.post('/api/register', authLimiter, async (req, res) => {
  const result = validateCredentials(req.body || {});
  if (!result.ok) {
    return res.status(400).json({ error: result.message });
  }

  try {
    const password_hash = await hashPassword(result.password);
    // Self-registration always creates a plain 'User'. Admins are created
    // via the seed script or promoted by an existing admin — never by the
    // client picking its own role.
    const created = Users.create({ username: result.username, password_hash, role: 'User' });
    const user = sanitizeUser(created);
    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (err) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username is already taken.' });
    }
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  const result = validateCredentials(req.body || {});
  if (!result.ok) {
    // Keep validation errors generic-ish but helpful; they don't reveal
    // whether an account exists.
    return res.status(400).json({ error: result.message });
  }

  try {
    const user = Users.findByUsername(result.username);

    // IMPORTANT: use the SAME generic error whether the user is missing or
    // the password is wrong. This prevents username enumeration.
    const genericError = { error: 'Invalid username or password.' };

    if (!user) {
      return res.status(401).json(genericError);
    }

    const ok = await verifyPassword(result.password, user.password_hash);
    if (!ok) {
      return res.status(401).json(genericError);
    }

    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Returns the current authenticated user's profile.
app.get('/api/me', authenticate, (req, res) => {
  const user = Users.findByUsername(req.user.username);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ user: sanitizeUser(user) });
});

// Logout is stateless for JWTs: the client discards its token.
// This endpoint exists so the frontend can call a clean logout flow and so
// the behavior is explicit. (For true server-side invalidation you'd add a
// token blocklist or switch to server sessions — noted in the README.)
app.post('/api/logout', authenticate, (req, res) => {
  res.json({ message: 'Logged out. Discard your token on the client.' });
});

// ===========================================================================
// PROTECTED (User) — any authenticated user.
// ===========================================================================
app.get('/api/dashboard', authenticate, (req, res) => {
  res.json({
    scope: 'user',
    message: `Welcome to your dashboard, ${req.user.username}.`,
    user: req.user,
  });
});

// ===========================================================================
// RESTRICTED (Admin only) — RBAC enforced server-side.
// ===========================================================================
app.get('/api/admin/users', authenticate, requireRole('Admin'), (req, res) => {
  const users = listUsersSafe();
  res.json({ scope: 'admin', count: users.length, users });
});

app.get('/api/admin/metrics', authenticate, requireRole('Admin'), (req, res) => {
  res.json({
    scope: 'admin',
    metrics: {
      totalUsers: Users.count(),
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
});

// --- Fallbacks -------------------------------------------------------------

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Central error handler (e.g. malformed JSON body).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 3000;

// Only start listening when run directly (not when imported by tests).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
