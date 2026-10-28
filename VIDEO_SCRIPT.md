# Video Demonstration Script (5–7 minutes)

Record screen **and** webcam/face together (Loom, OBS, Zoom, or Panopto).

**Before you hit record, set the stage:**
- Terminal 1: in the project folder, server already running (`npm start`). Leave it visible.
- Browser: `http://localhost:3000` open, DevTools NOT yet open (you'll open it on camera).
- Editor: have `README.md`, `src/middleware.js`, and `src/auth.js` in tabs.
- A second terminal ready for `curl` and for `cat data.json`.
- Clear any existing login (click Logout) so you start logged out.

Lines you say out loud are in plain text. [Bracketed] text is what to do on screen.

---

## 0:00 – 1:30 — Architecture & AI Security Audit

"Hi, I'm [name]. This is my Week 2 project: a full-stack app demonstrating
authentication and role-based access control. Let me start with the stack and
then walk through a real security issue I caught in the AI output."

[Show the editor with the project structure / README open.]

"The backend is Node.js with Express. Authentication is JWT-based with Bearer
tokens. Passwords are hashed with bcrypt at cost factor 12 — that's a salted,
slow hash. Storage is a small JSON file so it's easy to inspect, and there's a
minimal HTML and JavaScript frontend for testing."

"I prompted the AI to act as a senior security engineer and build this. Most of
what it produced was solid, but here's the key issue I caught."

[Open README.md and scroll to 'AI Disclosure' → 'Vulnerabilities / omissions corrected'.]

"The first version used a SQLite library called better-sqlite3. That's a native
module, and it failed to compile because my course folder path has spaces and
parentheses in it, which breaks the build tool. Rather than patch around it, I
diagnosed the root cause and refactored to a pure-JavaScript storage layer and
bcryptjs — no native build at all. I also locked down registration so a client
can never assign itself the Admin role, and I documented that JWT logout is
client-side only instead of pretending it revokes tokens on the server."

---

## 1:30 – 3:30 — Live Functionality Walkthrough

[Switch to the browser at localhost:3000. Confirm it shows 'Logged out'.]

"Let's walk through the happy path. First, registration."

[Type a new username, e.g. 'student1', and a password 8+ chars. Click Register.]

"Registration succeeds with a 201 and I'm issued a token. Notice the role is
'User' — self-registration can't create an admin."

[Point to the response panel showing the token and role: User.]

"Now the user dashboard — a protected endpoint for any logged-in user."

[Click 'User dashboard (auth)'. Show the 200 response welcoming the user.]

"Good. Now let me log out."

[Click Logout. Show status flips to 'Logged out'.]

"And now I'll log in as an admin. This admin was created by a seed script, not
by self-registration."

[Enter admin / Admin123! → click Login. Show role: Admin in the session bar.]

"I'm logged in as Admin. Let me hit the admin-only user list."

[Click 'Admin: list users'. Show the 200 and the list of users.]

"There's the full user list — and notice it does NOT include any password
hashes. Those are stripped before the response goes out."

---

## 3:30 – 5:30 — QA Checklist & Negative Security Testing

"Now the important part: proving the security controls actually hold. Let me
open DevTools."

[Open DevTools → Network tab. Keep Console tab visible too.]

### Negative test 1 — User hitting an Admin endpoint (expect 403)

"First: can a standard user reach an admin endpoint? Let me log out and log back
in as a regular user."

[Logout → log in as student1 (the User account).]

[Click 'Admin: list users'.]

"There it is — 403 Forbidden. The server rejects it at the API layer. This isn't
a hidden button; the endpoint itself enforces the role."

[In the editor, briefly show src/middleware.js — the requireRole function.]

"This middleware, requireRole, runs on every admin route and returns 403 if the
role doesn't match."

### Negative test 2 — Bad credentials (expect 401)

[Back in the browser, log out. Enter admin with a WRONG password. Click Login.]

"Wrong password gives a 401 — and the message is generic: 'Invalid username or
password.' If I try a username that doesn't exist at all..."

[Try a random username like 'nobody' with any password.]

"...same 401, same generic message. That's deliberate — it prevents attackers
from figuring out which usernames exist."

### Negative test 3 — Logged out hitting a protected route (expect 401)

[Make sure you're logged out. Click 'User dashboard (auth)'.]

"Logged out, hitting a protected endpoint: 401 Unauthorized."

### Proof: passwords are hashed, not plaintext

[Switch to the second terminal.]

"Finally, let me prove passwords are never stored in plaintext."

[Run: cat data.json]

"Every password_hash starts with dollar-2a-dollar-12 — that's the bcrypt
identifier and cost factor. These are one-way salted hashes. There is no
plaintext password anywhere in storage."

[Point at the Console tab in DevTools.]

"And the console is clean — no unhandled JavaScript exceptions through all of
this."

---

## 5:30 – 6:30 — Conclusion & Retrospective

"To wrap up. The biggest takeaway for me: AI-generated code can look complete and
still carry issues you only catch by actually auditing and running it. My build
failure wasn't a logic bug the AI would flag — it came from my environment, and I
had to diagnose the root cause rather than keep patching."

"On security specifically: the lesson is that authorization has to live on the
server. It's easy to hide an admin button in the UI and feel safe, but the real
control is the endpoint returning 403 regardless of what the frontend shows. I
verified that directly in this demo."

"Everything's in the README — setup steps, the exact AI prompt, what the AI got
right, what I had to fix, and the full QA checklist with results. Thanks for
watching."

[End recording.]

---

## Quick reference — commands to have ready

```bash
# start the server (Terminal 1, before recording)
npm start

# show hashed passwords (Terminal 2, during the demo)
cat data.json
```

## Credentials
- Admin: `admin` / `Admin123!` (from .env seed)
- User: register a fresh one live, e.g. `student1` / `Password123`

## Status codes you will demonstrate
| Action | Expected |
| --- | --- |
| Public / dashboard (valid) | 200 |
| Register | 201 |
| Bad password / unknown user / logged-out | 401 |
| User → admin endpoint | 403 |
