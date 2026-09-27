const express = require('express');
const axios = require('axios');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const staff = auth.requireRole('CREDIT_ANALYST', 'RISK_MANAGER', 'ADMIN');

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
const INDUSTRIES = ['Wholesale', 'Retail', 'Construction', 'Manufacturing', 'Services', 'Logistics', 'Technology', 'Healthcare', 'F&B'];
const RISK_CATEGORIES = new Set(['LOW', 'MEDIUM', 'HIGH']);

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
             a.annual_revenue, a.net_profit_margin, a.net_profit, a.current_ratio,
             a.debt_to_equity, a.avg_monthly_inflow, a.avg_monthly_outflow,
             a.negative_cf_months, a.cfs_score, a.late_payments_12m,
             a.monthly_debt_service, a.dsr,
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

function nonEmptyString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function validateIntake(body) {
  if (!body || typeof body !== 'object') return 'Request body must include company, application, and financials.';
  const { company, application, financials } = body;
  if (!company || typeof company !== 'object' || !application || typeof application !== 'object' || !financials || typeof financials !== 'object') {
    return 'Request body must include company, application, and financials.';
  }
  const parsed = {};

  parsed.company_name = nonEmptyString(company.company_name, 200);
  parsed.registration_number = nonEmptyString(company.registration_number, 100);
  parsed.facility_purpose = nonEmptyString(application.facility_purpose, 500);
  if (!parsed.company_name) return 'company.company_name must be a non-empty string of at most 200 characters.';
  if (!parsed.registration_number) return 'company.registration_number must be a non-empty string of at most 100 characters.';
  if (!parsed.facility_purpose) return 'application.facility_purpose must be a non-empty string of at most 500 characters.';

  const emirate = typeof company.emirate === 'string' ? company.emirate.trim() : '';
  const industry = typeof company.industry === 'string' ? company.industry.trim() : '';
  if (!EMIRATES.includes(emirate)) return `company.emirate must be one of: ${EMIRATES.join(', ')}.`;
  if (!INDUSTRIES.includes(industry)) return `company.industry must be one of: ${INDUSTRIES.join(', ')}.`;
  parsed.emirate = emirate;
  parsed.industry = industry;

  const businessAge = Number(company.business_age_years);
  const employeeCount = Number(company.employee_count);
  if (!Number.isSafeInteger(businessAge) || businessAge < 0) return 'company.business_age_years must be an integer of 0 or more.';
  if (!Number.isSafeInteger(employeeCount) || employeeCount < 1) return 'company.employee_count must be an integer of 1 or more.';
  parsed.business_age_years = businessAge;
  parsed.employee_count = employeeCount;

  const requestedAmount = Number(application.requested_amount);
  const tenure = Number(application.requested_tenure_months);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return 'application.requested_amount must be a positive number.';
  if (!Number.isSafeInteger(tenure) || tenure < 1 || tenure > 120) return 'application.requested_tenure_months must be an integer between 1 and 120.';
  parsed.requested_amount = requestedAmount;
  parsed.requested_tenure_months = tenure;

  const revenue = Number(financials.annual_revenue);
  const margin = Number(financials.net_profit_margin);
  const currentRatio = Number(financials.current_ratio);
  const debtToEquity = Number(financials.debt_to_equity);
  const debtService = Number(financials.monthly_debt_service);
  const latePayments = Number(financials.late_payments_12m);
  const negativeCf = financials.negative_cf_months === undefined ? 0 : Number(financials.negative_cf_months);
  if (!Number.isFinite(revenue) || revenue <= 0) return 'financials.annual_revenue must be a positive number.';
  if (!Number.isFinite(margin) || margin < -1 || margin > 1) return 'financials.net_profit_margin must be a number between -1 and 1.';
  if (!Number.isFinite(currentRatio) || currentRatio <= 0) return 'financials.current_ratio must be a positive number.';
  if (!Number.isFinite(debtToEquity) || debtToEquity <= 0) return 'financials.debt_to_equity must be a positive number.';
  if (!Number.isFinite(debtService) || debtService < 0) return 'financials.monthly_debt_service must be a number of 0 or more.';
  if (!Number.isSafeInteger(latePayments) || latePayments < 0) return 'financials.late_payments_12m must be an integer of 0 or more.';
  if (!Number.isSafeInteger(negativeCf) || negativeCf < 0) return 'financials.negative_cf_months must be an integer of 0 or more.';
  parsed.annual_revenue = revenue;
  parsed.net_profit_margin = margin;
  parsed.current_ratio = currentRatio;
  parsed.debt_to_equity = debtToEquity;
  parsed.monthly_debt_service = debtService;
  parsed.late_payments_12m = latePayments;
  parsed.negative_cf_months = negativeCf;

  parsed.net_profit = revenue * margin;
  parsed.avg_monthly_inflow = revenue / 12;
  parsed.avg_monthly_outflow = parsed.avg_monthly_inflow * (1 - margin);
  parsed.dsr = (debtService / parsed.avg_monthly_inflow) * 100;
  parsed.cfs_score = Math.min(100, Math.max(0,
    100 - negativeCf * 12 - Math.max(0, (parsed.avg_monthly_outflow / parsed.avg_monthly_inflow) - 0.80) * 150
  ));

  return parsed;
}

