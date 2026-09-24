import React from "react";
import { estimateQualityGate } from "@/domain/estimate/estimateQualityGate";
export default function EstimateQualityGate({ lines, checklist, itemized, trueTakeoff }) {
  const audit = estimateQualityGate({ lines, checklist, itemized, trueTakeoff });
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-orange-500">Quality Gate</p><h2 className="mt-1 text-xl font-black">Final estimate audit</h2><p className="mt-1 text-sm text-muted-foreground">Checks completeness, labor basis, material-price provenance, AI review, and takeoff warnings before the estimate is treated as ready.</p></div><div className={audit.ready ? "rounded-lg bg-emerald-50 px-4 py-2 font-black text-emerald-700" : "rounded-lg bg-amber-50 px-4 py-2 font-black text-amber-800"}>{audit.ready ? "READY" : "REVIEW REQUIRED"}</div></div>
    <div className="mt-4 space-y-2">{audit.issues.length ? audit.issues.map((issue) => <div key={issue.code} className={issue.severity === "block" ? "rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" : "rounded-lg border border-border p-3 text-sm"}><strong>{issue.severity === "block" ? "Resolve: " : "Review: "}</strong>{issue.message}</div>) : <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">No blocking estimate-quality issues found.</p>}</div>
  </section>;
}
