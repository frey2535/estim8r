import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { BACKUP_ADMIN_EMAIL, PLATFORM_OWNER_EMAIL, isPlatformOwner } from "@/lib/platformIdentity";
import {
  accessStatusLabel,
  canManageEstim8rAccess,
  canRevokeAccess,
  grantEstim8rAccess,
  listEstim8rAccess,
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

  if (!canManageEstim8rAccess(user)) return <Navigate to="/" replace />;

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
    setBusy(target);
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

  return (
    <div className="py-4 sm:py-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Platform owner</p>
      <h1 className="text-3xl font-black text-foreground">Estim8r access</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Signed in as {isPlatformOwner(user) ? "platform owner" : "backup admin"} ({user?.email}).
        Grant or revoke who can use Estim8r. Backup admin is {BACKUP_ADMIN_EMAIL}.
      </p>

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
            <table className="w-full min-w-[36rem] text-left text-sm">
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
                {rows.map((row) => (
                  <tr key={`${row.row_kind}-${row.email}-${row.profile_id || "invite"}`} className="border-b border-border/60">
                    <td className="py-3 pr-3 font-medium text-foreground">{row.email}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{row.full_name || "—"}</td>
                    <td className="py-3 pr-3">{accessStatusLabel(row)}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{row.source || "—"}</td>
                    <td className="py-3">
                      {canRevokeAccess(row) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={Boolean(busy)}
                          onClick={() => void revoke(row.email)}
                        >
                          {busy === row.email ? "Revoking…" : "Revoke"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-7 flex max-w-3xl items-start gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Shield className="mt-0.5 h-5 w-5 text-blue-600 dark:text-orange-500" />
        <div className="text-sm text-muted-foreground">
          <p><span className="font-semibold text-foreground">Platform owner:</span> {PLATFORM_OWNER_EMAIL}</p>
          <p className="mt-1"><span className="font-semibold text-foreground">Backup admin:</span> {BACKUP_ADMIN_EMAIL} — admin, not owner. Owner and backup admin cannot be revoked here.</p>
        </div>
      </div>
    </div>
  );
}
