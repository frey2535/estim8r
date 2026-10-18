import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TakeoffActionsMenu({
  aiBusy,
  onAiAssist,
  onSave,
  onTrueTakeoff,
  onTakeoffCsv,
  onEstimatePath,
  onMarkupPath,
  onCountedDrawings,
  onConduitRoutes,
  onConduitSchedulePdf,
  onConduitScheduleCsv,
  onWireMakeupPdf,
  onWireMakeupCsv,
  onQuoteExcel,
  onQuotePdf,
  onReplaceId,
  onClose,
  onClear,
  label = "More",
  className = "",
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn("inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-muted", className)}
          aria-label="More takeoff actions"
        >
          {aiBusy ? "AI…" : label}
          <ChevronDown className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={8} collisionPadding={12} className="max-h-[min(70dvh,32rem)] w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain">
        <DropdownMenuLabel>Takeoff</DropdownMenuLabel>
        <DropdownMenuItem disabled={aiBusy} onSelect={() => { if (!aiBusy) onAiAssist(); }}>
          {aiBusy ? "AI assist is running…" : "AI assist"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSave}>Save</DropdownMenuItem>
        <DropdownMenuItem onSelect={onTrueTakeoff}>True Takeoff</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={onEstimatePath}>Estimate</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={onMarkupPath}>Markup pages</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Exports</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onTakeoffCsv}>Takeoff CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={onCountedDrawings}>Counted drawings PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={onConduitRoutes}>Conduit routes PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={onConduitSchedulePdf}>Conduit schedule PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={onConduitScheduleCsv}>Conduit schedule CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={onWireMakeupPdf}>Wire makeup PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={onWireMakeupCsv}>Wire makeup CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={onQuoteExcel}>Supply quote Excel</DropdownMenuItem>
        <DropdownMenuItem onSelect={onQuotePdf}>Supply quote PDF</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Drawing</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <label htmlFor={onReplaceId} className="cursor-pointer">Replace drawing</label>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onClose}>Close</DropdownMenuItem>
        {onClear ? <DropdownMenuItem onSelect={onClear}>Clear takeoff</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function takeoffEstimatePath(file) {
  return file ? `/estimates/new?file=${encodeURIComponent(file.name)}&size=${file.size}` : "/estimates/new";
}

export function takeoffMarkupPath(file) {
  return file ? `/markup?file=${encodeURIComponent(file.name)}&size=${file.size}` : "/markup";
}
