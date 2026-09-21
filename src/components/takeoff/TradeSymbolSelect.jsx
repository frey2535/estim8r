import React from "react";
import { symbolsOnDrawingForTrade } from "@/domain/takeoff/trades";

export default function TradeSymbolSelect({
  trade,
  marks = [],
  pageKinds = {},
  category,
  value,
  onChange,
  className = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm",
  "aria-label": ariaLabel = "Device / symbol",
}) {
  const options = symbolsOnDrawingForTrade(trade, marks, { pageKinds, category })
    .filter((item) => item.trade === trade);
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
      {options.length === 0 ? <option value="">No devices on this drawing</option> : null}
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.abbr} — {item.label}
        </option>
      ))}
    </select>
  );
}
