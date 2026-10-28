# Week 02 — Authentication & Role-Based Access Control (RBAC)

A lightweight full-stack application demonstrating secure **Authentication (AuthN)**
and **Role-Based Access Control (RBAC)**. Built as a REST API with a minimal
HTML/JS frontend for live testing.

## Project Overview

The app supports two roles — **User** and **Admin** — and exposes three tiers of access:

| Tier | Endpoint | Who can access |
| --- | --- | --- |
| Public | `GET /api/public` | Anyone, no auth |
| Protected (User) | `GET /api/dashboard` | Any authenticated user |
| Restricted (Admin) | `GET /api/admin/users`, `GET /api/admin/metrics` | **Admins only** |

### Tech Stack

- **Runtime:** Node.js (tested on v24)
- **Server:** Express 4
- **Auth:** JWT (`jsonwebtoken`) — stateless Bearer tokens
- **Password hashing:** `bcryptjs` (bcrypt, cost factor 12 — salted + slow)
- **Storage:** JSON file store (`data.json`) via a tiny pure-JS layer in `src/db.js`
- **Rate limiting:** `express-rate-limit` on auth routes
- **Config:** `dotenv` — secrets live in `.env`, never in source
- **Frontend:** single static `public/index.html` (vanilla JS)

> **Why a JSON file instead of SQLite?** The original design used `better-sqlite3`,
> but it is a native module and `node-gyp` fails to compile when the project path
> contains spaces and parentheses (as this course folder does). A pure-JS JSON
> store removes the native build entirely, works cross-platform, and is easy to
> inspect during the demo. For production you would swap `src/db.js` for a real
> database (Postgres, SQLite, etc.) behind the same `Users` interface.

## Project Structure

```
.
├── src/
│   ├── server.js      # Express app, routes, validation, error handling
│   ├── auth.js        # bcrypt hashing + JWT sign/verify + sanitizeUser
│   ├── middleware.js  # authenticate() + requireRole() route guards
│   ├── db.js          # JSON-file-backed Users store
│   └── seed.js        # creates the first Admin from .env
├── public/
│   └── index.html     # minimal frontend to test register/login/logout/roles
├── .env.example       # template for environment variables
├── .gitignore
└── package.json
```

## Setup & Execution Guide

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the template and set a strong secret:

```bash
cp .env.example .env
```

Generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the output as the `JWT_SECRET` value in `.env`.

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs/verifies JWTs. Must be long and random. **Required.** |
| `JWT_EXPIRES_IN` | Token lifetime (default `1h`). |
| `PORT` | Server port (default `3000`). |
| `SEED_ADMIN_USERNAME` | Username for the seeded admin. |
| `SEED_ADMIN_PASSWORD` | Password for the seeded admin. |

### 3. Create the first Admin

Self-registration only ever creates `User` accounts. Seed an admin:

```bash
npm run seed
```

### 4. Run the server

```bash
npm start
```

Open **http://localhost:3000** and use the buttons to register, log in, log out,
and hit each endpoint. The "Last response" panel shows the HTTP status and body.

Log in as the admin using the `SEED_ADMIN_*` credentials from your `.env`.

## API Reference

