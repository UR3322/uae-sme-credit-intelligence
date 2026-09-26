const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const staff = auth.requireRole('CREDIT_ANALYST', 'RISK_MANAGER', 'ADMIN');

router.get('/summary', auth, staff, async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT COUNT(*)::int AS total_applications,
             COALESCE(SUM(a.requested_amount), 0)::numeric(16,2) AS portfolio_exposure,
             COALESCE(AVG(m.probability_of_default), 0)::float AS average_pd,
             COUNT(*) FILTER (WHERE m.risk_category = 'HIGH')::int AS high_risk_count,
             COUNT(*) FILTER (WHERE m.risk_category = 'LOW')::int AS low_risk_count,
             COUNT(*) FILTER (WHERE m.risk_category = 'MEDIUM')::int AS medium_risk_count
      FROM applications a LEFT JOIN model_assessments m ON m.application_id = a.application_id
    `);
    const emirates = await db.query(`
      SELECT c.emirate AS name, COUNT(*)::int AS count
      FROM applications a JOIN companies c ON c.company_id = a.company_id
      GROUP BY c.emirate ORDER BY count DESC, c.emirate
    `);
    const row = result.rows[0];
    return res.json({ ...row, emirate_distribution: emirates.rows,
      risk_distribution: [
        { name: 'Low Risk', value: row.low_risk_count },
        { name: 'Medium Risk', value: row.medium_risk_count },
        { name: 'High Risk', value: row.high_risk_count }
      ] });
  } catch (err) {
    console.error('Dashboard query failed:', err.message);
    return res.status(500).json({ error: 'Unable to load dashboard summary.' });
  }
});

module.exports = router;
