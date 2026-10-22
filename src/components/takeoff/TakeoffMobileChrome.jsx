import React from "react";
import { Link } from "react-router-dom";
import { Calculator, Hand, Layers3, ScanSearch, Wrench, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const commandBtn = "inline-flex min-h-[48px] items-center justify-center gap-1 rounded-xl px-2.5 text-[14px] font-semibold touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 *  * @param {Record<string, any>} options
 */
export function TakeoffMobileCommandBar({
  aiBusy,
  zoom,
  pagesOpen,
  estimatePath,
  onAiAssist,
  onTogglePages,
  onZoomOut,
  onZoomIn,
  onFit,
}) {
  return (
    <div className="shrink-0 border-b border-border bg-card px-2 py-2 lg:hidden" data-testid="takeoff-mobile-commands">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={aiBusy}
          onClick={onAiAssist}
          className={cn(commandBtn, "bg-foreground text-background disabled:opacity-60")}
        >
          <ScanSearch className="h-5 w-5 shrink-0" />
          <span>{aiBusy ? "AI working" : "AI assist"}</span>
        </button>
        <Link
          to={estimatePath}
          className={cn(commandBtn, "border border-border bg-background")}
        >
          <Calculator className="h-5 w-5 shrink-0" />
          Estimate
        </Link>
        <button
          type="button"
          aria-pressed={pagesOpen}
          onClick={onTogglePages}
          className={cn(
            commandBtn,
            "border border-border bg-background",
            pagesOpen && "border-foreground bg-foreground text-background",
          )}
        >
          Pages
        </button>
        <div className="flex items-center justify-between rounded-xl border border-border bg-background">
          <button type="button" onClick={onZoomOut} className="flex h-11 w-11 items-center justify-center" aria-label="Zoom out" title="Zoom out">
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onFit}
            className="min-w-16 px-1 text-center text-sm font-semibold tabular-nums"
            title="Fit sheet"
            aria-label={`Zoom ${Math.round(zoom * 100)} percent. Tap to fit sheet.`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={onZoomIn} className="flex h-11 w-11 items-center justify-center" aria-label="Zoom in" title="Zoom in">
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 *  * @param {Record<string, any>} options
 */
export function TakeoffMobileDock({
  tool,
  activeToolLabel,
  status,
  toolsOpen,
  devicesOpen,
  countsOpen,
  onPan,
  onToggleTools,
  onToggleDevices,
  onToggleCounts,
  moreMenu,
}) {
  return (
    <div className="shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden" data-testid="takeoff-mobile-dock">
      <div className="grid grid-cols-5 gap-1.5 px-2 py-2">
        <button
          type="button"
          onClick={onPan}
          aria-pressed={tool === "pan"}
          className={cn(
            commandBtn,
            "flex-col gap-0 border px-1 text-[13px]",
            tool === "pan" ? "border-foreground bg-foreground text-background" : "border-border bg-background",
          )}
        >
          <Hand className="h-5 w-5" />
          Pan
        </button>
        <button
          type="button"
          aria-pressed={toolsOpen}
          onClick={onToggleTools}
          className={cn(commandBtn, "flex-col gap-0 border px-1 text-[13px]", toolsOpen ? "border-foreground bg-foreground text-background" : "border-border bg-background")}
        >
          <Wrench className="h-5 w-5" />
          Tools
        </button>
        <button
          type="button"
          aria-pressed={devicesOpen}
          onClick={onToggleDevices}
          className={cn(commandBtn, "flex-col gap-0 border px-1 text-[13px]", devicesOpen ? "border-foreground bg-foreground text-background" : "border-border bg-background")}
        >
          Devices
        </button>
        <button
          type="button"
          aria-pressed={countsOpen}
          onClick={onToggleCounts}
          className={cn(commandBtn, "flex-col gap-0 border px-1 text-[13px]", countsOpen ? "border-foreground bg-foreground text-background" : "border-border bg-background")}
        >
          <Layers3 className="h-5 w-5" />
          Counts
        </button>
        <div className="min-w-0">{moreMenu}</div>
      </div>
      <div role="status" aria-live="polite" className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground line-clamp-2">
        <span className="font-medium text-foreground">{activeToolLabel}.</span> {status}
      </div>
    </div>
  );
}

/**
 *  * @param {Record<string, any>} options
 */
export function TakeoffMobileSheet({ open, onOpenChange, title, description, children }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-3 overflow-hidden rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          {description ? <SheetDescription className="text-sm text-muted-foreground">{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
