import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { isSupabaseConfigured } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const { isAuthenticated, checkAppState } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      await checkAppState();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-950/20 dark:bg-orange-500">
            <Zap />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Estim8r</h1>
            <p className="text-sm text-muted-foreground">Professional Electrical Estimating</p>
          </div>
        </div>
        {!isSupabaseConfigured && <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">Supabase is not configured.</div>}
        {error && <div className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">{error}</div>}
        <label className="mb-2 block text-sm text-foreground">Email</label>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mb-5 w-full rounded-lg border border-input bg-background px-3 py-3" />
        <label className="mb-2 block text-sm text-foreground">Password</label>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required className="mb-6 w-full rounded-lg border border-input bg-background px-3 py-3" />
        <button disabled={busy || !isSupabaseConfigured} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-orange-500 dark:hover:bg-orange-600 px-4 py-3 font-bold text-white disabled:opacity-50 transition-colors">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
