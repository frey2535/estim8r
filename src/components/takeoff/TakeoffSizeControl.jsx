import React from "react";

const inputClass = "w-full rounded-lg border border-input bg-background px-2 py-1 text-sm";

export default function TakeoffSizeControl({
  markerSize,
  lineSize,
  onMarkerSize,
  onLineSize,
  compact = false,
}) {
  return (
    <div className={compact ? "flex flex-wrap items-end gap-2" : "space-y-2"}>
      {!compact && <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Size of new marks</div>}
      <div className={compact ? "flex items-end gap-2" : "grid grid-cols-2 gap-2"}>
        <label className="text-xs font-bold text-muted-foreground">
          Count mark size
          <span className="mt-0.5 block font-normal">How large the next counted symbol is drawn.</span>
          <input
            type="number"
            min="0.25"
            step="0.05"
            aria-label="Count mark size"
            value={markerSize}
            onChange={(event) => onMarkerSize(Number(event.target.value))}
            className={`mt-1 ${compact ? "w-20" : ""} ${inputClass}`}
          />
        </label>
        <label className="text-xs font-bold text-muted-foreground">
          New line thickness
          <span className="mt-0.5 block font-normal">How thick the next traced line is drawn.</span>
          <input
            type="number"
            min="0.25"
            step="0.05"
            aria-label="New line thickness"
            value={lineSize}
            onChange={(event) => onLineSize(Number(event.target.value))}
            className={`mt-1 ${compact ? "w-20" : ""} ${inputClass}`}
          />
        </label>
      </div>
    </div>
  );
}
