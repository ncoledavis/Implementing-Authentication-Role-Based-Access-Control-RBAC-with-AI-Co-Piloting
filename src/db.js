'use strict';

// Tiny pure-JavaScript, JSON-file-backed data store.
//
// Why not SQLite? The native `better-sqlite3` module fails to compile when the
// project path contains spaces/parentheses (a node-gyp limitation). A JSON
// store keeps the app dependency-light, cross-platform, and easy to inspect
// during the demo — you can open `data.json` and see bcrypt hashes directly.
//
// The store is intentionally minimal and synchronous, which is fine for a
// teaching/demo app. Writes are persisted atomically on every change.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.json');

function load() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('bad shape');
    parsed.users = Array.isArray(parsed.users) ? parsed.users : [];
    parsed.nextId = Number.isInteger(parsed.nextId) ? parsed.nextId : 1;
    return parsed;
  } catch {
    return { users: [], nextId: 1 };
  }
}

let state = load();

function persist() {
  // Atomic write: write to a temp file then rename, so a crash mid-write
  // cannot corrupt the database.
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

// Custom error so the server can map a duplicate username to HTTP 409,
// mirroring SQLite's unique-constraint behavior.
class UniqueConstraintError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UniqueConstraintError';
    this.code = 'SQLITE_CONSTRAINT_UNIQUE';
  }
}

const Users = {
  findByUsername(username) {
    return state.users.find((u) => u.username === username) || null;
  },

  create({ username, password_hash, role }) {
    if (Users.findByUsername(username)) {
      throw new UniqueConstraintError('Username is already taken.');
    }
    const user = {
      id: state.nextId++,
      username,
      password_hash,
      role,
      created_at: new Date().toISOString(),
    };
    state.users.push(user);
    persist();
    return user;
  },

  update(username, fields) {
    const user = Users.findByUsername(username);
    if (!user) return null;
    Object.assign(user, fields);
    persist();
    return user;
  },

  all() {
    // Return a shallow copy ordered by id; callers must strip sensitive fields.
    return [...state.users].sort((a, b) => a.id - b.id);
  },

  count() {
    return state.users.length;
  },
};

module.exports = { Users, UniqueConstraintError, DB_PATH };
