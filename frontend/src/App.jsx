import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ApplicationList = lazy(() => import('./pages/ApplicationList'));
const AnalystWorkspace = lazy(() => import('./pages/AnalystWorkspace'));

function readUser() {
  try {
    const raw = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    return raw && token ? JSON.parse(raw) : null;
  } catch (_err) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(readUser);
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Suspense fallback={<div className="p-8 text-center">Loading…</div>}><Login onLoginSuccess={setUser} /></Suspense>} />
        <Route path="/*" element={user ? (
          <div className="min-h-screen flex flex-col bg-slate-50">
            <Navbar user={user} onLogout={handleLogout} />
            <div className="flex flex-1"><Sidebar /><main className="flex-1"><Suspense fallback={<div className="p-8 text-center" role="status">Loading page…</div>}><Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/applications" element={<ApplicationList />} />
              <Route path="/applications/:id" element={<AnalystWorkspace user={user} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes></Suspense></main></div>
          </div>
        ) : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
