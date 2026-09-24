import React from "react";
import { compareMaterialPrices } from "@/domain/estimate/materialPricing";

export default function MaterialPriceHistory({ currentUnitCost = 0, history = [] }) {
  if (!history.length) return <p className="text-[11px] text-muted-foreground">No historical material prices saved for this line yet.</p>;
  const comparison = compareMaterialPrices(currentUnitCost, history);
  return <div className="rounded-lg border border-border bg-muted/20 p-3">
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
      <span>Previous <strong>{money(comparison.previous)}</strong></span>
      <span>Average <strong>{money(comparison.average)}</strong></span>
      <span>Range <strong>{money(comparison.low)} – {money(comparison.high)}</strong></span>
      {comparison.changePct != null ? <span>Current change <strong>{comparison.changePct >= 0 ? "+" : ""}{comparison.changePct.toFixed(1)}%</strong></span> : null}
    </div>
    <div className="mt-2 max-h-32 overflow-auto">
      {history.slice(0, 10).map((row, index) => <div key={(row.capturedAt || "") + index} className="flex flex-wrap justify-between gap-2 border-t border-border py-1.5 text-[11px]">
        <span>{row.supplier || row.sourceType || "Unknown source"}{row.reference ? " · " + row.reference : ""}</span>
        <span><strong>{money(row.unitCost)}</strong> · {row.effectiveDate || row.capturedAt?.slice(0, 10) || "undated"}</span>
      </div>)}
    </div>
  </div>;
}
function money(value) { return "$" + Number(value || 0).toFixed(2); }
