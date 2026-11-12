import React, { useEffect, useState } from "react";
import { requireSupabase } from "@/api/supabaseClient";

export default function CompanyEmployees() {
  const [employees, setEmployees] = useState([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      // Claim a pending invitation automatically for the signed-in, verified email.
      const { error: activationError } = await requireSupabase().rpc("estim8r_activate_invited_employee");
      if (activationError) throw activationError;
      const { data, error } = await requireSupabase().rpc("estim8r_company_employees");
      if (error) throw error;
      setEmployees(data || []);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to load employees.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function manageEmployee(employeeEmail, action) {
    if (action === "delete" && !window.confirm(`Remove ${employeeEmail} from this company's access list? Their login account will be preserved.`)) return;
    setBusy(true);
    try {
      if (action === "reset") {
        const { error } = await requireSupabase().auth.resetPasswordForEmail(employeeEmail, {
          redirectTo: window.location.origin + "/",
        });
        if (error) throw error;
        setMessage("Password reset requested. If the account exists, an email will be sent.");
      } else {
        const { error } = await requireSupabase().rpc("estim8r_manage_company_employee", {
          p_email: employeeEmail, p_action: action,
        });
        if (error) throw error;
        await load();
        setMessage(`Company access ${action === "grant" ? "granted" : action === "revoke" ? "revoked" : "removed"} for ${employeeEmail}.`);
      }
    } catch (error) {
      setMessage(error.message || "Unable to update company access.");
    } finally { setBusy(false); }
  }

  async function invite(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await requireSupabase().rpc("estim8r_invite_company_employee", { p_email: email.trim().toLowerCase() });
      if (error) throw error;
      setEmail("");
      setMessage("Email preauthorized. Access becomes active automatically when the employee signs in with a verified matching account. No invitation email was sent.");
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
    <div className="mt-4 space-y-2">{employees.map(row => <div key={row.email} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
      <div><span className="font-medium">{row.email}</span><span className="ml-3 text-muted-foreground">{row.status === "preauthorized" ? "Preauthorized — awaiting verified account" : row.status === "active" ? "Active" : row.status === "revoked" ? "Revoked" : row.status === "pending_verification" ? "Pending email verification" : row.status} · {row.role}</span></div>
      {row.role !== "owner" && row.role !== "admin" && row.role !== "company_admin" && <div className="flex flex-wrap gap-2">
        {row.status === "revoked" ? <button type="button" disabled={busy} onClick={() => void manageEmployee(row.email, "grant")} className="rounded border px-2 py-1">Restore access</button> : <button type="button" disabled={busy} onClick={() => void manageEmployee(row.email, "revoke")} className="rounded border px-2 py-1">Revoke</button>}
        {row.status === "active" && <button type="button" disabled={busy} onClick={() => void manageEmployee(row.email, "reset")} className="rounded border px-2 py-1">Reset password</button>}
        <button type="button" disabled={busy} onClick={() => void manageEmployee(row.email, "delete")} className="rounded border px-2 py-1 text-destructive">Remove</button>
      </div>}
    </div>)}</div>
  </section>;
}
