import React from "react";
import { describeReconciliation } from "@/domain/takeoff/countReconciliation";

const STATUS_COPY = {
  match: "Matches schedule",
  short: "Plan is short of schedule",
  over: "Plan is over schedule",
  "plan-only": "Plan only — no printed qty",
};

export default function ReconciliationPanel({ reconciliation, compact = false }) {
  if (!reconciliation?.rows?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground" data-testid="reconciliation-empty">
        No printed schedule quantities to check against. Takeoff quantities are the devices marked on the plan.
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid="reconciliation-panel">
      <p className="text-sm text-muted-foreground">{describeReconciliation(reconciliation)}</p>
      <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border" role="region" aria-label="Plan versus schedule quantities" tabIndex={0}>
        <table className="w-full min-w-[26rem] table-auto text-left text-xs">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-bold">Type</th>
              <th className="px-2 py-1.5 font-bold">Plan count</th>
              <th className="px-2 py-1.5 font-bold">Schedule qty</th>
              <th className="px-2 py-1.5 font-bold">Check</th>
            </tr>
          </thead>
          <tbody>
            {reconciliation.rows.map((row) => (
              <tr key={row.type} className="border-t border-border">
                <td className="min-w-0 break-words px-2 py-1.5 font-semibold">{row.type}</td>
                <td className="px-2 py-1.5">{row.planCount}</td>
                <td className="px-2 py-1.5">{row.scheduleQty == null ? "—" : row.scheduleQty}</td>
                <td className={`min-w-[8rem] whitespace-normal break-words px-2 py-1.5 ${row.status === "short" || row.status === "over" ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}>
                  {STATUS_COPY[row.status] || row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Scroll horizontally within the table to see all columns on narrow screens.</p>\n      {!compact ? (
        <p className="text-[11px] text-muted-foreground">
          Persisted takeoff is {reconciliation.persistedCount} plan device{reconciliation.persistedCount === 1 ? "" : "s"}.
          Legend totals are a review check only.
        </p>
      ) : null}
    </div>
  );
}
