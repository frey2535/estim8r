import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, BookOpen, Calculator, LogOut, Settings, TrendingUp, Zap } from 'lucide-react';
import { useAuth } from '@/lib/SupabaseAuthContext';

const links = [
  ['/', 'Dashboard', BarChart3],
  ['/estimates/new', 'New Estimate', Calculator],
  ['/labor', 'Labor Library', BookOpen],
  ['/production', 'Production', TrendingUp],
  ['/settings', 'Settings', Settings],
];

export default function AppShell() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-950 p-5">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400 text-slate-950"><Zap className="h-6 w-6" /></div>
          <div><div className="text-xl font-black tracking-tight">Estim8r</div><div className="text-xs text-slate-400">Electrical Estimating</div></div>
        </div>
        <nav className="space-y-1">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:bg-slate-900'}`}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 border-t border-slate-800 pt-4">
          <div className="mb-3 truncate text-xs text-slate-400">{user?.email}</div>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </aside>
      <main className="ml-64 min-h-screen"><Outlet /></main>
    </div>
  );
}
