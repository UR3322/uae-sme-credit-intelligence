import React, { useEffect, useState } from 'react';
import { ShieldAlert, Users, DollarSign, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import API from '../services/api';

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];
const money = (value) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(Number(value || 0));

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    API.get('/dashboard/summary')
      .then(({ data }) => { if (active) setSummary(data); })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'Unable to load portfolio metrics.'); });
    return () => { active = false; };
  }, []);

  const riskDistribution = summary?.risk_distribution || [];
  const emirateData = summary?.emirate_distribution || [];
  const cards = [
    { label: 'Total Applications', value: summary?.total_applications ?? '—', icon: Users, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Requested Exposure', value: summary ? `AED ${money(summary.portfolio_exposure)}` : '—', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Average Model PD', value: summary ? `${(Number(summary.average_pd || 0) * 100).toFixed(1)}%` : '—', icon: Activity, color: 'text-amber-600 bg-amber-50' },
    { label: 'High Risk Alerts', value: summary?.high_risk_count ?? '—', icon: ShieldAlert, color: 'text-rose-600 bg-rose-50' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Portfolio Credit Intelligence</h1>
        <p className="text-xs text-slate-500">Portfolio metrics from the configured application database</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Prototype only: model scores and synthetic/demo records are not validated for real lending decisions.</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div><span className="text-xs font-semibold text-slate-500 uppercase">{label}</span><p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p></div>
            <div className={`p-3 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Risk Category Distribution</h3>
          <div className="h-64">{riskDistribution.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{riskDistribution.map((entry, index) => <Cell key={entry.name} fill={COLORS[index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <p className="pt-24 text-center text-sm text-slate-500">No portfolio data.</p>}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Applications by Emirate</h3>
          <div className="h-64">{emirateData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={emirateData}><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="pt-24 text-center text-sm text-slate-500">No portfolio data.</p>}</div>
        </div>
      </div>
    </div>
  );
}
