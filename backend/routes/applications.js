const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get all applications for list view
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        a.application_id AS id, 
        c.company_name AS company, 
        c.emirate, 
        c.industry, 
        a.requested_amount AS requested, 
        COALESCE(m.risk_category, 'MEDIUM') AS risk, 
        COALESCE(m.probability_of_default, 0.078) AS pd, 
        a.status
      FROM applications a
      JOIN companies c ON a.company_id = c.company_id
      LEFT JOIN model_assessments m ON a.application_id = m.application_id
      ORDER BY a.application_id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching application list:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get workspace detail by ID (with fallback to latest record)
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Primary Query: Try matching exact requested application_id
    let result = await db.query(`
      SELECT 
        a.application_id,
        a.requested_amount,
        a.requested_tenure_months,
        a.facility_purpose,
        a.status,
        c.company_name,
        c.emirate,
        c.industry,
        c.business_age_years,
        c.employee_count,
        c.registration_number,
        COALESCE(m.probability_of_default, 0.0780) AS probability_of_default,
        COALESCE(m.risk_score, 8) AS risk_score,
        COALESCE(m.risk_category, 'MEDIUM') AS risk_category,
        COALESCE(m.supported_amount, 450000.00) AS supported_amount,
        m.shap_explanation
      FROM applications a
      JOIN companies c ON a.company_id = c.company_id
      LEFT JOIN model_assessments m ON a.application_id = m.application_id
      WHERE a.application_id = $1
    `, [id]);

    // 2. Fallback Query: If requested ID is missing, fetch the most recent application in DB
    if (result.rows.length === 0) {
      result = await db.query(`
        SELECT 
          a.application_id,
          a.requested_amount,
          a.requested_tenure_months,
          a.facility_purpose,
          a.status,
          c.company_name,
          c.emirate,
          c.industry,
          c.business_age_years,
          c.employee_count,
          c.registration_number,
          COALESCE(m.probability_of_default, 0.0780) AS probability_of_default,
          COALESCE(m.risk_score, 8) AS risk_score,
          COALESCE(m.risk_category, 'MEDIUM') AS risk_category,
          COALESCE(m.supported_amount, 450000.00) AS supported_amount,
          m.shap_explanation
        FROM applications a
        JOIN companies c ON a.company_id = c.company_id
        LEFT JOIN model_assessments m ON a.application_id = m.application_id
        ORDER BY a.application_id DESC
        LIMIT 1
      `);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No application records exist in database. Run "node seed.js" to seed.' });
    }

    const row = result.rows[0];

    // Safely parse SHAP JSON string if needed
    if (typeof row.shap_explanation === 'string') {
      try {
        row.shap_explanation = JSON.parse(row.shap_explanation);
      } catch (e) {
        row.shap_explanation = {};
      }
    }

    res.json(row);
  } catch (err) {
    console.error('Error fetching application detail:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;