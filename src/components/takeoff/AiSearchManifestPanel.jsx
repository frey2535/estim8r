import React from "react";
import { cn } from "@/lib/utils";
import { tradeById } from "@/domain/takeoff/trades";

export default function AiSearchManifestPanel({ manifest, trade }) {
  if (!manifest?.sheets?.length) return null;
  return (
    <div className="shrink-0 border-t border-border bg-card px-3 py-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">AI search targets</div>
          <div className="text-xs text-muted-foreground">
            Legend-driven search list for {tradeById(trade).label}. Each applicable symbol is tracked on each plan.
          </div>
        </div>
        <div className="text-[11px] font-semibold text-muted-foreground">
          {manifest.foundTypes} found · {manifest.notFoundTypes} not found · {manifest.reviewTypes} review · {manifest.textOnlyTypes} text-only
        </div>
      </div>
      <div className="max-h-52 space-y-2 overflow-auto">
        {manifest.sheets.map((sheet) => (
          <div key={sheet.page} className="rounded-lg border border-border bg-background p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-xs font-bold">
                {sheet.sheetId || ("Sheet " + sheet.page)} · {sheet.planType}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {sheet.symbols.length} target{sheet.symbols.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {sheet.symbols.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 rounded border border-border/70 px-2 py-1 text-[11px]">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{row.code ? row.code + " · " : ""}{row.label}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{row.category}</div>
                  </div>
                  <div className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                    row.status === "found" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                    row.status === "review" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" :
                    row.status === "text-only" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {row.status === "found" ? "Found " + row.foundCount :
                     row.status === "review" ? "Review " + row.foundCount :
                     row.status === "text-only" ? "No geometry" : "0 found"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
