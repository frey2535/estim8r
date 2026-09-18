import React from "react";
import { useAuth } from "@/lib/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="py-4 sm:py-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Administration</p>
      <h1 className="text-3xl font-black text-foreground">Settings</h1>
      <div className="mt-7 max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-bold text-foreground">Account & Tenant</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <dt className="text-muted-foreground">Email</dt><dd>{user?.email}</dd>
          <dt className="text-muted-foreground">Organization ID</dt><dd className="font-mono text-xs">{user?.org_id || "—"}</dd>
          <dt className="text-muted-foreground">Role</dt><dd>{user?.role}</dd>
          <dt className="text-muted-foreground">Organization role</dt><dd>{user?.org_role}</dd>
        </dl>
      </div>
    </div>
  );
}
