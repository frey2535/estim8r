import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from '@/lib/SupabaseAuthContext';

export default function Login() {
  const { user, login, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { await login(email, password); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100">
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-400 text-slate-950"><Zap /></div><div><h1 className="text-2xl font-black">Estim8r</h1><p className="text-sm text-slate-400">Professional Electrical Estimating</p></div></div>
      {!configured && <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</div>}
      {error && <div className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      <label className="mb-2 block text-sm">Email</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="mb-5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3" />
      <label className="mb-2 block text-sm">Password</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" required className="mb-6 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3" />
      <button disabled={busy || !configured} className="w-full rounded-lg bg-amber-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </div>;
}
