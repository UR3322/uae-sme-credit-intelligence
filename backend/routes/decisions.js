const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Post official credit decision
router.post('/', auth, async (req, res) => {
  try {
    const { application_id, action, approved_amount, approved_tenure_months, analyst_notes } = req.body;
    const analyst_id = req.user.user_id;

    if (!application_id || !action) {
      return res.status(400).json({ error: 'Application ID and decision action are required.' });
    }

    // 1. Insert Decision Record
    const decisionResult = await db.query(`
      INSERT INTO credit_decisions (
        application_id, analyst_id, action, approved_amount, approved_tenure_months, analyst_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING decision_id, created_at;
    `, [
      application_id, 
      analyst_id, 
      action, 
      approved_amount || null, 
      approved_tenure_months || null, 
      analyst_notes || ''
    ]);

    // 2. Map & Update Application Status
    let newStatus = 'UNDER_REVIEW';
    if (action === 'APPROVE') newStatus = 'APPROVED';
    else if (action === 'REJECT') newStatus = 'REJECTED';
    else if (action === 'REFER_TO_COMMITTEE') newStatus = 'REFERRED';

    await db.query(`
      UPDATE applications 
      SET status = $1 
      WHERE application_id = $2;
    `, [newStatus, application_id]);

    // 3. Create Audit Trail Entry
    await db.query(`
      INSERT INTO audit_logs (user_id, action, resource, details)
      VALUES ($1, $2, $3, $4::jsonb);
    `, [
      analyst_id,
      `CREDIT_DECISION_${action}`,
      `applications/${application_id}`,
      JSON.stringify({
        decision_id: decisionResult.rows[0].decision_id,
        action,
        approved_amount,
        approved_tenure_months,
        analyst_notes
      })
    ]);

    console.log(`✅ Credit Decision successfully logged for App ID ${application_id} by User ${analyst_id}`);

    res.status(201).json({
      message: 'Decision submitted successfully',
      decision: decisionResult.rows[0]
    });
  } catch (err) {
    console.error('❌ Error recording credit decision:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;