router.post('/', auth, staff, async (req, res) => {
  const parsed = validateIntake(req.body);
  if (typeof parsed === 'string') return res.status(400).json({ error: parsed });

  const baseUrl = process.env.PYTHON_ML_SERVICE_URL || 'http://ml-service:8000';
  const apiKey = process.env.ML_SERVICE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Scoring service is not configured.' });

  const mlInput = {
    emirate: parsed.emirate,
    industry: parsed.industry,
    business_age_years: parsed.business_age_years,
    employee_count: parsed.employee_count,
    annual_revenue: parsed.annual_revenue,
    net_profit_margin: parsed.net_profit_margin,
    net_profit: parsed.net_profit,
    current_ratio: parsed.current_ratio,
    debt_to_equity: parsed.debt_to_equity,
    avg_monthly_inflow: parsed.avg_monthly_inflow,
    avg_monthly_outflow: parsed.avg_monthly_outflow,
    negative_cf_months: parsed.negative_cf_months,
    cfs_score: parsed.cfs_score,
    late_payments_12m: parsed.late_payments_12m,
    monthly_debt_service: parsed.monthly_debt_service,
    dsr: parsed.dsr,
    requested_amount: parsed.requested_amount,
    requested_tenure_months: parsed.requested_tenure_months
  };

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const existing = await client.query('SELECT company_id FROM companies WHERE registration_number = $1', [parsed.registration_number]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Company with this registration number already exists.' });
    }
    const company = await client.query(`
      INSERT INTO companies (company_name, emirate, industry, business_age_years, employee_count, registration_number)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING company_id
    `, [parsed.company_name, parsed.emirate, parsed.industry, parsed.business_age_years, parsed.employee_count, parsed.registration_number]);

    const application = await client.query(`
      INSERT INTO applications (company_id, requested_amount, requested_tenure_months, facility_purpose, status,
        annual_revenue, net_profit_margin, net_profit, current_ratio, debt_to_equity,
        avg_monthly_inflow, avg_monthly_outflow, negative_cf_months, cfs_score,
        late_payments_12m, monthly_debt_service, dsr)
      VALUES ($1, $2, $3, $4, 'SUBMITTED', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING application_id
    `, [company.rows[0].company_id, parsed.requested_amount, parsed.requested_tenure_months, parsed.facility_purpose,
        parsed.annual_revenue, parsed.net_profit_margin, parsed.net_profit, parsed.current_ratio, parsed.debt_to_equity,
        parsed.avg_monthly_inflow, parsed.avg_monthly_outflow, parsed.negative_cf_months, parsed.cfs_score,
        parsed.late_payments_12m, parsed.monthly_debt_service, parsed.dsr]);
    const applicationId = application.rows[0].application_id;

    let predict, explain;
    try {
      const axiosConfig = {
        headers: { 'X-ML-API-Key': apiKey },
        timeout: 15000,
        maxBodyLength: 64 * 1024,
        maxContentLength: 64 * 1024
      };
      predict = await axios.post(`${baseUrl}/predict`, mlInput, axiosConfig);
      explain = await axios.post(`${baseUrl}/explain`, mlInput, axiosConfig);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Scoring service request failed:', err.message);
      return res.status(503).json({ error: 'Scoring service is temporarily unavailable.' });
    }

    const p = predict.data || {};
    const probabilityOfDefault = Number(p.probability_of_default);
    const riskScore = Number(p.risk_score);
    const supportedAmount = Number(p.affordability_analysis?.model_supported_amount);
    if (!Number.isFinite(probabilityOfDefault) || probabilityOfDefault < 0 || probabilityOfDefault > 1 ||
        !Number.isSafeInteger(riskScore) || riskScore < 0 || riskScore > 100 ||
        !RISK_CATEGORIES.has(p.risk_category) ||
        !Number.isFinite(supportedAmount) || supportedAmount < 0) {
      await client.query('ROLLBACK');
      console.error('Scoring service returned an invalid assessment.');
      return res.status(503).json({ error: 'Scoring service is temporarily unavailable.' });
    }

    await client.query(`
      INSERT INTO model_assessments (application_id, model_version, probability_of_default, risk_score, risk_category, supported_amount, shap_explanation)
      VALUES ($1, 'synthetic-v2', $2, $3, $4, $5, $6::jsonb)
    `, [applicationId, probabilityOfDefault, riskScore, p.risk_category, supportedAmount, JSON.stringify(explain.data || {})]);

    await client.query(`INSERT INTO audit_logs (user_id, action, resource, details) VALUES ($1, $2, $3, $4::jsonb)`,
      [req.user.user_id, 'APPLICATION_CREATED', `applications/${applicationId}`,
       JSON.stringify({ application_id: applicationId, company_name: parsed.company_name, registration_number: parsed.registration_number, requested_amount: parsed.requested_amount, requested_tenure_months: parsed.requested_tenure_months, risk_category: p.risk_category, model_version: 'synthetic-v2' })]);

    await client.query('COMMIT');
    return res.status(201).json({
      application_id: applicationId,
      company_name: parsed.company_name,
      registration_number: parsed.registration_number,
      requested_amount: parsed.requested_amount,
      requested_tenure_months: parsed.requested_tenure_months,
      status: 'SUBMITTED',
      probability_of_default: probabilityOfDefault,
      risk_score: riskScore,
      risk_category: p.risk_category,
      supported_amount: supportedAmount
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Application intake transaction failed:', err.message);
    return res.status(500).json({ error: 'Unable to create the application.' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
