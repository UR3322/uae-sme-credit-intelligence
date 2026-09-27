import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Plus } from 'lucide-react';
import API from '../services/api';

export default function ApplicationList() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    API.get('/applications')
      .then(({ data }) => { if (active) setApplications(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'Unable to load applications.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">SME Application Queue</h1>
          <p className="text-xs text-slate-500">Applications awaiting analyst review</p>
        </div>
        <button onClick={() => navigate('/applications/new')} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> New Application
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {loading ? <p className="p-6 text-sm text-slate-500" role="status">Loading applications…</p> : null}
        {!loading && error ? <p className="p-6 text-sm text-rose-700" role="alert">{error}</p> : null}
        {!loading && !error && applications.length === 0 ? <p className="p-6 text-sm text-slate-500">No applications found.</p> : null}
        {!loading && !error && applications.length > 0 && (
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              <tr><th className="p-4">App ID</th><th className="p-4">Company</th><th className="p-4">Emirate</th><th className="p-4">Requested Financing</th><th className="p-4">Risk</th><th className="p-4">PD</th><th className="p-4">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-slate-700">#{app.id}</td>
                  <td className="p-4 font-bold text-slate-900">{app.company}</td>
                  <td className="p-4 text-slate-600">{app.emirate}</td>
                  <td className="p-4 font-semibold text-slate-900">AED {Number(app.requested || 0).toLocaleString()}</td>
                  <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${app.risk === 'LOW' ? 'bg-emerald-100 text-emerald-800' : app.risk === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{app.risk}</span></td>
                  <td className="p-4 font-mono">{(Number(app.pd || 0) * 100).toFixed(1)}%</td>
                  <td className="p-4"><button onClick={() => navigate(`/applications/${app.id}`)} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">Open Workspace <ExternalLink className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
