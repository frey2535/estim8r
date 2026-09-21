import React from "react";
import { symbolsForSelectedTrade } from "@/domain/takeoff/trades";

export default function TradeSymbolSelect({
  trade,
  drawingSymbols = [],
  category,
  value,
  onChange,
  className = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm",
  "aria-label": ariaLabel = "Device / symbol",
}) {
  const options = symbolsForSelectedTrade(trade, drawingSymbols, { category });
  const current = options.find((item) => item.id === value || item.abbr === value || item.label === value);
  return (
    <select
      aria-label={ariaLabel}
      className={className}
      value={current?.id || ""}
      onChange={(event) => {
        const next = options.find((item) => item.id === event.target.value);
        if (next) onChange(next);
      }}
    >
      {!current && value ? <option value="">{value}</option> : null}
      {options.length === 0 ? <option value="">No symbols for this trade</option> : null}
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.abbr} — {item.label}{item.page ? ` (sh ${item.page})` : ""}
        </option>
      ))}
    </select>
  );
}
