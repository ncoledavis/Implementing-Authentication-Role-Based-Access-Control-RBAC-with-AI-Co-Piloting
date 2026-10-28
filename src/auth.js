'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// bcrypt cost factor. 12 is a good balance of security and speed in 2026.
const SALT_ROUNDS = 12;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'replace-me-with-a-long-random-secret') {
    throw new Error(
      'JWT_SECRET is not set. Copy .env.example to .env and set a strong secret.'
    );
  }
  return secret;
}

/**
 * Hash a plaintext password using bcrypt (salted + slow).
 * bcrypt generates and embeds a unique random salt in every hash.
 */
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 * Uses a constant-time comparison internally to resist timing attacks.
 */
async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Create a signed JWT containing the user's id, username, and role.
 * The role is embedded so the server can authorize without a DB hit,
 * but authorization is still enforced server-side on every request.
 */
function signToken(user) {
  const payload = { sub: user.id, username: user.username, role: user.role };
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

/**
 * Verify and decode a JWT. Throws if the token is invalid or expired.
 */
function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

/**
 * Strip sensitive fields (password_hash) before returning a user object
 * to the client. Never leak the hash over the wire.
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  sanitizeUser,
  getJwtSecret,
};
