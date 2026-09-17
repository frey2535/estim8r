import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/lib/SupabaseAuthContext';
import AppShell from '@/components/AppShell';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import LaborLibrary from '@/pages/LaborLibrary';
import EstimateBuilder from '@/pages/EstimateBuilder';
import Production from '@/pages/Production';
import Settings from '@/pages/Settings';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">Loading Estim8r…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export default function App() {
  return <AuthProvider><QueryClientProvider client={queryClientInstance}><BrowserRouter><Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/labor" element={<LaborLibrary />} />
      <Route path="/estimates/new" element={<EstimateBuilder />} />
      <Route path="/production" element={<Production />} />
      <Route path="/settings" element={<Settings />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter><Toaster /></QueryClientProvider></AuthProvider>;
}
