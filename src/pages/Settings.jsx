import React from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">Administration</p>
      <h1 className="text-3xl font-black">Settings</h1>
      <div className="mt-7 max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="font-bold">Account & Tenant</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <dt className="text-slate-500">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-slate-500">Organization ID</dt>
          <dd className="font-mono text-xs">{user?.org_id || '—'}</dd>
          <dt className="text-slate-500">Role</dt>
          <dd>{user?.role}</dd>
          <dt className="text-slate-500">Organization role</dt>
          <dd>{user?.org_role}</dd>
        </dl>
      </div>
    </div>
  );
}
