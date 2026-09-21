import React from "react";
import { filterSymbols } from "@/domain/takeoff/catalog";
import { symbolsOnDrawingForTrade } from "@/domain/takeoff/trades";

export default function DevicePicker({
  trades = [],
  trade,
  onTrade,
  marks = [],
  pageKinds = {},
  category,
  onCategory,
  symbolId,
  onSymbol,
  query,
  onQuery,
  compact = false,
}) {
  const poolAll = symbolsOnDrawingForTrade(trade, marks, { pageKinds });
  const cats = [...new Set(poolAll.map((item) => item.category).filter(Boolean))];
  const activeCategory = cats.includes(category) ? category : "";
  const pool = symbolsOnDrawingForTrade(trade, marks, {
    pageKinds,
    category: activeCategory || undefined,
  }).filter((item) => item.trade === trade);
  const visible = filterSymbols(pool, compact ? "" : query).filter((item) => item.trade === trade);
  const tradeLabel = trades.find((item) => item.id === trade)?.label || trade;
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
            placeholder="Search devices on this drawing…"
            className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
          />
        </>
      )}
      {cats.length > 0 && (
        <label className="mb-1 block text-xs font-bold text-muted-foreground">Category</label>
      )}
      {cats.length > 0 && (
        <select aria-label="Category" value={activeCategory} onChange={(event) => onCategory(event.target.value)} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm">
          <option value="">All on drawing</option>
          {cats.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      )}
      <label className="mb-1 block text-xs font-bold text-muted-foreground">Device / symbol</label>
      <select aria-label="Device / symbol" data-trade={trade} value={visible.some((item) => item.id === symbolId) ? symbolId : (visible[0]?.id || "")} onChange={(event) => onSymbol(event.target.value)} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm">
        {visible.length === 0 ? <option value="">No devices on this drawing</option> : null}
        {visible.map((item) => (
          <option key={item.id} value={item.id} data-trade={item.trade}>
            {item.abbr} — {item.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground">{visible.length} {tradeLabel} type{visible.length === 1 ? "" : "s"} on this drawing</p>
    </div>
  );
}
