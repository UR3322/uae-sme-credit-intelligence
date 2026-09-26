const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

const ALLOWED_ACTIONS = new Set(['APPROVE', 'REJECT', 'REFER_TO_COMMITTEE', 'REQUEST_INFO']);
const DECISION_STATUS = { APPROVE: 'APPROVED', REJECT: 'REJECTED', REFER_TO_COMMITTEE: 'REFERRED', REQUEST_INFO: 'INFO_REQUESTED' };

router.post('/', auth, auth.requireRole('CREDIT_ANALYST', 'RISK_MANAGER', 'ADMIN'), async (req, res) => {
  const { application_id, action, approved_amount, approved_tenure_months, analyst_notes } = req.body || {};
  const applicationId = Number(application_id);
  const amount = approved_amount === '' || approved_amount == null ? null : Number(approved_amount);
  const tenure = approved_tenure_months === '' || approved_tenure_months == null ? null : Number(approved_tenure_months);
  const notes = typeof analyst_notes === 'string' ? analyst_notes.trim() : '';

  if (!Number.isSafeInteger(applicationId) || applicationId < 1 || !ALLOWED_ACTIONS.has(action)) return res.status(400).json({ error: 'A valid application ID and decision action are required.' });
  if (notes.length > 2000) return res.status(400).json({ error: 'Analyst notes must be 2,000 characters or fewer.' });
  if ((amount !== null && (!Number.isFinite(amount) || amount <= 0)) || (tenure !== null && (!Number.isSafeInteger(tenure) || tenure < 1 || tenure > 120))) return res.status(400).json({ error: 'Approved amount and tenure must be positive, valid values.' });
  if (action === 'APPROVE' && (amount === null || tenure === null)) return res.status(400).json({ error: 'An approval requires an approved amount and tenure.' });
  if (!notes) return res.status(400).json({ error: 'Analyst notes are required.' });
  if (['APPROVE', 'REJECT'].includes(action) && !['RISK_MANAGER', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Final approval or rejection requires a risk manager or administrator.' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const application = await client.query('SELECT requested_amount FROM applications WHERE application_id = $1 FOR UPDATE', [applicationId]);
    if (!application.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Application not found.' });
    }
    if (action === 'APPROVE' && amount > Number(application.rows[0].requested_amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Approved amount cannot exceed the requested amount.' });
    }

    const decision = await client.query(`
      INSERT INTO credit_decisions (application_id, analyst_id, action, approved_amount, approved_tenure_months, analyst_notes)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING decision_id, created_at
    `, [applicationId, req.user.user_id, action, action === 'APPROVE' ? amount : null,
        action === 'APPROVE' ? tenure : null, notes]);
    await client.query('UPDATE applications SET status = $1 WHERE application_id = $2', [DECISION_STATUS[action], applicationId]);
    await client.query(`INSERT INTO audit_logs (user_id, action, resource, details) VALUES ($1, $2, $3, $4::jsonb)`,
      [req.user.user_id, `CREDIT_DECISION_${action}`, `applications/${applicationId}`,
       JSON.stringify({ decision_id: decision.rows[0].decision_id, action, approved_amount: amount, approved_tenure_months: tenure, analyst_notes: notes })]);
    await client.query('COMMIT');
    return res.status(201).json({ message: 'Decision recorded.', decision: decision.rows[0] });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Credit decision transaction failed:', err.message);
    return res.status(500).json({ error: 'Unable to record the decision.' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
