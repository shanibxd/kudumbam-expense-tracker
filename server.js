// server.js — Kudumbam Expense Tracker
// Express + PostgreSQL + session-based authentication

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const db = require('./db');

const {
  hashPassword,
  verifyPassword,
  validateRegistration,
  validateLogin,
  requireAuth,
  requireAuthPage
} = require('./auth');

const {
  DEFAULT_CATEGORIES,
  DEFAULT_MEMBERS,
  DEFAULT_PIN_LOCK,
  DEFAULT_BUDGET
} = require('./defaults');

const app = express();

const PORT = process.env.PORT || 8080;

// Render/other reverse proxies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ------------------------------------------------------------
// Session secret
// ------------------------------------------------------------

const sessionSecret =
  process.env.SESSION_SECRET ||
  crypto.randomBytes(48).toString('hex');

if (!process.env.SESSION_SECRET) {
  console.warn(
    'WARNING: SESSION_SECRET is not configured. ' +
    'A temporary secret will be generated for this process.'
  );
}

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------

app.use(express.json({ limit: '2mb' }));

app.use(
  session({
    store: new PgSession({
      pool: db.pool,
      tableName: 'session',
      createTableIfMissing: true
    }),

    name: 'kudumbam.sid',

    secret: sessionSecret,

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

// ------------------------------------------------------------
// Database helpers
// ------------------------------------------------------------

async function getFullState(userId) {
  const settingsResult = await db.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );

  const expensesResult = await db.query(
    `SELECT *
     FROM expenses
     WHERE user_id = $1
     ORDER BY date DESC, created_at DESC`,
    [userId]
  );

  const settingsRow = settingsResult.rows[0];

  if (!settingsRow) {
    throw new Error('User settings not found.');
  }

  return {
    budget: Number(settingsRow.budget),

    categories: JSON.parse(settingsRow.categories),

    members: JSON.parse(settingsRow.members),

    activeMemberId: settingsRow.active_member_id,

    pinLock: JSON.parse(settingsRow.pin_lock),

    expenses: expensesResult.rows.map(serializeExpense)
  };
}

// ------------------------------------------------------------
// Serialization
// ------------------------------------------------------------

function serializeExpense(row) {
  return {
    id: row.id,
    amount: Number(row.amount),
    category: row.category,
    date: row.date,
    member: row.member,
    description: row.description
  };
}

function serializeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: row.created_at
  };
}

// ------------------------------------------------------------
// Authentication routes
// ------------------------------------------------------------

app.post('/api/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body || {};

  const { valid, errors } = validateRegistration({
    name,
    email,
    password,
    confirmPassword
  });

  if (!valid) {
    return res.status(400).json({
      error: 'Validation failed.',
      fieldErrors: errors
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existingResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'An account with this email already exists.',
        fieldErrors: {
          email: 'This email is already registered.'
        }
      });
    }

    const passwordHash = hashPassword(password);

    // Create user + settings atomically
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `INSERT INTO users
          (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, created_at`,
        [name.trim(), normalizedEmail, passwordHash]
      );

      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO user_settings
          (user_id, budget, categories, members, active_member_id, pin_lock)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          DEFAULT_BUDGET,
          JSON.stringify(DEFAULT_CATEGORIES),
          JSON.stringify(DEFAULT_MEMBERS),
          DEFAULT_MEMBERS[0].id,
          JSON.stringify(DEFAULT_PIN_LOCK)
        ]
      );

      await client.query('COMMIT');

      req.session.userId = user.id;

      return res.status(201).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');

      console.error('Registration transaction error:', err.message);

      // PostgreSQL unique constraint protection
      if (err.code === '23505') {
        return res.status(409).json({
          error: 'An account with this email already exists.',
          fieldErrors: {
            email: 'This email is already registered.'
          }
        });
      }

      return res.status(500).json({
        error: 'Could not create account. Please try again.'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Registration error:', err.message);

    return res.status(500).json({
      error: 'Could not create account. Please try again.'
    });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};

  const { valid, errors } = validateLogin({
    email,
    password
  });

  if (!valid) {
    return res.status(400).json({
      error: 'Validation failed.',
      fieldErrors: errors
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const genericError = 'Invalid email or password.';

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [normalizedEmail]
    );

    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        error: genericError
      });
    }

    req.session.userId = user.id;

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);

    return res.status(500).json({
      error: 'Login failed. Please try again.'
    });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('kudumbam.sid');

    res.json({
      ok: true
    });
  });
});

