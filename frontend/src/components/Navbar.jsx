import React from 'react';
import { Bell, LogOut, ShieldCheck } from 'lucide-react';

export default function Navbar({ user, onLogout }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg text-white"><ShieldCheck className="w-5 h-5" /></div>
        <div><span className="font-bold text-slate-900 text-base leading-none block">UAE-SME-CIP</span><span className="text-[10px] text-slate-500 font-medium">Credit Intelligence & Decision Engine</span></div>
      </div>
      <div className="flex items-center gap-4">
        <button type="button" aria-label="Notifications" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><Bell className="w-5 h-5" /></button>
        <div className="h-8 w-px bg-slate-200" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">{user?.full_name?.[0] || 'U'}</div>
          <div className="hidden md:block text-left"><span className="text-xs font-bold text-slate-800 block">{user?.full_name || 'Credit Analyst'}</span><span className="text-[10px] text-slate-500 block uppercase font-semibold">{user?.role || 'CREDIT_ANALYST'}</span></div>
        </div>
        <button type="button" onClick={onLogout} className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg ml-2" title="Sign Out" aria-label="Sign out"><LogOut className="w-5 h-5" /></button>
      </div>
    </header>
  );
}
