import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { platformRoleLabel } from "@/lib/platformIdentity";
import { readLinkedBuildrCompanyId } from "@/lib/buildrCompany";
import CompanyBrandingForm from "@/components/estimate/CompanyBrandingForm";
import BuildrCompanyForm from "@/components/platform/BuildrCompanyForm";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const platformRole = platformRoleLabel(user);

  useEffect(() => {
    const id = location.hash === "#buildr-company" ? "buildr-company" : location.hash === "#estimate-pdf" ? "estimate-pdf" : "";
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  return (
    <div className="py-4 sm:py-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Administration</p>
      <h1 className="text-3xl font-black text-foreground">Settings</h1>
      <div className="mt-7 max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-bold text-foreground">Account & Tenant</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <dt className="text-muted-foreground">Email</dt><dd>{user?.email}</dd>
          <dt className="text-muted-foreground">Organization ID</dt><dd className="font-mono text-xs">{user?.org_id || "—"}</dd>
          <dt className="text-muted-foreground">Role</dt><dd>{platformRole || user?.role}</dd>
          <dt className="text-muted-foreground">Organization role</dt><dd>{user?.org_role}</dd>
          <dt className="text-muted-foreground">Buildr company ID</dt><dd className="font-mono text-xs">{readLinkedBuildrCompanyId(user) || "—"}</dd>
        </dl>
        <Button type="button" variant="outline" className="mt-5" onClick={() => void logout()}>Sign out</Button>
      </div>
      <BuildrCompanyForm />
      <div id="estimate-pdf" className="mt-7 max-w-4xl scroll-mt-20">
        <CompanyBrandingForm showEstimateLink />
      </div>
    </div>
  );
}
