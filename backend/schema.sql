CREATE TABLE IF NOT EXISTS users (
  user_id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CREDIT_ANALYST', 'RISK_MANAGER', 'ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS companies (
  company_id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  emirate TEXT NOT NULL,
  industry TEXT NOT NULL,
  business_age_years INTEGER NOT NULL CHECK (business_age_years >= 0),
  employee_count INTEGER NOT NULL CHECK (employee_count >= 1),
  registration_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  application_id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(company_id),
  requested_amount NUMERIC(16,2) NOT NULL CHECK (requested_amount > 0),
  requested_tenure_months INTEGER NOT NULL CHECK (requested_tenure_months BETWEEN 1 AND 120),
  facility_purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REFERRED', 'INFO_REQUESTED')),
  annual_revenue NUMERIC(16,2) NOT NULL,
  net_profit_margin NUMERIC(8,4) NOT NULL,
  net_profit NUMERIC(16,2) NOT NULL,
  current_ratio NUMERIC(8,2) NOT NULL,
  debt_to_equity NUMERIC(8,2) NOT NULL,
  avg_monthly_inflow NUMERIC(16,2) NOT NULL,
  avg_monthly_outflow NUMERIC(16,2) NOT NULL,
  negative_cf_months INTEGER NOT NULL CHECK (negative_cf_months >= 0),
  cfs_score NUMERIC(8,2) NOT NULL,
  late_payments_12m INTEGER NOT NULL CHECK (late_payments_12m >= 0),
  monthly_debt_service NUMERIC(16,2) NOT NULL,
  dsr NUMERIC(8,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_assessments (
  assessment_id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL UNIQUE REFERENCES applications(application_id) ON DELETE CASCADE,
  model_version TEXT NOT NULL,
  probability_of_default NUMERIC(8,7) NOT NULL CHECK (probability_of_default BETWEEN 0 AND 1),
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_category TEXT NOT NULL CHECK (risk_category IN ('LOW', 'MEDIUM', 'HIGH')),
  supported_amount NUMERIC(16,2) NOT NULL CHECK (supported_amount >= 0),
  shap_explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_decisions (
  decision_id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(application_id),
  analyst_id BIGINT NOT NULL REFERENCES users(user_id),
  action TEXT NOT NULL CHECK (action IN ('APPROVE', 'REJECT', 'REFER_TO_COMMITTEE', 'REQUEST_INFO')),
  approved_amount NUMERIC(16,2) CHECK (approved_amount IS NULL OR approved_amount > 0),
  approved_tenure_months INTEGER CHECK (approved_tenure_months IS NULL OR approved_tenure_months BETWEEN 1 AND 120),
  analyst_notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((action = 'APPROVE' AND approved_amount IS NOT NULL AND approved_tenure_months IS NOT NULL) OR action <> 'APPROVE')
);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_status_created ON applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company_id);
CREATE INDEX IF NOT EXISTS idx_decisions_application_created ON credit_decisions(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_created ON audit_logs(resource, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
