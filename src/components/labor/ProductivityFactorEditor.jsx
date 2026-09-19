import React from "react";
import { productivitySummary } from "@/domain/labor/productivity";

export default function ProductivityFactorEditor({ factors = [], onChange }) {
  const summary = productivitySummary(factors);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Productivity factors</h3>
          <p className="text-xs text-muted-foreground">Each condition starts at 1.00. Change a multiplier only when the job needs it. Hours are not invented here.</p>
        </div>
        <p className="text-sm font-bold">Combined multiplier ×{summary.multiplier}</p>
      </div>
      {summary.active.length ? (
        <ul className="text-xs text-muted-foreground">
          {summary.active.map((factor) => (
            <li key={factor.code}>{factor.label}: ×{factor.multiplier}{factor.notes ? ` — ${factor.notes}` : ""}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No field adjustments applied.</p>
      )}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {summary.factors.map((factor) => (
          <label key={factor.code} className="rounded-lg border border-border px-3 py-2">
            <span className="block text-xs font-bold text-muted-foreground">{factor.label}</span>
            <input
              type="number"
              min="0.01"
              step="0.05"
              value={factor.multiplier}
              aria-label={`${factor.label} multiplier`}
              onChange={(e) => onChange?.(factor.code, e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
