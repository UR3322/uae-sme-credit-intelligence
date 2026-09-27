require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function seedDatabase() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEMO_SEED !== 'true') {
    throw new Error('Demo seeding is disabled unless ENABLE_DEMO_SEED=true is explicitly set for this one-time command.');
  }
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('Set DEMO_PASSWORD to a unique value of at least 12 characters in your local .env file.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(demoPassword, 12);
    const users = [
      ['analyst@uaebank.ae', 'Tariq Al-Mansoori', 'CREDIT_ANALYST'],
      ['risk.manager@uaebank.ae', 'Fatima Al-Hashimi', 'RISK_MANAGER'],
      ['admin@uaebank.ae', 'System Administrator', 'ADMIN']
    ];
    for (const [email, fullName, role] of users) {
      await client.query(`
        INSERT INTO users (email, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name, role = EXCLUDED.role
      `, [email, passwordHash, fullName, role]);
    }

    const company = await client.query(`
      INSERT INTO companies (company_name, emirate, industry, business_age_years, employee_count, registration_number)
      VALUES ('Al-Bahar Trading LLC', 'Dubai', 'Wholesale', 6, 34, 'UAE-DXB-98421')
      ON CONFLICT (registration_number) DO UPDATE SET company_name = EXCLUDED.company_name
      RETURNING company_id
    `);
    let application = await client.query(`
      SELECT application_id FROM applications
      WHERE company_id = $1 AND facility_purpose = 'Working Capital Expansion'
      ORDER BY application_id LIMIT 1
    `, [company.rows[0].company_id]);
    if (!application.rows.length) {
      application = await client.query(`
        INSERT INTO applications (company_id, requested_amount, requested_tenure_months, facility_purpose, status,
          annual_revenue, net_profit_margin, net_profit, current_ratio, debt_to_equity,
          avg_monthly_inflow, avg_monthly_outflow, negative_cf_months, cfs_score,
          late_payments_12m, monthly_debt_service, dsr)
        VALUES ($1, 500000, 36, 'Working Capital Expansion', 'SUBMITTED',
          4800000, 0.12, 576000, 1.45, 1.85,
          400000, 352000, 1, 78.5,
          0, 32000, 8)
        RETURNING application_id
      `, [company.rows[0].company_id]);
    }
    await client.query(`
      UPDATE applications
      SET annual_revenue = 4800000, net_profit_margin = 0.12, net_profit = 576000,
          current_ratio = 1.45, debt_to_equity = 1.85,
          avg_monthly_inflow = 400000, avg_monthly_outflow = 352000,
          negative_cf_months = 1, cfs_score = 78.5,
          late_payments_12m = 0, monthly_debt_service = 32000, dsr = 8
      WHERE application_id = $1
    `, [application.rows[0].application_id]);
    await client.query(`
      INSERT INTO model_assessments (application_id, model_version, probability_of_default, risk_score, risk_category, supported_amount, shap_explanation)
      VALUES ($1, 'synthetic-demo-v1', 0.0780, 8, 'MEDIUM', 450000.00, $2::jsonb)
      ON CONFLICT (application_id) DO NOTHING
    `, [application.rows[0].application_id, JSON.stringify({
      analyst_narrative: 'Synthetic demonstration data only; not a production credit assessment.',
      all_shap_values: [
        { feature: 'dsr', shap_value: 0.12, impact_direction: 'INCREASES_RISK' },
        { feature: 'cfs_score', shap_value: -0.08, impact_direction: 'DECREASES_RISK' },
        { feature: 'current_ratio', shap_value: -0.05, impact_direction: 'DECREASES_RISK' }
      ]
    })]);

    await client.query('COMMIT');
    console.log('Demo records seeded without deleting existing data.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await db.pool.end();
  }
}

seedDatabase().catch((err) => {
  console.error('Demo seed failed:', err.message);
  process.exitCode = 1;
});
