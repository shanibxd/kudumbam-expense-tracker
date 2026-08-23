// auth.js — password hashing, validation, and auth middleware helpers
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ name, email, password, confirmPassword }) {
  const errors = {};

  if (!name || !name.trim()) {
    errors.name = 'Full name is required.';
  } else if (name.trim().length < 2) {
    errors.name = 'Full name must be at least 2 characters.';
  }

  if (!email || !email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = 'Password must contain both letters and numbers.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function validateLogin({ email, password }) {
  const errors = {};
  if (!email || !email.trim()) errors.email = 'Email address is required.';
  if (!password) errors.password = 'Password is required.';
  return { valid: Object.keys(errors).length === 0, errors };
}

// Middleware: require an authenticated session for protected API routes
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated. Please log in.' });
}

// Middleware: require an authenticated session for protected HTML pages
function requireAuthPage(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login.html');
}

module.exports = {
  hashPassword,
  verifyPassword,
  validateRegistration,
  validateLogin,
  requireAuth,
  requireAuthPage
};
