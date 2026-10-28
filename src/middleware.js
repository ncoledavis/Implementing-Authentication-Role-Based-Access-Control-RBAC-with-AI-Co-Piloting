'use strict';

const { verifyToken } = require('./auth');

/**
 * Authentication guard.
 * Extracts a Bearer token from the Authorization header, verifies it,
 * and attaches the decoded payload to req.user.
 * Responds 401 Unauthorized if the token is missing or invalid.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    return next();
  } catch (err) {
    // Covers expired tokens, bad signatures, and malformed tokens.
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Authorization guard (RBAC).
 * Must run AFTER authenticate. Returns 403 Forbidden if the authenticated
 * user does not hold one of the allowed roles.
 *
 * This is the server-side enforcement that cannot be bypassed by a client
 * that simply hides a button — the endpoint itself rejects the request.
 */
function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient privileges.' });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };
