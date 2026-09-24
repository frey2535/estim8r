import React, { useMemo } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { auditEstimateCompleteness } from "@/domain/estimate/estimatingIntelligence";

export default function EstimateReadinessPanel({ checklist = [], onChange }) {
  const audit = useMemo(() => auditEstimateCompleteness(checklist), [checklist]);

  function patch(code, patchValue) {
    onChange?.(audit.rows.map((row) => row.code === code ? { ...row, ...patchValue } : row));
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-orange-500">Bid Readiness</p>
          <h2 className="mt-1 text-xl font-black">Estimate completeness check</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Confirm the costs and allowances that have been considered before this estimate is treated as bid ready.
            Optional items can be enabled when they apply to the project.
          </p>
        </div>
        <div className={audit.bidReady ? "rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 dark:bg-emerald-500/5" : "rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 dark:bg-amber-500/5"}>
          <div className="flex items-center gap-2">
            {audit.bidReady ? <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" /> : <CircleAlert className="h-5 w-5 text-amber-700 dark:text-amber-300" />}
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{audit.bidReady ? "Bid Ready" : "Review Required"}</div>
              <div className="text-sm font-black">{audit.addressedCount} / {audit.requiredCount} required items addressed</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 lg:grid-cols-2">
        {audit.rows.map((row) => (
          <div key={row.code} className={row.required && !row.addressed ? "rounded-xl border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-500/30 dark:bg-amber-500/5" : "rounded-xl border border-border p-3"}>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(row.addressed)}
                onChange={(e) => patch(row.code, { addressed: e.target.checked })}
                className="mt-1"
                aria-label={"Addressed " + row.label}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{row.label}</span>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(row.required)}
                      onChange={(e) => patch(row.code, { required: e.target.checked })}
                      aria-label={"Required " + row.label}
                    />
                    Required
                  </label>
                </div>
                <input
                  value={row.note || ""}
                  onChange={(e) => patch(row.code, { note: e.target.value })}
                  placeholder="Note / allowance / exclusion"
                  className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!audit.bidReady ? (
        <p className="mt-4 text-xs font-semibold text-amber-800 dark:text-amber-200">
          Missing required items: {audit.missing.map((row) => row.label).join(", ")}.
        </p>
      ) : (
        <p className="mt-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          All required estimate-completeness items have been addressed.
        </p>
      )}
    </section>
  );
}
