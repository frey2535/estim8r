import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, KeyRound, Lock, Mail, UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Register() {
  const [form, setForm] = useState({ email: "", password: "", confirm: "", organizationName: "", inviteCode: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  async function submit(event) {
    event.preventDefault(); setError(""); setMessage("");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const result = await base44.auth.register({ email: form.email, password: form.password, organizationName: form.inviteCode.trim() ? undefined : form.organizationName, inviteCode: form.inviteCode });
      if (result.pendingEmailConfirmation) setMessage("Account created. Confirm your email, then sign in to Estim8r.");
      else window.location.href = "/";
    } catch (err) { setError(err.message || "Registration failed."); } finally { setBusy(false); }
  }
  return <AuthLayout icon={UserPlus} title="Create Current Flow account" subtitle="One identity for the Current Flow electrical app suite" footer={<>Already registered? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link></>}>
    {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
    <form onSubmit={submit} className="space-y-4">
      <Field icon={Mail} label="Email"><Input type="email" autoComplete="email" value={form.email} onChange={set("email")} className="h-12 pl-10" required /></Field>
      <Field icon={Building2} label="Company / workspace (optional)"><Input autoComplete="organization" value={form.organizationName} onChange={set("organizationName")} className="h-12 pl-10" disabled={Boolean(form.inviteCode.trim())} placeholder="Only if you manage a team" /></Field>
      <Field icon={KeyRound} label="Team invite code (optional)"><Input value={form.inviteCode} onChange={(e) => setForm((c) => ({ ...c, inviteCode: e.target.value.toUpperCase() }))} className="h-12 pl-10 tracking-widest" placeholder="From your company admin" /></Field>
      <Field icon={Lock} label="Password"><Input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} className="h-12 pl-10" minLength={6} required /></Field>
      <Field icon={Lock} label="Confirm password"><Input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} className="h-12 pl-10" minLength={6} required /></Field>
      <Button className="h-12 w-full" disabled={busy}>{busy ? "Creating account..." : "Create account"}</Button>
    </form>
  </AuthLayout>;
}
function Field({ icon: Icon, label, children }) { return <div className="space-y-2"><Label>{label}</Label><div className="relative"><Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />{children}</div></div>; }
