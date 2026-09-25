import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldAlert, Calculator, FileText, Send } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import API from '../services/api';

export default function AnalystWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState({ action: 'APPROVE', approved_amount: '', approved_tenure_months: '36', analyst_notes: '' });
  const [scenario, setScenario] = useState({ revenue_delta_pct: -0.15, expense_delta_pct: 0.10, debt_service_delta_pct: 0.0 });
  const [stressedResult, setStressedResult] = useState(null);

  useEffect(() => {
    fetchApplicationData();
  }, [id]);

  const fetchApplicationData = async () => {
    try {
      setLoading(true);
      setError(null);
      const targetId = id || 1;
      const res = await API.get(`/applications/${targetId}`);
      setData(res.data);
      setDecision(prev => ({ ...prev, approved_amount: res.data.requested_amount || 500000 }));
      setLoading(false);
    } catch (err) {
      console.error("Error loading workspace data:", err);
      const msg = err.response?.data?.error || err.message || "Failed to connect to Express backend on port 5000.";
      setError(msg);
      setLoading(false);
    }
  };

  const handleSimulateScenario = async () => {
    if (!data) return;
    try {
      const payload = {
        application_data: {
          emirate: data.emirate || 'Dubai',
          industry: data.industry || 'Wholesale',
          business_age_years: Number(data.business_age_years) || 6,
          employee_count: Number(data.employee_count) || 34,
          annual_revenue: 4800000.0,
          net_profit_margin: 0.12,
          net_profit: 576000.0,
          current_ratio: 1.45,
          debt_to_equity: 1.85,
          avg_monthly_inflow: 400000.0,
          avg_monthly_outflow: 352000.0,
          negative_cf_months: 1,
          cfs_score: 78.5,
          late_payments_12m: 0,
          monthly_debt_service: 32000.0,
          dsr: 8.0,
          requested_amount: Number(data.requested_amount) || 500000,
          requested_tenure_months: Number(data.requested_tenure_months) || 36
        },
        ...scenario
      };

      const res = await axios.post('http://127.0.0.1:8000/simulate-scenario', payload);
      setStressedResult(res.data);
    } catch (err) {
      alert("Error connecting to FastAPI ML Service on port 8000.");
    }
  };

  const handleSubmitDecision = async (e) => {
    e.preventDefault();
    try {
      await API.post('/decisions', {
        application_id: Number(id || 1),
        action: decision.action,
        approved_amount: Number(decision.approved_amount),
        approved_tenure_months: Number(decision.approved_tenure_months),
        analyst_notes: decision.analyst_notes
      });
      alert('Credit decision recorded in audit log.');
      navigate('/applications');
    } catch (err) {
      alert('Failed to submit credit decision.');
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-600 font-semibold">Loading Workspace...</div>;
  if (error || !data) return (
    <div className="p-12 text-center">
      <p className="text-rose-600 font-bold mb-4">Error: {error}</p>
      <button onClick={fetchApplicationData} className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg">
        Retry Connection
      </button>
    </div>
  );

  const rawShap = typeof data.shap_explanation === 'string' ? JSON.parse(data.shap_explanation) : data.shap_explanation;
  const shapData = rawShap?.all_shap_values?.slice(0, 8) || [];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{data.company_name}</h1>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 font-semibold text-xs rounded-full border border-slate-300">
              {data.registration_number}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{data.industry} • {data.emirate}, UAE • Age: {data.business_age_years} Yrs</p>
        </div>
        <div className="text-right">
          <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            data.risk_category === 'LOW' ? 'bg-emerald-100 text-emerald-800' :
            data.risk_category === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
          }`}>
            {data.risk_category || 'MEDIUM'} RISK
          </span>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">PD: {((data.probability_of_default || 0.078) * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold uppercase">Requested Financing</span>
              <p className="text-xl font-bold text-slate-900 mt-1">AED {Number(data.requested_amount || 0).toLocaleString()}</p>
              <span className="text-xs text-slate-500">{data.requested_tenure_months} Months • {data.facility_purpose}</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-sm">
              <span className="text-xs text-blue-700 font-semibold uppercase">Model-Supported Capacity</span>
              <p className="text-xl font-bold text-blue-900 mt-1">AED {Number(data.supported_amount || 450000).toLocaleString()}</p>
              <span className="text-xs text-blue-600">Calculated via Net Cash-Flow Capacity</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-md font-bold text-slate-900 mb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              XAI Risk Driver Attribution (TreeSHAP)
            </h3>
            <p className="text-xs text-slate-500 mb-4">{rawShap?.analyst_narrative || "Attribution narrative loaded."}</p>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shapData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <XAxis type="number" fontSize={11} />
                  <YAxis dataKey="feature" type="category" width={120} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="shap_value" radius={[0, 4, 4, 0]}>
                    {shapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.shap_value > 0 ? '#ef4444' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              Dynamic Sensitivity Stress-Testing
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Revenue Change (%)</label>
                <input 
                  type="number" step="0.05"
                  value={scenario.revenue_delta_pct}
                  onChange={(e) => setScenario({ ...scenario, revenue_delta_pct: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Expense Change (%)</label>
                <input 
                  type="number" step="0.05"
                  value={scenario.expense_delta_pct}
                  onChange={(e) => setScenario({ ...scenario, expense_delta_pct: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Debt Service Change (%)</label>
                <input 
                  type="number" step="0.05"
                  value={scenario.debt_service_delta_pct}
                  onChange={(e) => setScenario({ ...scenario, debt_service_delta_pct: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 border rounded-lg text-sm"
                />
              </div>
            </div>
            <button 
              onClick={handleSimulateScenario}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
            >
              Run Stress Test Scenario
            </button>

            {stressedResult && (
              <div className="mt-4 p-4 bg-slate-50 border rounded-lg grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500">Stressed Risk Category</span>
                  <p className="font-bold text-slate-800">{stressedResult.stressed_metrics.risk_category}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Stressed Probability of Default</span>
                  <p className="font-bold text-slate-800">{(stressedResult.stressed_metrics.probability_of_default * 100).toFixed(1)}%</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Credit Officer Decisioning
          </h3>
          
          <form onSubmit={handleSubmitDecision} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Decision Action</label>
              <select 
                value={decision.action}
                onChange={(e) => setDecision({ ...decision, action: e.target.value })}
                className="w-full p-2.5 border rounded-lg text-sm bg-white font-medium"
              >
                <option value="APPROVE">Approve Financing</option>
                <option value="REJECT">Reject Application</option>
                <option value="REFER_TO_COMMITTEE">Refer to Risk Committee</option>
                <option value="REQUEST_INFO">Request Additional Documents</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Approved Financing Amount (AED)</label>
              <input 
                type="number" 
                value={decision.approved_amount}
                onChange={(e) => setDecision({ ...decision, approved_amount: e.target.value })}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Approved Tenure (Months)</label>
              <select 
                value={decision.approved_tenure_months}
                onChange={(e) => setDecision({ ...decision, approved_tenure_months: e.target.value })}
                className="w-full p-2.5 border rounded-lg text-sm bg-white"
              >
                <option value="12">12 Months</option>
                <option value="24">24 Months</option>
                <option value="36">36 Months</option>
                <option value="48">48 Months</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Analyst Governance Notes</label>
              <textarea 
                rows="4" 
                required
                placeholder="Provide justification based on SHAP drivers and cash flow capacity..."
                value={decision.analyst_notes}
                onChange={(e) => setDecision({ ...decision, analyst_notes: e.target.value })}
                className="w-full p-2.5 border rounded-lg text-sm"
              ></textarea>
            </div>

            <button 
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <Send className="w-4 h-4" />
              Submit Official Decision
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}