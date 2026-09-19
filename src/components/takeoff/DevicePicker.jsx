import React from "react";
import { filterSymbols } from "@/domain/takeoff/catalog";

export default function DevicePicker({
  categories,
  category,
  onCategory,
  symbols,
  symbolId,
  onSymbol,
  query,
  onQuery,
}) {
  const visible = filterSymbols(symbols, query);
  return (
    <div className="space-y-2">
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
      <label className="mb-1 block text-xs font-bold text-muted-foreground">Device / symbol</label>
      <select value={symbolId} onChange={(event) => onSymbol(event.target.value)} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm">
        {visible.map((item) => (
          <option key={item.id} value={item.id}>
            {item.abbr} — {item.label}{item.page ? ` (sh ${item.page})` : ""}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground">{visible.length} of {symbols.length} types</p>
    </div>
  );
}