| Method | Route | Auth | Role | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/public` | none | — | 200 |
| POST | `/api/register` | none | — | 201 (returns token) |
| POST | `/api/login` | none | — | 200 (returns token) |
| GET | `/api/me` | Bearer | any | 200 |
| POST | `/api/logout` | Bearer | any | 200 |
| GET | `/api/dashboard` | Bearer | any | 200 |
| GET | `/api/admin/users` | Bearer | Admin | 200 |
| GET | `/api/admin/metrics` | Bearer | Admin | 200 |

Send the token as a header: `Authorization: Bearer <token>`.

## Security Design Notes

- **Salted, slow hashing.** bcrypt at cost 12, with a unique per-password salt
  embedded in each hash. No MD5/SHA-256/plaintext anywhere.
- **Server-side RBAC.** The `requireRole('Admin')` middleware rejects the request
  at the API layer with `403`. Hiding a frontend button is *not* the control —
  the endpoint itself enforces it.
- **No role self-assignment.** `POST /api/register` always creates a `User`.
  Admins come only from the seed script.
- **Secrets in env.** `JWT_SECRET` is read from `.env`; the server refuses to
  start with the placeholder value.
- **No hash leakage.** `sanitizeUser()` strips `password_hash` before any user
  object is returned, and the admin user list selects only safe fields.
- **Generic auth errors.** Both "no such user" and "wrong password" return the
  identical `Invalid username or password.` → no username enumeration.
- **Input validation.** Username/password are type-checked, length-bounded, and
  the username is restricted to a safe character set.
- **Injection-safe.** The store uses in-memory object lookups, not string-built
  queries. (Swap in parameterized queries if you move to SQL.)
- **Rate limiting.** Auth routes are capped to slow brute-force attempts.
- **Stateless JWT logout caveat.** With stateless JWTs, logout means the client
  discards its token. True server-side revocation would require a token blocklist
  or server-side sessions — noted here intentionally.

## AI Disclosure & Prompt Appendix

### AI tool used

Kiro (Claude-based AI software engineer) acting as a senior security engineer.

### Prompt submitted

> Act as a senior security engineer. Build a lightweight full-stack application
> (or REST API with a simple frontend) demonstrating basic Authentication and
> Role-Based Access Control (RBAC). Include user registration & login with
> 'User' and 'Admin' roles, modern password hashing, JWT or session auth, and
> three tiers of access (public, protected-user, admin-only). Provide backend
> code, route-guard middleware, and a minimal frontend to test registration,
> login, logout, and role access.

### What the AI produced correctly

- Correct bcrypt usage (salted, cost factor 12) from the start — no weak hashes.
- Server-side RBAC enforcement via middleware, not just frontend hiding.
- Generic login errors preventing username enumeration.
- Secrets read from `.env`; `password_hash` stripped from all responses.
- Input validation, rate limiting, and safe error handling.

### Vulnerabilities / omissions corrected during the build

- **Native build failure → refactor.** The first version used `better-sqlite3`,
  whose native module failed to compile because this course folder path contains
  spaces and parentheses. This was caught at install time and refactored to a
  pure-JS JSON store (`bcrypt` → `bcryptjs` likewise, to stay native-free).
- **Role self-assignment risk.** Registration was locked to always issue the
  `User` role so a client cannot register itself as an Admin.
- **Logout honesty.** Documented the stateless-JWT logout limitation rather than
  implying server-side token invalidation that does not exist.

## QA Test Summary

All tests executed against the live server with `curl`. Results:

### 1. Authentication functional tests

- [x] Successful registration with a new account → **201**
- [x] Successful login generating a token → **200**, token returned
- [x] Failed login with invalid password → **401**, generic message
- [x] Logout removes the local credential (client discards token) → **200**

### 2. Authorization & privilege boundary tests

- [x] User accesses user dashboard → **200**
- [x] User attempts admin endpoint → **403 Forbidden**
- [x] Admin accesses both user and admin resources → **200 / 200**
- [x] Protected endpoint while logged out → **401 Unauthorized**

### 3. Input validation & edge cases

- [x] Empty username/password rejected → **400** (client + server validation)
- [x] SQL-like syntax in username does not crash the server → **400**, handled
- [x] Malformed JSON body → **400**
- [x] Invalid/garbage token → **401**

### 4. Password storage proof

- [x] `data.json` stores `$2a$12$...` bcrypt hashes, never plaintext
- [x] `GET /api/admin/users` response contains **no** `password_hash` field

### Observed status codes (for DevTools walkthrough)

| Scenario | Status |
| --- | --- |
| Public endpoint | 200 |
| Register | 201 |
| Login (valid) | 200 |
| Login (bad password / unknown user) | 401 |
| User → admin endpoint | 403 |
| Logged-out → protected | 401 |
| Validation failure / malformed JSON | 400 |
| Invalid token | 401 |

## License

MIT
