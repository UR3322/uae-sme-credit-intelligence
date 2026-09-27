import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2 } from 'lucide-react';
import API from '../services/api';

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
const INDUSTRIES = ['Wholesale', 'Retail', 'Construction', 'Manufacturing', 'Services', 'Logistics', 'Technology', 'Healthcare', 'F&B'];
const TENURES = [12, 24, 36, 48, 60];

const initialForm = {
  company_name: '', registration_number: '', emirate: 'Dubai', industry: 'Wholesale',
  business_age_years: '', employee_count: '',
  annual_revenue: '', net_profit_margin: '', current_ratio: '', debt_to_equity: '',
  late_payments_12m: '', monthly_debt_service: '', negative_cf_months: '',
  requested_amount: '', requested_tenure_months: '36', facility_purpose: '',
};

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full p-2.5 border rounded-lg text-sm';
const selectCls = 'w-full p-2.5 border rounded-lg text-sm bg-white';

export default function NewApplication() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const validate = () => {
    const f = form;
    const requiredText = [
      ['company_name', 'Company name'],
      ['registration_number', 'Registration number'],
      ['facility_purpose', 'Facility purpose'],
    ];
    for (const [key, label] of requiredText) {
      if (!String(f[key]).trim()) return `${label} is required.`;
    }
    const positive = [
      ['business_age_years', 'Business age'],
      ['employee_count', 'Employee count'],
      ['annual_revenue', 'Annual revenue'],
      ['current_ratio', 'Current ratio'],
      ['debt_to_equity', 'Debt to equity'],
      ['monthly_debt_service', 'Monthly debt service'],
      ['requested_amount', 'Requested amount'],
    ];
    for (const [key, label] of positive) {
      const v = Number(f[key]);
      if (f[key] === '' || !Number.isFinite(v) || v <= 0) return `${label} must be a positive number.`;
    }
    const nonNegativeInts = [
      ['late_payments_12m', 'Late payments (12m)'],
      ['negative_cf_months', 'Negative cash-flow months'],
    ];
    for (const [key, label] of nonNegativeInts) {
      const v = Number(f[key]);
      if (f[key] === '' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) return `${label} must be a whole number of 0 or more.`;
    }
    const margin = Number(f.net_profit_margin);
    if (f.net_profit_margin === '' || !Number.isFinite(margin)) return 'Net profit margin is required and must be a number.';
    if (margin < -1 || margin > 1) return 'Net profit margin must be between -1 and 1 (e.g. 0.12 for 12%).';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const validationError = validate();
    if (validationError) { setFormError(validationError); return; }
    setSubmitting(true);
    try {
      const payload = {
        company: {
          company_name: form.company_name.trim(),
          registration_number: form.registration_number.trim(),
          emirate: form.emirate,
          industry: form.industry,
          business_age_years: Number(form.business_age_years),
          employee_count: Number(form.employee_count),
        },
        application: {
          requested_amount: Number(form.requested_amount),
          requested_tenure_months: Number(form.requested_tenure_months),
          facility_purpose: form.facility_purpose.trim(),
        },
        financials: {
          annual_revenue: Number(form.annual_revenue),
          net_profit_margin: Number(form.net_profit_margin),
          current_ratio: Number(form.current_ratio),
          debt_to_equity: Number(form.debt_to_equity),
          late_payments_12m: Number(form.late_payments_12m),
          monthly_debt_service: Number(form.monthly_debt_service),
          negative_cf_months: Number(form.negative_cf_months),
        },
      };
      const res = await API.post('/applications', payload);
      navigate(`/applications/${res.data.application_id}`);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to submit application.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">New Financing Application</h1>
            <FilePlus2 className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-sm text-slate-500 mt-1">Register a new SME financing application for underwriting intake</p>
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-6 text-xs text-amber-900">Prototype / synthetic-data demonstration. Model outputs are not validated for credit underwriting and must not determine real lending outcomes.</div>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-md font-bold text-slate-900 mb-4">Company Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name *" htmlFor="company_name">
              <input id="company_name" type="text" required value={form.company_name} onChange={set('company_name')} className={inputCls} />
            </Field>
            <Field label="Registration Number *" htmlFor="registration_number">
              <input id="registration_number" type="text" required value={form.registration_number} onChange={set('registration_number')} className={inputCls} />
            </Field>
            <Field label="Emirate *" htmlFor="emirate">
              <select id="emirate" value={form.emirate} onChange={set('emirate')} className={selectCls}>
                {EMIRATES.map((em) => <option key={em} value={em}>{em}</option>)}
              </select>
            </Field>
            <Field label="Industry *" htmlFor="industry">
              <select id="industry" value={form.industry} onChange={set('industry')} className={selectCls}>
                {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </Field>
            <Field label="Business Age (Years) *" htmlFor="business_age_years">
              <input id="business_age_years" type="number" min="0.01" step="0.5" required value={form.business_age_years} onChange={set('business_age_years')} className={inputCls} />
            </Field>
            <Field label="Employee Count *" htmlFor="employee_count">
              <input id="employee_count" type="number" min="1" step="1" required value={form.employee_count} onChange={set('employee_count')} className={inputCls} />
            </Field>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-md font-bold text-slate-900 mb-4">Financial Snapshot</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Annual Revenue (AED) *" htmlFor="annual_revenue">
              <input id="annual_revenue" type="number" min="0.01" step="0.01" required value={form.annual_revenue} onChange={set('annual_revenue')} className={inputCls} />
            </Field>
            <Field label="Net Profit Margin (decimal, e.g. 0.12) *" htmlFor="net_profit_margin">
              <input id="net_profit_margin" type="number" min="-1" max="1" step="0.01" required value={form.net_profit_margin} onChange={set('net_profit_margin')} className={inputCls} />
            </Field>
            <Field label="Current Ratio *" htmlFor="current_ratio">
              <input id="current_ratio" type="number" min="0.01" step="0.01" required value={form.current_ratio} onChange={set('current_ratio')} className={inputCls} />
            </Field>
            <Field label="Debt to Equity *" htmlFor="debt_to_equity">
              <input id="debt_to_equity" type="number" min="0.01" step="0.01" required value={form.debt_to_equity} onChange={set('debt_to_equity')} className={inputCls} />
            </Field>
            <Field label="Late Payments (12 Months) *" htmlFor="late_payments_12m">
              <input id="late_payments_12m" type="number" min="0" step="1" required value={form.late_payments_12m} onChange={set('late_payments_12m')} className={inputCls} />
            </Field>
            <Field label="Monthly Debt Service (AED) *" htmlFor="monthly_debt_service">
              <input id="monthly_debt_service" type="number" min="0.01" step="0.01" required value={form.monthly_debt_service} onChange={set('monthly_debt_service')} className={inputCls} />
            </Field>
            <Field label="Negative Cash-Flow Months *" htmlFor="negative_cf_months">
              <input id="negative_cf_months" type="number" min="0" step="1" required value={form.negative_cf_months} onChange={set('negative_cf_months')} className={inputCls} />
            </Field>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-md font-bold text-slate-900 mb-4">Financing Request</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Requested Amount (AED) *" htmlFor="requested_amount">
              <input id="requested_amount" type="number" min="0.01" step="0.01" required value={form.requested_amount} onChange={set('requested_amount')} className={inputCls} />
            </Field>
            <Field label="Requested Tenure (Months) *" htmlFor="requested_tenure_months">
              <select id="requested_tenure_months" value={form.requested_tenure_months} onChange={set('requested_tenure_months')} className={selectCls}>
                {TENURES.map((t) => <option key={t} value={t}>{t} Months</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Facility Purpose *" htmlFor="facility_purpose">
                <input id="facility_purpose" type="text" required placeholder="e.g. Working capital" value={form.facility_purpose} onChange={set('facility_purpose')} className={inputCls} />
              </Field>
            </div>
          </div>
        </div>
        {formError && <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{formError}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm shadow-sm">
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
          <button type="button" disabled={submitting} onClick={() => navigate('/applications')} className="px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 font-semibold rounded-lg text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
