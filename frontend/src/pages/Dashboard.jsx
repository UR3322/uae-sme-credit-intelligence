import React from 'react';
import { ShieldAlert, Users, DollarSign, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function Dashboard() {
  const riskDistribution = [
    { name: 'Low Risk', value: 621, color: '#10b981' },
    { name: 'Medium Risk', value: 431, color: '#f59e0b' },
    { name: 'High Risk', value: 112, color: '#ef4444' },
  ];

  const emirateData = [
    { name: 'Dubai', count: 560 },
    { name: 'Abu Dhabi', count: 380 },
    { name: 'Sharjah', count: 190 },
    { name: 'Ajman', count: 65 },
    { name: 'RAK', count: 53 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Portfolio Credit Intelligence</h1>
          <p className="text-xs text-slate-500">Real-time SME credit risk profile & exposure distribution</p>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Applications</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">1,248</p>
          </div>
          <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600"><Users className="w-5 h-5" /></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">Portfolio Exposure</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">AED 184.2M</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600"><DollarSign className="w-5 h-5" /></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">Average Portfolio PD</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">8.7%</p>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg text-amber-600"><Activity className="w-5 h-5" /></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">High Risk Alerts</span>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">112</p>
          </div>
          <div className="bg-rose-50 p-3 rounded-lg text-rose-600"><ShieldAlert className="w-5 h-5" /></div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Risk Category Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Applications by Emirate</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emirateData}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}