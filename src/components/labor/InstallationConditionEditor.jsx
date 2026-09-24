import React from "react";
import { defaultInstallationConditions, installationConditionSummary } from "@/domain/labor/installationConditions";

export default function InstallationConditionEditor({ conditions = [], onChange }) {
  const rows = conditions.length ? conditions : defaultInstallationConditions();
  const summary = installationConditionSummary(rows);

  function patch(code, value) {
    onChange(rows.map((row) => row.code === code ? { ...row, ...value } : row));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-bold">Installation conditions</h2>
          <p className="mt-1 text-xs text-muted-foreground">Apply explicit field-condition adjustments. Estim8r does not invent percentages; the estimator controls each multiplier.</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          Combined multiplier <strong>{summary.multiplier.toFixed(3)}x</strong>
        </div>
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {rows.map((row) => (
          <div key={row.code} className="grid grid-cols-[auto_minmax(0,1fr)_6rem] items-center gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" checked={Boolean(row.enabled)} onChange={(e) => patch(row.code, { enabled: e.target.checked })} aria-label={"Enable " + row.label} />
            <div className="min-w-0">
              <div className="font-semibold">{row.label}</div>
              <input value={row.note || ""} onChange={(e) => patch(row.code, { note: e.target.value })} placeholder="Condition note" className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs" />
            </div>
            <label className="text-[11px] font-bold text-muted-foreground">Multiplier
              <input type="number" min="0.1" max="10" step="0.01" value={row.multiplier} onChange={(e) => patch(row.code, { multiplier: e.target.value })} disabled={!row.enabled} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-40" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