app.get('/api/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Not authenticated.'
    });
  }

  try {
    const result = await db.query(
      `SELECT id, name, email, created_at
       FROM users
       WHERE id = $1`,
      [req.session.userId]
    );

    const user = result.rows[0];

    if (!user) {
      req.session.destroy(() => {});

      return res.status(401).json({
        error: 'Not authenticated.'
      });
    }

    return res.json({
      user: serializeUser(user)
    });
  } catch (err) {
    console.error('Me error:', err.message);

    return res.status(500).json({
      error: 'Could not load user.'
    });
  }
});

// ------------------------------------------------------------
// Protected state
// ------------------------------------------------------------

app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const state = await getFullState(req.session.userId);

    return res.json(state);
  } catch (err) {
    console.error('State error:', err.message);

    return res.status(500).json({
      error: 'Could not load application state.'
    });
  }
});

// ------------------------------------------------------------
// Settings
// ------------------------------------------------------------

app.put('/api/settings', requireAuth, async (req, res) => {
  const {
    budget,
    categories,
    members,
    activeMemberId,
    pinLock
  } = req.body || {};

  if (typeof budget !== 'number' || budget < 0) {
    return res.status(400).json({
      error: 'Invalid budget value.'
    });
  }

  if (!Array.isArray(categories) || !Array.isArray(members)) {
    return res.status(400).json({
      error: 'Invalid categories/members payload.'
    });
  }

  const safePinLock = {
    enabled: !!(pinLock && pinLock.enabled),

    pin:
      pinLock &&
      typeof pinLock.pin === 'string' &&
      /^\d{4}$/.test(pinLock.pin)
        ? pinLock.pin
        : ''
  };

  try {
    await db.query(
      `UPDATE user_settings
       SET
         budget = $1,
         categories = $2,
         members = $3,
         active_member_id = $4,
         pin_lock = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $6`,
      [
        budget,
        JSON.stringify(categories),
        JSON.stringify(members),
        typeof activeMemberId === 'string'
          ? activeMemberId
          : '',
        JSON.stringify(safePinLock),
        req.session.userId
      ]
    );

    return res.json(
      await getFullState(req.session.userId)
    );
  } catch (err) {
    console.error('Settings update error:', err.message);

    return res.status(500).json({
      error: 'Could not update settings.'
    });
  }
});

// ------------------------------------------------------------
// Expenses
// ------------------------------------------------------------

app.get('/api/expenses', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT *
       FROM expenses
       WHERE user_id = $1
       ORDER BY date DESC, created_at DESC`,
      [req.session.userId]
    );

    return res.json({
      expenses: result.rows.map(serializeExpense)
    });
  } catch (err) {
    console.error('Expenses error:', err.message);

    return res.status(500).json({
      error: 'Could not load expenses.'
    });
  }
});

app.post('/api/expenses', requireAuth, async (req, res) => {
  const {
    amount,
    category,
    date,
    member,
    description
  } = req.body || {};

  const numAmount = parseFloat(amount);

  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({
      error: 'A valid positive amount is required.'
    });
  }

  if (!category || typeof category !== 'string') {
    return res.status(400).json({
      error: 'Category is required.'
    });
  }

  if (!date || typeof date !== 'string') {
    return res.status(400).json({
      error: 'Date is required.'
    });
  }

  const id =
    'exp-' +
    Date.now() +
    '-' +
    Math.round(Math.random() * 1000);

  try {
    const result = await db.query(
      `INSERT INTO expenses
        (id, user_id, category, amount, description, member, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        req.session.userId,
        category,
        numAmount,
        (description || '').trim(),
        member || '',
        date
      ]
    );

    return res.status(201).json({
      expense: serializeExpense(result.rows[0])
    });
  } catch (err) {
    console.error('Add expense error:', err.message);

    return res.status(500).json({
      error: 'Could not add expense.'
    });
  }
});

