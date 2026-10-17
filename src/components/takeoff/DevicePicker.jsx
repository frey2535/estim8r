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
  availableSymbols = [],
  onManualMark,
}) {
  const detected = symbolsOnDrawingForTrade(trade, marks, { pageKinds });
  const merged = new Map();
  for (const item of [...availableSymbols, ...detected]) {
    if (!item?.id || (item.trade && item.trade !== trade)) continue;
    merged.set(item.id, item);
  }
  const poolAll = [...merged.values()];
  const cats = [...new Set(poolAll.map((item) => item.takeoffCategory || item.category).filter(Boolean))];
  const activeCategory = cats.includes(category) ? category : "";
  const pool = poolAll.filter((item) => {
    if (item.trade && item.trade !== trade) return false;
    if (!activeCategory) return true;
    return (item.takeoffCategory || item.category) === activeCategory;
  });
  const visible = filterSymbols(pool, query).filter((item) => item.trade === trade);
  const tradeLabel = trades.find((item) => item.id === trade)?.label || trade;
  const labelClass = compact ? "block text-base font-bold text-foreground" : "block text-xs font-bold text-muted-foreground";
  const controlClass = compact
    ? "mt-1 w-full min-h-[44px] rounded-lg border border-input bg-background px-3 py-2 text-base font-semibold text-foreground"
    : "mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm font-semibold text-foreground";
  return (
    <div className="space-y-3">
      <label className={labelClass}>
        Trade
        <select
          aria-label="Trade"
          value={trade}
          onChange={(event) => onTrade(event.target.value)}
          className={controlClass}
        >
          {trades.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>Search devices</label>
      <input
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search devices on this drawing…"
        className={controlClass}
      />
      {cats.length > 0 && (
        <label className={labelClass}>Category</label>
      )}
      {cats.length > 0 && (
        <select aria-label="Category" value={activeCategory} onChange={(event) => onCategory(event.target.value)} className={controlClass}>
          <option value="">All on drawing</option>
          {cats.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      )}
      <label className={labelClass}>Device / symbol</label>
      <select aria-label="Device / symbol" data-trade={trade} value={visible.some((item) => item.id === symbolId) ? symbolId : (visible[0]?.id || "")} onChange={(event) => onSymbol(event.target.value)} className={controlClass}>
        {visible.length === 0 ? <option value="">No devices on this drawing</option> : null}
        {visible.map((item) => (
          <option key={item.id} value={item.id} data-trade={item.trade}>
            {item.abbr} — {item.label}
          </option>
        ))}
      </select>
      <p className={compact ? "text-sm text-muted-foreground" : "text-[11px] text-muted-foreground"}>{visible.length} {tradeLabel} symbol{visible.length === 1 ? "" : "s"}</p>
      {onManualMark ? (
        <button
          type="button"
          onClick={onManualMark}
          disabled={!symbolId && !visible[0]?.id}
          className={compact
            ? "w-full min-h-[44px] rounded-lg border border-foreground bg-foreground px-3 py-2 text-base font-semibold text-background hover:opacity-90 disabled:opacity-40"
            : "w-full rounded-md border border-border px-2 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40"}
        >
          Mark missed symbol manually
        </button>
      ) : null}
    </div>
  );
}
