import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldAlert, Calculator, FileText, Send } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import API from '../services/api';

export default function AnalystWorkspace({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scenarioError, setScenarioError] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canFinalize = ['RISK_MANAGER', 'ADMIN'].includes(user?.role);
  const [decision, setDecision] = useState({ action: canFinalize ? 'APPROVE' : 'REQUEST_INFO', approved_amount: '', approved_tenure_months: '36', analyst_notes: '' });
  const [scenario, setScenario] = useState({ revenue_delta_pct: -0.15, expense_delta_pct: 0.10, debt_service_delta_pct: 0.0 });
  const [stressedResult, setStressedResult] = useState(null);

  const fetchApplicationData = async () => {
    try {
      setLoading(true); setError(null);
      const res = await API.get(`/applications/${id}`);
      setData(res.data);
      setDecision((prev) => ({ ...prev, approved_amount: res.data.requested_amount || '' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load application.');
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchApplicationData(); }, [id]);

  const handleSimulateScenario = async () => {
    if (!data) return;
    setScenarioError('');
    try {
      const payload = {
        application_data: {
          emirate: data.emirate || 'Dubai', industry: data.industry || 'Wholesale',
          business_age_years: Number(data.business_age_years) || 6,
          employee_count: Number(data.employee_count) || 34,
          annual_revenue: Number(data.annual_revenue ?? 4800000),
          net_profit_margin: Number(data.net_profit_margin ?? 0.12),
          net_profit: Number(data.net_profit ?? 576000),
          current_ratio: Number(data.current_ratio ?? 1.45),
          debt_to_equity: Number(data.debt_to_equity ?? 1.85),
          avg_monthly_inflow: Number(data.avg_monthly_inflow ?? 400000),
          avg_monthly_outflow: Number(data.avg_monthly_outflow ?? 352000),
          negative_cf_months: Number(data.negative_cf_months ?? 1),
          cfs_score: Number(data.cfs_score ?? 78.5),
          late_payments_12m: Number(data.late_payments_12m ?? 0),
          monthly_debt_service: Number(data.monthly_debt_service ?? 32000),
          dsr: Number(data.dsr ?? 8),
          requested_amount: Number(data.requested_amount),
          requested_tenure_months: Number(data.requested_tenure_months)
        }, ...scenario
      };
      const res = await API.post('/scenarios/simulate', payload);
      setStressedResult(res.data);
    } catch (err) { setScenarioError(err.response?.data?.error || 'Unable to run scenario.'); }
  };

  const handleSubmitDecision = async (e) => {
    e.preventDefault(); setDecisionError('');
    if (!decision.analyst_notes.trim()) { setDecisionError('Analyst governance notes are required — write a line or two of rationale before submitting.'); return; }
    if (decision.action === 'APPROVE') {
      const amt = Number(decision.approved_amount);
      if (!Number.isFinite(amt) || amt <= 0) { setDecisionError('Approved amount must be a positive number.'); return; }
      if (amt > Number(data.requested_amount)) { setDecisionError('Approved amount cannot exceed the requested amount.'); return; }
    }
    setSubmitting(true);
    try {
      await API.post('/decisions', {
        application_id: Number(id), action: decision.action,
        approved_amount: decision.approved_amount,
        approved_tenure_months: decision.approved_tenure_months,
        analyst_notes: decision.analyst_notes
      });
      navigate('/applications');
    } catch (err) { setDecisionError(err.response?.data?.error || 'Failed to submit credit decision.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-12 text-center text-slate-600 font-semibold" role="status">Loading workspace…</div>;
  if (error || !data) return <div className="p-12 text-center"><p className="text-rose-600 font-bold mb-4" role="alert">Error: {error || 'Application not found.'}</p><button onClick={fetchApplicationData} className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg">Retry</button></div>;

  let rawShap = data.shap_explanation;
  if (typeof rawShap === 'string') { try { rawShap = JSON.parse(rawShap); } catch (_err) { rawShap = {}; } }
  const shapData = Array.isArray(rawShap?.all_shap_values) ? rawShap.all_shap_values.slice(0, 8) : [];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
        <div><div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-slate-900">{data.company_name}</h1><span className="px-3 py-1 bg-slate-100 text-slate-700 font-semibold text-xs rounded-full border border-slate-300">{data.registration_number}</span></div><p className="text-sm text-slate-500 mt-1">{data.industry} • {data.emirate}, UAE • Age: {data.business_age_years} Yrs</p></div>
        <div className="text-right"><span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700">{data.risk_category || 'UNKNOWN'} RISK</span><p className="text-2xl font-extrabold text-slate-900 mt-2">Model PD: {(Number(data.probability_of_default || 0) * 100).toFixed(1)}%</p></div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-6 text-xs text-amber-900">Prototype / synthetic-data demonstration. Model outputs are not validated for credit underwriting and must not determine real lending outcomes.</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4"><div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><span className="text-xs text-slate-500 font-semibold uppercase">Requested Financing</span><p className="text-xl font-bold text-slate-900 mt-1">AED {Number(data.requested_amount || 0).toLocaleString()}</p><span className="text-xs text-slate-500">{data.requested_tenure_months} Months • {data.facility_purpose}</span></div><div className="bg-white p-5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-sm"><span className="text-xs text-blue-700 font-semibold uppercase">Model-Supported Capacity</span><p className="text-xl font-bold text-blue-900 mt-1">AED {Number(data.supported_amount || 0).toLocaleString()}</p><span className="text-xs text-blue-600">Prototype estimate; verify inputs and policy</span></div></div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h3 className="text-md font-bold text-slate-900 mb-2 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-indigo-600" />XAI Risk Driver Attribution (TreeSHAP)</h3><p className="text-xs text-slate-500 mb-4">{rawShap?.analyst_narrative || 'No explanation available.'}</p><div className="h-64">{shapData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={shapData} layout="vertical" margin={{ left: 40, right: 20 }}><XAxis type="number" fontSize={11} /><YAxis dataKey="feature" type="category" width={120} fontSize={11} /><Tooltip /><Bar dataKey="shap_value" radius={[0, 4, 4, 0]}>{shapData.map((entry, index) => <Cell key={`${entry.feature}-${index}`} fill={entry.shap_value > 0 ? '#ef4444' : '#10b981'} />)}</Bar></BarChart></ResponsiveContainer> : <p className="pt-24 text-center text-sm text-slate-500">No feature explanations available.</p>}</div></div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2"><Calculator className="w-5 h-5 text-indigo-600" />Dynamic Sensitivity Stress-Testing</h3><div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">{[['revenue_delta_pct','Revenue Change'],['expense_delta_pct','Expense Change'],['debt_service_delta_pct','Debt Service Change']].map(([key,label]) => <div key={key}><label htmlFor={key} className="text-xs font-semibold text-slate-600 block mb-1">{label} (%)</label><input id={key} type="number" step="0.05" min="-1" max="5" value={scenario[key]} onChange={(e) => setScenario({ ...scenario, [key]: Number(e.target.value) })} className="w-full px-3 py-1.5 border rounded-lg text-sm" /></div>)}</div><button onClick={handleSimulateScenario} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold">Run Stress Test Scenario</button>{scenarioError && <p role="alert" className="mt-3 text-xs text-rose-700">{scenarioError}</p>}{stressedResult && <div className="mt-4 p-4 bg-slate-50 border rounded-lg grid grid-cols-2 gap-4"><div><span className="text-xs text-slate-500">Stressed Risk Category</span><p className="font-bold text-slate-800">{stressedResult.stressed_metrics.risk_category}</p></div><div><span className="text-xs text-slate-500">Stressed Probability of Default</span><p className="font-bold text-slate-800">{(stressedResult.stressed_metrics.probability_of_default * 100).toFixed(1)}%</p></div></div>}</div>
        </div>
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit"><h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600" />Credit Officer Decisioning</h3>{!canFinalize && <p className="mb-3 text-xs text-slate-600">Analysts may request information or refer cases. Final approval/rejection requires a risk manager or administrator.</p>}<form onSubmit={handleSubmitDecision} className="space-y-4"><div><label htmlFor="decision-action" className="text-xs font-semibold text-slate-700 block mb-1">Decision Action</label><select id="decision-action" value={decision.action} onChange={(e) => setDecision({ ...decision, action: e.target.value })} className="w-full p-2.5 border rounded-lg text-sm bg-white font-medium">{canFinalize && <><option value="APPROVE">Approve Financing</option><option value="REJECT">Reject Application</option></>}<option value="REFER_TO_COMMITTEE">Refer to Risk Committee</option><option value="REQUEST_INFO">Request Additional Documents</option></select></div>{decision.action === 'APPROVE' && <><div><label htmlFor="approved-amount" className="text-xs font-semibold text-slate-700 block mb-1">Approved Financing Amount (AED)</label><input id="approved-amount" type="number" min="0.01" max={data.requested_amount} step="0.01" required value={decision.approved_amount} onChange={(e) => setDecision({ ...decision, approved_amount: e.target.value })} className="w-full p-2.5 border rounded-lg text-sm" /></div><div><label htmlFor="approved-tenure" className="text-xs font-semibold text-slate-700 block mb-1">Approved Tenure (Months)</label><select id="approved-tenure" value={decision.approved_tenure_months} onChange={(e) => setDecision({ ...decision, approved_tenure_months: e.target.value })} className="w-full p-2.5 border rounded-lg text-sm bg-white">{[12,24,36,48,60,72,84,96,108,120].map((months) => <option key={months} value={months}>{months} Months</option>)}</select></div></>}<div><label htmlFor="analyst-notes" className="text-xs font-semibold text-slate-700 block mb-1">Analyst Governance Notes</label><textarea id="analyst-notes" rows="4" maxLength={2000} placeholder="Record the evidence and rationale for human review." value={decision.analyst_notes} onChange={(e) => setDecision({ ...decision, analyst_notes: e.target.value })} className="w-full p-2.5 border rounded-lg text-sm" /></div>{decisionError && <p role="alert" className="text-xs text-rose-700">{decisionError}</p>}<button type="submit" disabled={submitting} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm"><Send className="w-4 h-4" />{submitting ? 'Saving…' : 'Submit Decision'}</button></form></div>
      </div>
    </div>
  );
}
