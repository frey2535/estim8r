import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Calculator, ShieldCheck, TrendingUp } from "lucide-react";

const cards = [
  ["Create Estimate", "Build a bid using verified labor, company history and transparent productivity factors.", "/estimates/new", Calculator],
  ["Labor Library", "Search the master electrical trade labor taxonomy and inspect source verification.", "/labor", BookOpen],
  ["Production History", "Turn actual field production into company-specific labor intelligence.", "/production", TrendingUp],
];

export default function Dashboard() {
  return (
    <div className="py-4 sm:py-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Current Flow Consulting</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-foreground">Estim8r Command Center</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Estimate electrical work with traceable labor sources, company production history and estimator-controlled adjustments.</p>
      </div>
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {cards.map(([title, text, to, Icon]) => (
          <Link to={to} key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-blue-500/60 hover:shadow-md dark:hover:border-orange-500/60">
            <Icon className="mb-4 h-7 w-7 text-blue-600 dark:text-orange-500" />
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
          </Link>
        ))}
      </div>
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <div className="flex gap-4">
          <ShieldCheck className="h-7 w-7 text-emerald-500" />
          <div>
            <h2 className="font-bold text-foreground">Production Safety Gate</h2>
            <p className="mt-1 text-sm text-muted-foreground">Published/master labor is only production-ready when it is verified and explicitly approved. Unverified research baselines remain visible for review but cannot silently become bid labor.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
