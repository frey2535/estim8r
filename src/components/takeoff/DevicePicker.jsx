import React from "react";
import { filterSymbols } from "@/domain/takeoff/catalog";

export default function DevicePicker({
  trades = [],
  trade,
  onTrade,
  categories,
  category,
  onCategory,
  symbols,
  symbolId,
  onSymbol,
  query,
  onQuery,
  compact = false,
}) {
  const visible = filterSymbols(symbols, query);
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-muted-foreground">
        Trade
        <select
          aria-label="Trade"
          value={trade}
          onChange={(event) => onTrade(event.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm font-semibold text-foreground"
        >
          {trades.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      {!compact && (
        <>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">Search devices</label>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="2x2, pendant, GFCI, EMT 3/4…"
            className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
          />
          <label className="mb-1 block text-xs font-bold text-muted-foreground">Category</label>
          <select value={category} onChange={(event) => onCategory(event.target.value)} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm">
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </>
      )}
      <label className="mb-1 block text-xs font-bold text-muted-foreground">Device / symbol</label>
      <select aria-label="Device / symbol" value={symbolId} onChange={(event) => onSymbol(event.target.value)} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm">
        {visible.map((item) => (
          <option key={item.id} value={item.id}>
            {item.abbr} — {item.label}{item.page ? ` (sh ${item.page})` : ""}
          </option>
        ))}
      </select>
      {!compact && <p className="text-[11px] text-muted-foreground">{visible.length} of {symbols.length} types</p>}
    </div>
  );
}
