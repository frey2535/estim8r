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

const commandBtn = "inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl px-2.5 text-[15px] font-bold";

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
      <div className="grid grid-cols-[minmax(0,1.15fr)_auto_auto_minmax(0,1fr)] items-center gap-1.5">
        <button
          type="button"
          disabled={aiBusy}
          onClick={onAiAssist}
          className={cn(commandBtn, "bg-blue-600 text-white dark:bg-orange-500 disabled:opacity-60")}
        >
          <ScanSearch className="h-5 w-5 shrink-0" />
          <span className="truncate">{aiBusy ? "AI working" : "AI assist"}</span>
        </button>
        <button
          type="button"
          aria-pressed={pagesOpen}
          onClick={onTogglePages}
          className={cn(
            commandBtn,
            "min-w-[72px] border border-border bg-background",
            pagesOpen && "border-blue-600 bg-blue-50 text-blue-800 dark:border-orange-500 dark:bg-orange-500/10 dark:text-orange-200",
          )}
        >
          Pages
        </button>
        <div className="flex items-center rounded-xl border border-border bg-background">
          <button type="button" onClick={onZoomOut} className="flex h-11 w-11 items-center justify-center" aria-label="Zoom out" title="Zoom out">
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onFit}
            className="min-w-14 px-1 text-center text-[15px] font-black tabular-nums"
            title="Fit sheet"
            aria-label={`Zoom ${Math.round(zoom * 100)} percent. Tap to fit sheet.`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={onZoomIn} className="flex h-11 w-11 items-center justify-center" aria-label="Zoom in" title="Zoom in">
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
        <Link
          to={estimatePath}
          className={cn(commandBtn, "border border-blue-600 bg-blue-50 text-blue-800 dark:border-orange-500 dark:bg-orange-500/10 dark:text-orange-200")}
        >
          <Calculator className="h-5 w-5 shrink-0" />
          <span className="truncate">Estimate</span>
        </Link>
      </div>
    </div>
  );
}

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
    <div className="shrink-0 border-t border-border bg-card lg:hidden" data-testid="takeoff-mobile-dock">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        <button
          type="button"
          onClick={onPan}
          aria-pressed={tool === "pan"}
          className={cn(
            commandBtn,
            "flex-col gap-0 border px-1 text-[13px]",
            tool === "pan" ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-orange-500 dark:bg-orange-500/10 dark:text-orange-200" : "border-border bg-background",
          )}
        >
          <Hand className="h-5 w-5" />
          Pan
        </button>
        <button
          type="button"
          aria-pressed={toolsOpen}
          onClick={onToggleTools}
          className={cn(commandBtn, "flex-col gap-0 border px-1 text-[13px]", toolsOpen ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-orange-500 dark:bg-orange-500/10" : "border-border bg-background")}
        >
          <Wrench className="h-5 w-5" />
          Tools
        </button>
        <button
          type="button"
          aria-pressed={devicesOpen}
          onClick={onToggleDevices}
          className={cn(commandBtn, "flex-col gap-0 border px-1 text-[13px]", devicesOpen ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-orange-500 dark:bg-orange-500/10" : "border-border bg-background")}
        >
          Devices
        </button>
        <button
          type="button"
          aria-pressed={countsOpen}
          onClick={onToggleCounts}
          className={cn(commandBtn, "flex-col gap-0 border px-1 text-[13px]", countsOpen ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-orange-500 dark:bg-orange-500/10" : "border-border bg-background")}
        >
          <Layers3 className="h-5 w-5" />
          Counts
        </button>
        <div className="min-w-0">{moreMenu}</div>
      </div>
      <div className="border-t border-border px-3 py-2 text-base text-foreground">
        <span className="font-bold">{activeToolLabel}.</span>{" "}
        <span>{status}</span>
      </div>
    </div>
  );
}

export function TakeoffMobileSheet({ open, onOpenChange, title, description, children }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[72dvh] flex-col gap-3 overflow-hidden p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl font-black">{title}</SheetTitle>
          {description ? <SheetDescription className="text-base text-foreground/80">{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto pr-1">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
