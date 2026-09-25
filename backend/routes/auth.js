const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔑 Login attempt received for: "${email}"`);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Fetch user case-insensitively
    const result = await db.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)', 
      [email.trim()]
    );
    
    if (result.rows.length === 0) {
      console.log(`❌ DB Lookup Failed: User "${email}" not found in database.`);
      return res.status(401).json({ error: 'Authentication failed.' });
    }

    const user = result.rows[0];

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.log(`❌ Password Mismatch for user: "${email}"`);
      return res.status(401).json({ error: 'Authentication failed.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'super_secret_uae_sme_cip_jwt_key_2026',
      { expiresIn: '24h' }
    );

    console.log(`✅ Login Success! User ID: ${user.user_id} (${user.email})`);

    res.json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('❌ Login Server Error:', err);
    res.status(500).json({ error: 'Server error during authentication.' });
  }
});

module.exports = router;