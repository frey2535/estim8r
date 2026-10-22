import React from "react";
import {
  Cable, Cloud, Crosshair, Gauge, Hand, Lightbulb, MousePointer2,
  Pencil, Redo2, Route, Ruler, Spline, Square, StickyNote, Undo2, ZoomIn, ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TAKEOFF_TOOLS, TOOL_GROUPS } from "@/domain/takeoff/catalog";

const TOOL_ICONS = {
  select: MousePointer2,
  pan: Hand,
  scale: Gauge,
  measure: Crosshair,
  count: Lightbulb,
  drop: Lightbulb,
  linear: Ruler,
  polyline: Spline,
  area: Square,
  conduit: Route,
  circuit: Cable,
  homerun: Cable,
  markup: StickyNote,
  cloud: Cloud,
};

const iconButton = "inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-40";

/**
 *  * @param {Record<string, any>} options
 */
export function TakeoffToolRail({ tool, onTool }) {
  return (
    <nav aria-label="Takeoff tools" className="hidden min-h-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card px-1 py-2 lg:flex">
      {TOOL_GROUPS.map((group) => (
        <div key={group.key} className="space-y-0.5 border-b border-border/70 pb-1 last:border-b-0">
          {TAKEOFF_TOOLS.filter((item) => item.group === group.key).map((item) => {
            const Icon = TOOL_ICONS[item.key] || Pencil;
            const active = tool === item.key;
            return (
              <button
                key={item.key}
                type="button"
                title={item.help}
                aria-label={item.label}
                aria-pressed={active}
                onClick={() => onTool(item.key)}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-md px-0.5 py-1 text-center text-[10px] font-medium leading-tight",
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 *  * @param {Record<string, any>} options
 */
export function TakeoffCommandBar({
  fileName,
  detail,
  page,
  pageCount,
  zoom,
  aiBusy,
  isPdf,
  pageTakeoffEnabled,
  pendingReview = 0,
  onPrev,
  onNext,
  onZoomOut,
  onZoomIn,
  onFit,
  onUndo,
  onRedo,
  onAi,
  onPageTakeoff,
  onReview,
  actions,
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{fileName}</div>
        <div className="truncate text-[11px] text-muted-foreground">{detail}</div>
      </div>
      <div className="hidden items-center gap-0.5 lg:flex">
        <button type="button" className={iconButton} onClick={onUndo} title="Undo" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
        <button type="button" className={iconButton} onClick={onRedo} title="Redo" aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" className={iconButton} onClick={onZoomOut} title="Zoom out" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
        <button type="button" onClick={onFit} className="h-8 min-w-12 rounded-md px-1 text-xs font-semibold tabular-nums hover:bg-muted" title="Fit sheet">{Math.round(zoom * 100)}%</button>
        <button type="button" className={iconButton} onClick={onZoomIn} title="Zoom in" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
      </div>
      {pageCount > 1 && (
        <div className="hidden items-center gap-1 lg:flex">
          <button type="button" disabled={page <= 1} onClick={onPrev} className="h-8 rounded-md px-2 text-xs font-semibold hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="text-xs font-medium text-muted-foreground">Sheet {page} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={onNext} className="h-8 rounded-md px-2 text-xs font-semibold hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      )}
      <button
        type="button"
        disabled={aiBusy || !isPdf}
        onClick={onAi}
        className="hidden h-8 items-center rounded-md bg-foreground px-3 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-40 lg:inline-flex"
        title="Run automatic takeoff only on the current drawing page, preserving marks on other sheets"
      >
        {aiBusy ? "Reading sheet…" : "AI: this sheet"}
      </button>
      <label className="hidden h-8 items-center gap-2 rounded-md px-2 text-xs font-medium lg:inline-flex" title="Full takeoff includes this page. AI: this sheet still runs the page you are viewing.">
        <input
          type="checkbox"
          data-testid="page-takeoff-toggle"
          checked={pageTakeoffEnabled}
          onChange={(event) => onPageTakeoff(event.target.checked)}
        />
        Takeoff on this page
      </label>
      <button type="button" onClick={onReview} className="hidden h-8 items-center rounded-md border border-border px-2.5 text-xs font-semibold hover:bg-muted lg:inline-flex">
        Review{pendingReview ? ` ${pendingReview}` : ""}
      </button>
      <div className="hidden lg:block">{actions}</div>
    </div>
  );
}

/**
 *  * @param {Record<string, any>} options
 */
export function TakeoffSelectionBar({
  selected,
  isDevice,
  onColor,
  onShrink,
  onEnlarge,
  onCountPages,
  onDelete,
}) {
  if (!selected) return null;
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-30">
      <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card/95 px-1.5 py-1 shadow-sm" aria-label="Direct object editing controls">
        {isDevice ? (
          <>
            <label className="flex items-center gap-1 px-1 text-[11px] font-medium text-muted-foreground">
              Color
              <input
                type="color"
                aria-label="Selected device highlight color"
                value={/^#[0-9a-f]{6}$/i.test(selected.color || "") ? selected.color : "#334155"}
                onChange={(event) => onColor(event.target.value)}
                className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
            <button type="button" className="h-7 rounded-md px-2 text-xs font-medium hover:bg-muted" onClick={onShrink} aria-label="Shrink selected device highlight">Smaller</button>
            <button type="button" className="h-7 rounded-md px-2 text-xs font-medium hover:bg-muted" onClick={onEnlarge} aria-label="Enlarge selected device highlight">Larger</button>
            <button type="button" className="h-7 rounded-md px-2 text-xs font-medium hover:bg-muted" onClick={onCountPages}>Count on all pages</button>
          </>
        ) : null}
        <button type="button" onClick={onDelete} className="h-7 rounded-md px-2 text-xs font-semibold text-destructive hover:bg-destructive/10" aria-label="Delete selected takeoff object">Delete</button>
      </div>
    </div>
  );
}
