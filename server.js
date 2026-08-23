// server.js — Kudumbam Expense Tracker backend
// Express + SQLite (better-sqlite3) + session-based auth (bcrypt password hashing)
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const db = require('./db');
const {
  hashPassword,
  verifyPassword,
  validateRegistration,
  validateLogin,
  requireAuth,
  requireAuthPage
} = require('./auth');
const { DEFAULT_CATEGORIES, DEFAULT_MEMBERS, DEFAULT_PIN_LOCK, DEFAULT_BUDGET } = require('./defaults');

const app = express();
const PORT = process.env.PORT || 8080;
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Persist the session signing secret across restarts so logged-in sessions survive a server restart.
const secretPath = path.join(dataDir, 'session-secret.txt');
let sessionSecret;
if (fs.existsSync(secretPath)) {
  sessionSecret = fs.readFileSync(secretPath, 'utf8').trim();
} else {
  sessionSecret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, sessionSecret, { mode: 0o600 });
}

app.use(express.json({ limit: '2mb' }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: dataDir }),
  name: 'kudumbam.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------
const stmts = {
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserById: db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'),

  insertSettings: db.prepare(`
    INSERT INTO user_settings (user_id, budget, categories, members, active_member_id, pin_lock)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getSettings: db.prepare('SELECT * FROM user_settings WHERE user_id = ?'),
  updateSettings: db.prepare(`
    UPDATE user_settings
    SET budget = ?, categories = ?, members = ?, active_member_id = ?, pin_lock = ?, updated_at = datetime('now')
    WHERE user_id = ?
  `),

  listExpenses: db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC'),
  getExpense: db.prepare('SELECT * FROM expenses WHERE id = ?'),
  insertExpense: db.prepare(`
    INSERT INTO expenses (id, user_id, category, amount, description, member, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updateExpense: db.prepare(`
    UPDATE expenses
    SET category = ?, amount = ?, description = ?, member = ?, date = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `),
  deleteExpense: db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?'),
  deleteAllExpensesForUser: db.prepare('DELETE FROM expenses WHERE user_id = ?')
};

// Row (snake_case) -> API shape (camelCase) for an expense
function serializeExpense(row) {
  return {
    id: row.id,
    amount: row.amount,
    category: row.category,
    date: row.date,
    member: row.member,
    description: row.description
  };
}

function serializeSettings(row) {
  return {
    budget: row.budget,
    categories: JSON.parse(row.categories),
    members: JSON.parse(row.members),
    activeMemberId: row.active_member_id,
    pinLock: JSON.parse(row.pin_lock)
  };
}

function getFullState(userId) {
  const settingsRow = stmts.getSettings.get(userId);
  const expenses = stmts.listExpenses.all(userId).map(serializeExpense);
  return { ...serializeSettings(settingsRow), expenses };
}

// ---------------------------------------------------------------------------
// Auth API routes
// ---------------------------------------------------------------------------

app.post('/api/register', (req, res) => {
  const { name, email, password, confirmPassword } = req.body || {};
  const { valid, errors } = validateRegistration({ name, email, password, confirmPassword });
  if (!valid) {
    return res.status(400).json({ error: 'Validation failed.', fieldErrors: errors });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = stmts.findUserByEmail.get(normalizedEmail);
  if (existing) {
    return res.status(409).json({
      error: 'An account with this email already exists.',
      fieldErrors: { email: 'This email is already registered.' }
    });
  }

  const passwordHash = hashPassword(password);

  const createUserAndSettings = db.transaction(() => {
    const info = stmts.insertUser.run(name.trim(), normalizedEmail, passwordHash);
    const userId = info.lastInsertRowid;
    stmts.insertSettings.run(
      userId,
      DEFAULT_BUDGET,
      JSON.stringify(DEFAULT_CATEGORIES),
      JSON.stringify(DEFAULT_MEMBERS),
      DEFAULT_MEMBERS[0].id,
      JSON.stringify(DEFAULT_PIN_LOCK)
    );
    return userId;
  });

  let userId;
  try {
    userId = createUserAndSettings();
  } catch (err) {
    console.error('Registration error:', err.code || err.message);
    return res.status(500).json({ error: 'Could not create account. Please try again.' });
  }

  req.session.userId = userId;
  return res.status(201).json({ user: { id: userId, name: name.trim(), email: normalizedEmail } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const { valid, errors } = validateLogin({ email, password });
  if (!valid) {
    return res.status(400).json({ error: 'Validation failed.', fieldErrors: errors });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = stmts.findUserByEmail.get(normalizedEmail);

  // Generic error message on purpose: never reveal whether the email exists.
  const genericError = 'Invalid email or password.';

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: genericError });
  }

  req.session.userId = user.id;
  return res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('kudumbam.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  const user = stmts.findUserById.get(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  return res.json({ user });
});

// ---------------------------------------------------------------------------
// Protected app-state API routes (all scoped to req.session.userId)
// ---------------------------------------------------------------------------

app.get('/api/state', requireAuth, (req, res) => {
  return res.json(getFullState(req.session.userId));
});

app.put('/api/settings', requireAuth, (req, res) => {
  const { budget, categories, members, activeMemberId, pinLock } = req.body || {};

  if (typeof budget !== 'number' || budget < 0) {
    return res.status(400).json({ error: 'Invalid budget value.' });
  }
  if (!Array.isArray(categories) || !Array.isArray(members)) {
    return res.status(400).json({ error: 'Invalid categories/members payload.' });
  }

  const safePinLock = {
    enabled: !!(pinLock && pinLock.enabled),
    pin: (pinLock && typeof pinLock.pin === 'string' && /^\d{4}$/.test(pinLock.pin)) ? pinLock.pin : ''
  };

  stmts.updateSettings.run(
    budget,
    JSON.stringify(categories),
    JSON.stringify(members),
    typeof activeMemberId === 'string' ? activeMemberId : '',
    JSON.stringify(safePinLock),
    req.session.userId
  );

  return res.json(getFullState(req.session.userId));
});

// ---- Expenses CRUD — ownership is verified on every read/write ----

app.get('/api/expenses', requireAuth, (req, res) => {
  const expenses = stmts.listExpenses.all(req.session.userId).map(serializeExpense);
  return res.json({ expenses });
});

app.post('/api/expenses', requireAuth, (req, res) => {
  const { amount, category, date, member, description } = req.body || {};

  const numAmount = parseFloat(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'A valid positive amount is required.' });
  }
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'Category is required.' });
  }
  if (!date || typeof date !== 'string') {
    return res.status(400).json({ error: 'Date is required.' });
  }

  const id = 'exp-' + Date.now() + '-' + Math.round(Math.random() * 1000);

  // user_id always comes from the session — never trusted from the client body.
  stmts.insertExpense.run(id, req.session.userId, category, numAmount, (description || '').trim(), member || '', date);

  const row = stmts.getExpense.get(id);
  return res.status(201).json({ expense: serializeExpense(row) });
});

