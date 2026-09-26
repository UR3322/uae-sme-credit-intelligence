const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const staff = auth.requireRole('CREDIT_ANALYST', 'RISK_MANAGER', 'ADMIN');

router.get('/', auth, staff, async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT a.application_id AS id, c.company_name AS company, c.emirate, c.industry,
             a.requested_amount AS requested,
             COALESCE(m.risk_category, 'MEDIUM') AS risk,
             COALESCE(m.probability_of_default, 0.078) AS pd,
             a.status
      FROM applications a
      JOIN companies c ON a.company_id = c.company_id
      LEFT JOIN model_assessments m ON a.application_id = m.application_id
      ORDER BY a.application_id DESC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('Application list query failed:', err.message);
    return res.status(500).json({ error: 'Unable to load applications.' });
  }
});

router.get('/:id', auth, staff, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Application ID must be a positive integer.' });
  try {
    const result = await db.query(`
      SELECT a.application_id, a.requested_amount, a.requested_tenure_months,
             a.facility_purpose, a.status, c.company_name, c.emirate, c.industry,
             c.business_age_years, c.employee_count, c.registration_number,
             COALESCE(m.probability_of_default, 0.0780) AS probability_of_default,
             COALESCE(m.risk_score, 8) AS risk_score,
             COALESCE(m.risk_category, 'MEDIUM') AS risk_category,
             COALESCE(m.supported_amount, 450000.00) AS supported_amount,
             m.shap_explanation
      FROM applications a
      JOIN companies c ON a.company_id = c.company_id
      LEFT JOIN model_assessments m ON a.application_id = m.application_id
      WHERE a.application_id = $1
      LIMIT 1
    `, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Application not found.' });
    const row = result.rows[0];
    if (typeof row.shap_explanation === 'string') {
      try { row.shap_explanation = JSON.parse(row.shap_explanation); }
      catch (_err) { row.shap_explanation = {}; }
    }
    return res.json(row);
  } catch (err) {
    console.error('Application detail query failed:', err.message);
    return res.status(500).json({ error: 'Unable to load application.' });
  }
});

module.exports = router;
