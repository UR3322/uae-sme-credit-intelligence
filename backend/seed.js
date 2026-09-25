require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function seedDatabase() {
  try {
    console.log('🌱 Starting Database Seeding on Cloud DB...');

    // 1. Clear existing records & RESTART IDENTITY sequences to 1
    await db.query('TRUNCATE users, companies, applications, model_assessments, credit_decisions, audit_logs RESTART IDENTITY CASCADE;');

    // 2. Hash test password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // 3. Insert Default Test Users (Will start at ID 1)
    const usersResult = await db.query(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES 
        ('analyst@uaebank.ae', $1, 'Tariq Al-Mansoori', 'CREDIT_ANALYST'),
        ('risk.manager@uaebank.ae', $1, 'Fatima Al-Hashimi', 'RISK_MANAGER'),
        ('admin@uaebank.ae', $1, 'System Administrator', 'ADMIN')
      RETURNING user_id, email, role;
    `, [hashedPassword]);

    console.log('✅ Seeded Test Users:', usersResult.rows);

    // 4. Insert Sample Company (ID 1)
    const companyResult = await db.query(`
      INSERT INTO companies (company_name, emirate, industry, business_age_years, employee_count, registration_number)
      VALUES ('Al-Bahar Trading LLC', 'Dubai', 'Wholesale', 6, 34, 'UAE-DXB-98421')
      RETURNING company_id;
    `);
    const companyId = companyResult.rows[0].company_id;

    // 5. Insert Sample Application (ID 1)
    const appResult = await db.query(`
      INSERT INTO applications (company_id, requested_amount, requested_tenure_months, facility_purpose, status)
      VALUES ($1, 500000, 36, 'Working Capital Expansion', 'SUBMITTED')
      RETURNING application_id;
    `, [companyId]);
    const applicationId = appResult.rows[0].application_id;

    // 6. Insert Model Assessment (ID 1)
    await db.query(`
      INSERT INTO model_assessments (
        application_id, model_version, probability_of_default, risk_score, 
        risk_category, supported_amount, shap_explanation
      )
      VALUES (
        $1, 'v1.0.0-xgb', 0.0780, 8, 'MEDIUM', 450000.00,
        $2::jsonb
      )
    `, [
      applicationId,
      JSON.stringify({
        analyst_narrative: "Risk score is primarily influenced by leverage ratio, mitigated by steady cash inflows.",
        all_shap_values: [
          { feature: "dsr", shap_value: 0.12, impact_direction: "INCREASES_RISK" },
          { feature: "cfs_score", shap_value: -0.08, impact_direction: "DECREASES_RISK" },
          { feature: "current_ratio", shap_value: -0.05, impact_direction: "DECREASES_RISK" },
          { feature: "late_payments_12m", shap_value: 0.04, impact_direction: "INCREASES_RISK" },
          { feature: "debt_to_equity", shap_value: 0.03, impact_direction: "INCREASES_RISK" }
        ]
      })
    ]);

    console.log(`🎉 Seeding Complete! Application ID is explicitly reset to: ${applicationId}`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Database Seeding Error:', err);
    process.exit(1);
  }
}

seedDatabase();