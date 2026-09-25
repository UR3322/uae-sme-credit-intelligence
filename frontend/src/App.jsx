import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApplicationList from './pages/ApplicationList';
import AnalystWorkspace from './pages/AnalystWorkspace';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLoginSuccess={setUser} />} />
        
        <Route
          path="/*"
          element={
            user ? (
              <div className="min-h-screen flex flex-col bg-slate-50">
                <Navbar user={user} />
                <div className="flex flex-1">
                  <Sidebar />
                  <main className="flex-1">
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/applications" element={<ApplicationList />} />
                      <Route path="/applications/:id" element={<AnalystWorkspace />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </main>
                </div>
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}