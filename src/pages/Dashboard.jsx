import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calculator, ShieldCheck, TrendingUp } from 'lucide-react';

const cards = [
  ['Create Estimate','Build a bid using verified labor, company history and transparent productivity factors.', '/estimates/new', Calculator],
  ['Labor Library','Search the master electrical trade labor taxonomy and inspect source verification.', '/labor', BookOpen],
  ['Production History','Turn actual field production into company-specific labor intelligence.', '/production', TrendingUp],
];
export default function Dashboard(){return <div className="p-8"><div className="mb-8"><p className="text-sm font-semibold uppercase tracking-widest text-amber-400">Current Flow Consulting</p><h1 className="mt-2 text-4xl font-black">Estim8r Command Center</h1><p className="mt-2 max-w-3xl text-slate-400">Estimate electrical work with traceable labor sources, company production history and estimator-controlled adjustments.</p></div><div className="mb-8 grid grid-cols-3 gap-4">{cards.map(([title,text,to,Icon])=><Link to={to} key={title} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-amber-400/60"><Icon className="mb-4 h-7 w-7 text-amber-400"/><h2 className="text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></Link>)}</div><div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6"><div className="flex gap-4"><ShieldCheck className="h-7 w-7 text-emerald-400"/><div><h2 className="font-bold">Production Safety Gate</h2><p className="mt-1 text-sm text-slate-400">Published/master labor is only production-ready when it is verified and explicitly approved. Unverified research baselines remain visible for review but cannot silently become bid labor.</p></div></div></div></div>}
