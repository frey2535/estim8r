import React, { useCallback, useEffect, useState } from "react";
import { createOwnerTestIssue, listEstim8rIssues } from "@/lib/issueNotifications";
import { Navigate } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  BACKUP_ADMIN_EMAIL,
  FIRST_CUSTOMER_ADMIN_EMAIL,
  FIRST_CUSTOMER_COMPANY,
  PLATFORM_OWNER_EMAIL,
  isPlatformOwner,
} from "@/lib/platformIdentity";
import {
  accessStatusLabel,
  canDeleteAccess,
  canManageEstim8rAccess,
  canReinstateAccess,
  canRevokeAccess,
  deleteEstim8rAccess,
  grantEstim8rAccess,
  listEstim8rAccess,
  reinstateEstim8rAccess,
  revokeEstim8rAccess,
} from "@/api/ownerAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OwnerAdmin() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [incidentError, setIncidentError] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testStatus, setTestStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await listEstim8rAccess());
    } catch (err) {
      setError(err?.message || "Could not load Estim8r access.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageEstim8rAccess(user)) void load();
  }, [load, user?.email]);

  useEffect(() => {
    if (!isPlatformOwner(user)) return;
    let active = true;
    const refresh = () => listEstim8rIssues().then(rows => { if (active) setIncidents(rows); }).catch(() => { if (active) setIncidentError("Unable to load incident notifications."); });
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [user?.email]);

  if (!canManageEstim8rAccess(user)) return <Navigate to="/" replace />;

  async function testNotifications() {
    setTestBusy(true);
    setIncidentError("");
    setTestStatus("");
    try {
      const id = await createOwnerTestIssue();
      const rows = await listEstim8rIssues();
      setIncidents(rows);
      if (!rows.some(item => item.id === id)) throw new Error("Test saved but could not be read back.");
      setTestStatus("Test notification recorded and verified. No crash or AI session occurred.");
    } catch (err) {
      setIncidentError(err?.message || "Test notification failed.");
    } finally {
      setTestBusy(false);
    }
  }

  async function grant(event) {
    event.preventDefault();
    setBusy("grant");
    setError("");
    setStatus("");
    try {
      const result = await grantEstim8rAccess(email);
      setEmail("");
      setStatus(result?.action === "invited"
        ? `Invited ${result.email}. They get Estim8r when they sign in.`
        : `Granted Estim8r access to ${result?.email || email}.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not grant access.");
    } finally {
      setBusy("");
    }
  }

  async function revoke(target) {
    setBusy(`revoke:${target}`);
    setError("");
    setStatus("");
    try {
      await revokeEstim8rAccess(target);
      setStatus(`Revoked Estim8r access for ${target}.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not revoke access.");
    } finally {
      setBusy("");
    }
  }

  async function removeAccess(target) {
    if (!window.confirm(`Delete Estim8r access for ${target}? This removes their Estim8r entitlement/invite from access management. It does not delete their Current Flow login.`)) {
      return;
    }
    setBusy(`delete:${target}`);
    setError("");
    setStatus("");
    try {
      await deleteEstim8rAccess(target);
      setStatus(`Deleted Estim8r access for ${target}.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not delete access.");
    } finally {
      setBusy("");
    }
  }

  async function reinstate(target) {
    setBusy(`reinstate:${target}`);
    setError("");
    setStatus("");
    try {
      await reinstateEstim8rAccess(target);
      setStatus(`Reinstated Estim8r access for ${target}.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not reinstate access.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="py-4 sm:py-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">
        {isPlatformOwner(user) ? "Platform owner" : "Current Flow backup admin"}
      </p>
      <h1 className="text-3xl font-black text-foreground">Estim8r access</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Signed in as {isPlatformOwner(user) ? "the Current Flow platform owner" : "Current Flow backup admin"} ({user?.email}).
        There is one platform owner. Grant, revoke, reinstate, or delete who can use Estim8r.
      </p>

      {isPlatformOwner(user) && <section className="mt-7 max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-sm" aria-label="Issue notifications">
        <h2 className="font-bold text-foreground">Issue notifications ({incidents.length} recent)</h2>
        <p className="mt-2 text-sm text-muted-foreground">Automatic crash reports. No AI or Cursor sessions are launched.</p>
        <Button type="button" variant="outline" className="mt-3" disabled={testBusy} onClick={() => void testNotifications()}>{testBusy ? "Testing…" : "Test notification"}</Button>
        {testStatus && <p role="status" className="mt-2 text-sm">{testStatus}</p>}
        {incidentError && <p role="alert">{incidentError}</p>}
        <ul className="mt-3 space-y-2">{incidents.map(item => <li key={item.id} className="rounded border p-3 text-sm">{item.category.replaceAll("_", " ")} · {item.route} · {new Date(item.created_at).toLocaleString()}</li>)}</ul>
      </section>}
      <div className="mt-7 max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-bold text-foreground">Grant access</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Approve an existing Current Flow user, or invite an email. Invited people receive access the next time they sign in.
        </p>
        <form onSubmit={grant} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="grant-email">User email</Label>
            <Input
              id="grant-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12"
              placeholder="name@company.com"
              required
            />
          </div>
          <Button type="submit" className="h-12 sm:mt-8" disabled={Boolean(busy)}>
            {busy === "grant" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Granting…</> : "Grant access"}
          </Button>
        </form>
      </div>

      <div className="mt-7 max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-foreground">Users and access status</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {status && <p className="mt-3 text-sm text-muted-foreground" role="status">{status}</p>}
        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading access…</p>
        ) : rows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No users yet. Grant access by email above.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Email</th>
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Source</th>
                  <th className="py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const showRevoke = canRevokeAccess(row);
                  const showReinstate = canReinstateAccess(row);
                  const showDelete = canDeleteAccess(row);
                  const protectedRow = !showRevoke && !showReinstate && !showDelete;
                  return (
                    <tr key={`${row.row_kind}-${row.email}-${row.profile_id || "invite"}`} className="border-b border-border/60">
                      <td className="py-3 pr-3 font-medium text-foreground">{row.email}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{row.full_name || "—"}</td>
                      <td className="py-3 pr-3">{accessStatusLabel(row)}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{row.source || "—"}</td>
                      <td className="py-3">
                        {protectedRow ? (
                          <span className="text-xs text-muted-foreground">Protected</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {showRevoke && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={Boolean(busy)}
                                onClick={() => void revoke(row.email)}
                              >
                                {busy === `revoke:${row.email}` ? "Revoking…" : "Revoke"}
                              </Button>
                            )}
                            {showReinstate && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={Boolean(busy)}
                                onClick={() => void reinstate(row.email)}
                              >
                                {busy === `reinstate:${row.email}` ? "Reinstating…" : "Reinstate"}
                              </Button>
                            )}
                            {showDelete && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={Boolean(busy)}
                                onClick={() => void removeAccess(row.email)}
                              >
                                {busy === `delete:${row.email}` ? "Deleting…" : "Delete"}
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-7 flex max-w-3xl items-start gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Shield className="mt-0.5 h-5 w-5 text-blue-600 dark:text-orange-500" />
        <div className="text-sm text-muted-foreground">
          <p><span className="font-semibold text-foreground">Platform owner:</span> {PLATFORM_OWNER_EMAIL} — the only platform owner ID.</p>
          <p className="mt-1"><span className="font-semibold text-foreground">Current Flow backup admin:</span> {BACKUP_ADMIN_EMAIL} — can grant, revoke, reinstate, and delete access, is not a second platform owner.</p>
          <p className="mt-1"><span className="font-semibold text-foreground">First customer:</span> {FIRST_CUSTOMER_COMPANY}. Company admin is {FIRST_CUSTOMER_ADMIN_EMAIL} — admins that company only, not the platform.</p>
          <p className="mt-1"><span className="font-semibold text-foreground">Delete</span> removes Estim8r entitlement/invite rows only — not the person’s Current Flow login.</p>
        </div>
      </div>
    </div>
  );
}
