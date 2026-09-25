import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Filter } from 'lucide-react';

export default function ApplicationList() {
  const navigate = useNavigate();

  const sampleApps = [
    { id: 101, company: 'Al-Baraka Trading LLC', emirate: 'Dubai', amount: 'AED 500,000', risk: 'MEDIUM', pd: '7.8%', status: 'UNDER_REVIEW' },
    { id: 102, company: 'Emirates Logistics Corp', emirate: 'Abu Dhabi', amount: 'AED 1,200,000', risk: 'LOW', pd: '2.1%', status: 'APPROVED' },
    { id: 103, company: 'Gulf Construction Supplies', emirate: 'Sharjah', amount: 'AED 350,000', risk: 'HIGH', pd: '18.4%', status: 'REFERRED' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">SME Application Queue</h1>
          <p className="text-xs text-slate-500">Active credit applications awaiting analyst decisioning</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="p-4">App ID</th>
              <th className="p-4">Company Name</th>
              <th className="p-4">Emirate</th>
              <th className="p-4">Requested Financing</th>
              <th className="p-4">Risk Level</th>
              <th className="p-4">PD (%)</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sampleApps.map((app) => (
              <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-mono font-bold text-slate-700">#{app.id}</td>
                <td className="p-4 font-bold text-slate-900">{app.company}</td>
                <td className="p-4 text-slate-600">{app.emirate}</td>
                <td className="p-4 font-semibold text-slate-900">{app.amount}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    app.risk === 'LOW' ? 'bg-emerald-100 text-emerald-800' :
                    app.risk === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {app.risk}
                  </span>
                </td>
                <td className="p-4 font-mono font-semibold text-slate-800">{app.pd}</td>
                <td className="p-4">
                  <button 
                    onClick={() => navigate(`/applications/${app.id}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Open Workspace
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}