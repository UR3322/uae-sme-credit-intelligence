const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const db = require('../config/db');
const auth = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' ||
        email.length > 254 || password.length < 1 || password.length > 1024) {
      return res.status(400).json({ error: 'A valid email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'A valid email and password are required.' });
    }

    const result = await db.query(
      'SELECT user_id, email, full_name, role, password_hash FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [normalizedEmail]
    );
    const user = result.rows[0];
    const isMatch = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!isMatch) {
      return res.status(401).json({ error: 'Authentication failed.' });
    }

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      auth.tokenOptions
    );

    return res.json({
      token,
      user: { user_id: user.user_id, email: user.email, full_name: user.full_name, role: user.role }
    });
  } catch (err) {
    console.error('Login failed:', err.message);
    return res.status(500).json({ error: 'Unable to authenticate at this time.' });
  }
});

module.exports = router;
