import React, { useEffect, useState } from "react";
import { requireSupabase } from "@/api/supabaseClient";

export default function CompanyEmployees() {
  const [employees, setEmployees] = useState([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data, error } = await requireSupabase().rpc("estim8r_company_employees");
      if (error) throw error;
      setEmployees(data || []);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to load employees.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function invite(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await requireSupabase().rpc("estim8r_invite_company_employee", { p_email: email.trim().toLowerCase() });
      if (error) throw error;
      setEmail("");
      setMessage("Employee invitation recorded. The employee must sign in using this email.");
      await load();
    } catch (error) {
      setMessage(error.message || "Unable to invite employee.");
    } finally { setBusy(false); }
  }

  return <section id="company-employees" className="mt-7 max-w-4xl rounded-2xl border border-border bg-card p-6">
    <h2 className="text-lg font-bold">Company Employees</h2>
    <p className="mt-2 text-sm text-muted-foreground">Company administrators can add employees to their organization. Employee access is enforced by the server.</p>
    <form onSubmit={invite} className="mt-4 flex flex-wrap gap-2">
      <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="employee@company.com" aria-label="Employee email" className="min-h-10 min-w-60 flex-1 rounded-md border border-border bg-background px-3" />
      <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">{busy ? "Adding…" : "Add employee"}</button>
    </form>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    <div className="mt-4 space-y-2">{employees.map(row => <div key={row.email} className="flex flex-wrap justify-between gap-2 rounded-md border border-border p-3 text-sm"><span>{row.email}</span><span>{row.status} · {row.role}</span></div>)}</div>
  </section>;
}
