# Kudumbam Expense Tracker — with Secure User Authentication

Your existing Family Expense Tracker UI and expense-tracking features (dashboard,
Malayalam/Manglish NLP quick-add, voice input, history/search, insights, budget,
categories, family members, PIN lock, export/import) are unchanged. What's new is a
full registration/login system with **per-user data isolation**, enforced entirely
on the server.

## What changed and why

**Before:** `server.js` was a static file server pointing at a hardcoded Windows path
(`d:\Downloads\mhcbjf`), and `app.js` stored *everything* — budget, categories,
members, and every expense — in the browser's `localStorage`. There was no concept
of a "user": anyone opening the app on that browser saw and could edit all the data.

**After:**

| File | Change |
|---|---|
| `server.js` | Rewritten as an Express app: session-based auth, REST API, and static file serving from `public/`. |
| `db.js` | New — SQLite schema (`users`, `expenses`, `user_settings`). |
| `auth.js` | New — password hashing (bcrypt), field validation, auth middleware. |
| `defaults.js` | New — default categories/member seeded for a brand-new account. |
| `public/login.html`, `public/register.html` | New pages, styled to match the existing app. |
| `public/index.html` | Unchanged except a new "My Account" card (name, email, Log Out button) on the Profile screen. |
| `public/app.js` | `localStorage` calls replaced with calls to the new `/api/*` endpoints. All existing UI logic, the NLP parser, voice input, charts, etc. are untouched. |
| `public/app.css` | Unchanged, plus a small block of new styles for the login/register pages. |

## Database structure

```
users
-----------------
id              INTEGER PK
name            TEXT
email           TEXT UNIQUE
password_hash   TEXT   (bcrypt, never plaintext)
created_at, updated_at

expenses
-----------------
id              TEXT PK
user_id         INTEGER  -> users.id  (ON DELETE CASCADE)
category        TEXT
amount          REAL
description     TEXT
member          TEXT
date            TEXT
created_at, updated_at

user_settings
-----------------
user_id            INTEGER PK -> users.id
budget             INTEGER
categories         TEXT (JSON)
members            TEXT (JSON)
active_member_id   TEXT
pin_lock           TEXT (JSON)
```

One user has many expenses (`user_id` foreign key). Every expense read, create,
update, or delete goes through the server, which checks
`expense.user_id === session.userId` before doing anything — the frontend never
supplies or is trusted for identity.

## Security implementation

- **Passwords:** hashed with bcrypt (12 salt rounds) via `bcryptjs`. Plaintext
  passwords are never stored or logged, and `password_hash` is never included in
  any API response.
- **Sessions:** `express-session` with an `httpOnly`, `sameSite=lax` cookie backed
  by a SQLite session store (`connect-sqlite3`), so logins survive a server
  restart. The session secret is generated once and persisted to
  `data/session-secret.txt`.
- **Authorization:** every expense API route (`GET/POST/PUT/DELETE /api/expenses*`)
  requires `requireAuth` and re-checks `user_id` on the row before returning or
  mutating it — requesting another user's expense ID returns a generic
  `404 Not Found` (not "belongs to someone else", to avoid leaking existence).
- **Registration validation:** unique email (DB `UNIQUE` constraint + explicit
  check), minimum password length/complexity, confirm-password match, generic
  "Invalid email or password" on login failure (doesn't reveal which is wrong).
- **Protected routes:** `/` and `/index.html` redirect unauthenticated visitors to
  `/login.html`. All `/api/*` routes except `/api/register`, `/api/login`, and
  `/api/me` require a valid session.

## Setup & run

```bash
# 1. Install dependencies
npm install

# 2. Start the app — the SQLite database (data/kudumbam.db) is created
#    automatically on first run, no separate migration step needed.
npm start

# App runs at http://localhost:8080/
```

To reset the database completely (e.g. during testing), stop the server and
delete the `data/` folder, then run `npm start` again — it will be recreated.

## Manual test checklist (matches the security tests requested)

1. Register `usera@example.com`, add a few expenses, log out.
2. Register `userb@example.com` — dashboard shows **zero** expenses.
3. Add expenses as User B, log out, log back in as User A — User A still sees
   only their own expenses.
4. While logged in as User A, `PUT`/`DELETE` a known User B expense ID directly —
   server responds `404 Not Found`.
5. Log out, call any `/api/expenses*` endpoint directly — server responds `401`.
6. Refresh the page while logged in — session persists, data still scoped
   correctly.

All of the above were verified against this implementation before delivery.