app.put('/api/expenses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const existing = stmts.getExpense.get(id);

  if (!existing || existing.user_id !== req.session.userId) {
    // Deliberately identical response whether the expense doesn't exist or
    // belongs to someone else — never leak which is the case.
    return res.status(404).json({ error: 'Expense not found.' });
  }

  const { amount, category, date, member, description } = req.body || {};
  const numAmount = parseFloat(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'A valid positive amount is required.' });
  }
  if (!category || !date) {
    return res.status(400).json({ error: 'Category and date are required.' });
  }

  stmts.updateExpense.run(category, numAmount, (description || '').trim(), member || '', date, id, req.session.userId);

  const row = stmts.getExpense.get(id);
  return res.json({ expense: serializeExpense(row) });
});

app.delete('/api/expenses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const existing = stmts.getExpense.get(id);

  if (!existing || existing.user_id !== req.session.userId) {
    return res.status(404).json({ error: 'Expense not found.' });
  }

  stmts.deleteExpense.run(id, req.session.userId);
  return res.json({ ok: true });
});

// ---- Backup export / import (scoped to the authenticated user only) ----

app.get('/api/data/export', requireAuth, (req, res) => {
  return res.json(getFullState(req.session.userId));
});

app.post('/api/data/import', requireAuth, (req, res) => {
  const { budget, categories, members, expenses, activeMemberId, pinLock } = req.body || {};

  if (!Array.isArray(expenses) || !Array.isArray(categories) || !Array.isArray(members) || typeof budget !== 'number') {
    return res.status(400).json({ error: 'Invalid backup file format.' });
  }

  const safePinLock = {
    enabled: !!(pinLock && pinLock.enabled),
    pin: (pinLock && typeof pinLock.pin === 'string' && /^\d{4}$/.test(pinLock.pin)) ? pinLock.pin : ''
  };

  const userId = req.session.userId;

  const runImport = db.transaction(() => {
    stmts.updateSettings.run(
      budget,
      JSON.stringify(categories),
      JSON.stringify(members),
      typeof activeMemberId === 'string' ? activeMemberId : (members[0] ? members[0].id : ''),
      JSON.stringify(safePinLock),
      userId
    );

    // Replace this user's expenses with the imported set — every imported row
    // is re-owned by the authenticated user, ignoring any user_id in the file.
    stmts.deleteAllExpensesForUser.run(userId);
    for (const exp of expenses) {
      const amt = parseFloat(exp.amount);
      if (!amt || amt <= 0 || !exp.category || !exp.date) continue;
      const id = exp.id && typeof exp.id === 'string' ? exp.id : 'exp-' + Date.now() + '-' + Math.round(Math.random() * 100000);
      stmts.insertExpense.run(id, userId, exp.category, amt, (exp.description || '').trim(), exp.member || '', exp.date);
    }
  });

  try {
    runImport();
  } catch (err) {
    console.error('Import error:', err.message);
    return res.status(500).json({ error: 'Failed to import backup.' });
  }

  return res.json(getFullState(userId));
});

app.post('/api/data/reset', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const runReset = db.transaction(() => {
    stmts.deleteAllExpensesForUser.run(userId);
    stmts.updateSettings.run(
      DEFAULT_BUDGET,
      JSON.stringify(DEFAULT_CATEGORIES),
      JSON.stringify(DEFAULT_MEMBERS),
      DEFAULT_MEMBERS[0].id,
      JSON.stringify(DEFAULT_PIN_LOCK),
      userId
    );
  });
  runReset();
  return res.json(getFullState(userId));
});

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
const publicDir = path.join(__dirname, 'public');

// Public (unauthenticated) pages: login, register, and shared static assets.
app.use(express.static(publicDir, { index: false }));

// Protected dashboard — redirect to login if no session.
app.get(['/', '/index.html'], requireAuthPage, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Fallback 404
app.use((req, res) => {
  res.status(404).send('<h1>404 Not Found</h1>');
});

app.listen(PORT, () => {
  console.log(`Kudumbam Expense Tracker running at http://localhost:${PORT}/`);
});
