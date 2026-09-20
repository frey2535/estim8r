import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { fetchBuildrAccountStatus, isBuildrConfigured } from "@/api/buildrBridge";
import { persistBuildrCompanyId, readLinkedBuildrCompanyId } from "@/lib/buildrCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BuildrCompanyForm() {
  const { user, checkAppState } = useAuth();
  const [companyId, setCompanyId] = useState(() => readLinkedBuildrCompanyId(user));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCompanyId(readLinkedBuildrCompanyId(user));
  }, [user?.email, user?.buildr_company_id]);

  async function apply(event) {
    event.preventDefault();
    const next = String(companyId || "").trim();
    setError("");
    setStatus("");
    if (!next) {
      setError("Enter a Buildr company ID to link.");
      return;
    }
    setBusy(true);
    try {
      await persistBuildrCompanyId(next, user);
      await checkAppState?.({ silent: true });
      if (isBuildrConfigured() && user?.email) {
        const account = await fetchBuildrAccountStatus(user.email, next);
        if (account.error) {
          setStatus(`Saved. Buildr lookup warning: ${account.error}`);
        } else if (account.companyId === next && account.canUseBuildr) {
          const count = account.projects?.length || 0;
          setStatus(`Linked. Buildr will use this company ID${count ? ` (${count} project${count === 1 ? "" : "s"})` : ""}. Login email remains the fallback.`);
        } else if (account.canUseBuildr && account.companyId) {
          setStatus(`Saved locally. Buildr is using ${account.companyId} from your login email instead of the ID you entered.`);
        } else {
          setStatus("Saved. Buildr did not match this company ID yet. Sync will still send it and fall back to your login email.");
        }
      } else {
        setStatus("Company ID saved. Estim8r will send it on the next Buildr sync.");
      }
    } catch (err) {
      setError(err?.message || "Could not save the company ID.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setError("");
    setBusy(true);
    try {
      await persistBuildrCompanyId("", user);
      setCompanyId("");
      await checkAppState?.({ silent: true });
      setStatus("Unlinked. Buildr sync will use your login email only.");
    } catch (err) {
      setError(err?.message || "Could not clear the company ID.");
    } finally {
      setBusy(false);
    }
  }

  const linked = Boolean(readLinkedBuildrCompanyId(user));

  return (
    <div id="buildr-company" className="mt-7 max-w-2xl scroll-mt-20 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-bold text-foreground">Buildr company</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Estim8r can sync by login email. Link a Buildr company ID when the email is not enough
        (different login, or a platform owner with no company of their own).
      </p>
      <form onSubmit={apply} className="mt-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="buildr-company-id">Buildr company ID</Label>
          <Input
            id="buildr-company-id"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            className="h-12 font-mono text-sm"
            autoComplete="off"
            placeholder="Paste the company ID from Buildr"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {status && <p className="text-sm text-muted-foreground" role="status">{status}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Apply company ID"}</Button>
          {linked && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void unlink()}>
              Unlink
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