app.put('/api/expenses/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Ownership check
    const existingResult = await db.query(
      `SELECT *
       FROM expenses
       WHERE id = $1 AND user_id = $2`,
      [id, req.session.userId]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({
        error: 'Expense not found.'
      });
    }

    const {
      amount,
      category,
      date,
      member,
      description
    } = req.body || {};

    const numAmount = parseFloat(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({
        error: 'A valid positive amount is required.'
      });
    }

    if (!category || !date) {
      return res.status(400).json({
        error: 'Category and date are required.'
      });
    }

    const result = await db.query(
      `UPDATE expenses
       SET
         category = $1,
         amount = $2,
         description = $3,
         member = $4,
         date = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [
        category,
        numAmount,
        (description || '').trim(),
        member || '',
        date,
        id,
        req.session.userId
      ]
    );

    return res.json({
      expense: serializeExpense(result.rows[0])
    });
  } catch (err) {
    console.error('Update expense error:', err.message);

    return res.status(500).json({
      error: 'Could not update expense.'
    });
  }
});

app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `DELETE FROM expenses
       WHERE id = $1 AND user_id = $2`,
      [id, req.session.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Expense not found.'
      });
    }

    return res.json({
      ok: true
    });
  } catch (err) {
    console.error('Delete expense error:', err.message);

    return res.status(500).json({
      error: 'Could not delete expense.'
    });
  }
});

// ------------------------------------------------------------
// Export
// ------------------------------------------------------------

app.get('/api/data/export', requireAuth, async (req, res) => {
  try {
    return res.json(
      await getFullState(req.session.userId)
    );
  } catch (err) {
    console.error('Export error:', err.message);

    return res.status(500).json({
      error: 'Could not export data.'
    });
  }
});

// ------------------------------------------------------------
// Import
// ------------------------------------------------------------

app.post('/api/data/import', requireAuth, async (req, res) => {
  const {
    budget,
    categories,
    members,
    expenses,
    activeMemberId,
    pinLock
  } = req.body || {};

  if (
    !Array.isArray(expenses) ||
    !Array.isArray(categories) ||
    !Array.isArray(members) ||
    typeof budget !== 'number'
  ) {
    return res.status(400).json({
      error: 'Invalid backup file format.'
    });
  }

  const safePinLock = {
    enabled: !!(pinLock && pinLock.enabled),

    pin:
      pinLock &&
      typeof pinLock.pin === 'string' &&
      /^\d{4}$/.test(pinLock.pin)
        ? pinLock.pin
        : ''
  };

  const userId = req.session.userId;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE user_settings
       SET
         budget = $1,
         categories = $2,
         members = $3,
         active_member_id = $4,
         pin_lock = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $6`,
      [
        budget,
        JSON.stringify(categories),
        JSON.stringify(members),
        typeof activeMemberId === 'string'
          ? activeMemberId
          : members[0]
            ? members[0].id
            : '',
        JSON.stringify(safePinLock),
        userId
      ]
    );

    // Delete ONLY this user's expenses
    await client.query(
      'DELETE FROM expenses WHERE user_id = $1',
      [userId]
    );

    for (const exp of expenses) {
      const amt = parseFloat(exp.amount);

      if (!amt || amt <= 0 || !exp.category || !exp.date) {
        continue;
      }

      const id =
        exp.id && typeof exp.id === 'string'
          ? exp.id
          : 'exp-' +
            Date.now() +
            '-' +
            Math.round(Math.random() * 100000);

      await client.query(
        `INSERT INTO expenses
          (id, user_id, category, amount, description, member, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE
         SET
           user_id = EXCLUDED.user_id,
           category = EXCLUDED.category,
           amount = EXCLUDED.amount,
           description = EXCLUDED.description,
           member = EXCLUDED.member,
           date = EXCLUDED.date,
           updated_at = CURRENT_TIMESTAMP`,
        [
          id,
          userId,
          exp.category,
          amt,
          (exp.description || '').trim(),
          exp.member || '',
          exp.date
        ]
      );
    }

    await client.query('COMMIT');

    return res.json(
      await getFullState(userId)
    );
  } catch (err) {
    await client.query('ROLLBACK');

    console.error('Import error:', err.message);

    return res.status(500).json({
      error: 'Failed to import backup.'
    });
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------
// Reset
// ------------------------------------------------------------

app.post('/api/data/reset', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'DELETE FROM expenses WHERE user_id = $1',
      [userId]
    );

    await client.query(
      `UPDATE user_settings
       SET
         budget = $1,
         categories = $2,
         members = $3,
         active_member_id = $4,
         pin_lock = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $6`,
      [
        DEFAULT_BUDGET,
        JSON.stringify(DEFAULT_CATEGORIES),
        JSON.stringify(DEFAULT_MEMBERS),
        DEFAULT_MEMBERS[0].id,
        JSON.stringify(DEFAULT_PIN_LOCK),
        userId
      ]
    );

    await client.query('COMMIT');

    return res.json(
      await getFullState(userId)
    );
  } catch (err) {
    await client.query('ROLLBACK');

    console.error('Reset error:', err.message);

    return res.status(500).json({
      error: 'Failed to reset data.'
    });
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------
// Static frontend
// ------------------------------------------------------------

const publicDir = path.join(__dirname, 'public');

app.use(
  express.static(publicDir, {
    index: false
  })
);

app.get(
  ['/', '/index.html'],
  requireAuthPage,
  (req, res) => {
    res.sendFile(
      path.join(publicDir, 'index.html')
    );
  }
);

// ------------------------------------------------------------
// 404
// ------------------------------------------------------------

app.use((req, res) => {
  res.status(404).send(
    '<h1>404 Not Found</h1>'
  );
});

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `Kudumbam Expense Tracker running at http://localhost:${PORT}/`
  );
});