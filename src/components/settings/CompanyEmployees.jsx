import React, { useEffect, useState } from "react";
import { requireSupabase } from "@/api/supabaseClient";
import { base44 } from "@/api/base44Client";

export default function CompanyEmployees() {
  const [employees, setEmployees] = useState([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resettingEmail, setResettingEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState("");
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  async function load() {
    try {
      // Claim a pending invitation automatically for the signed-in, verified email.
      const { error: activationError } = await requireSupabase().rpc("estim8r_activate_invited_employee");
      if (activationError) throw activationError;
      const { data: canManage, error: capabilityError } = await requireSupabase().rpc("estim8r_can_manage_company_employees");
      if (capabilityError) throw capabilityError;
      setIsCompanyAdmin(canManage === true);
      const { data, error } = await requireSupabase().rpc("estim8r_company_employees");
      if (error) throw error;
      setEmployees(data || []);
      setMessage("");
    } catch (error) {
      setIsCompanyAdmin(false);
      setMessage(error.message || "Unable to load employees.");
    } finally {
      setCheckingAccess(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function manageEmployee(employeeEmail, action) {
    if (!isCompanyAdmin) return;
    if (action === "delete" && !window.confirm(`Remove ${employeeEmail} from this company's access list? Their login account will be preserved.`)) return;
    setBusy(true);
    if (action === "reset" || action === "change") {
      if (action === "reset") setResettingEmail(employeeEmail);
      else setChangingEmail(employeeEmail);
      setMessage(`Requesting secure password ${action === "change" ? "change" : "reset"} for ${employeeEmail}…`);
    }
    try {
      if (action === "reset") {
        await base44.auth.resetPasswordRequest(employeeEmail);
        setMessage(`Password reset requested for ${employeeEmail}. Check that employee's inbox and spam folder. The link opens Estim8r's New Password page. If no email arrives, verify Supabase email delivery and redirect settings.`);
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
    } finally { setBusy(false); setResettingEmail(""); setChangingEmail(""); }
  }

  async function invite(event) {
    event.preventDefault();
    if (!isCompanyAdmin) return;
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
    {isCompanyAdmin && <form onSubmit={invite} className="mt-4 flex flex-wrap gap-2">
      <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="employee@company.com" aria-label="Employee email" className="min-h-10 min-w-60 flex-1 rounded-md border border-border bg-background px-3" />
      <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">{busy ? "Adding…" : "Add employee"}</button>
    </form>}
    {checkingAccess && <p className="mt-3 text-sm text-muted-foreground">Checking company permissions…</p>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    <div className="mt-4 space-y-2">{employees.map(row => <div key={row.email} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
      <div><span className="font-medium">{row.email}</span><span className="ml-3 text-muted-foreground">{row.status} · {row.role}</span></div>
      {isCompanyAdmin && row.role !== "owner" && row.role !== "admin" && row.role !== "company_admin" && <div className="flex flex-wrap gap-2">
        {row.status === "revoked" ? <button type="button" disabled={busy} onClick={() => void manageEmployee(row.email, "grant")} className="rounded border px-2 py-1">Restore access</button> : <button type="button" disabled={busy} onClick={() => void manageEmployee(row.email, "revoke")} className="rounded border px-2 py-1">Revoke</button>}
        <button type="button" disabled={busy} onClick={() => void manageEmployee(row.email, "reset")} className="rounded border px-2 py-1">{resettingEmail === row.email ? "Sending reset…" : "Reset password"}</button>
        <button type="button" disabled={busy} onClick={() => void manageEmployee(row.email, "change")} className="rounded border px-2 py-1">{changingEmail === row.email ? "Sending change link…" : "Change password"}</button>
        <button type="button" disabled={busy} onClick={() => void manageEmployee(row.email, "delete")} className="rounded border px-2 py-1 text-destructive">Remove</button>
      </div>}
    </div>)}</div>
  </section>;
}
