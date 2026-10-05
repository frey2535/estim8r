import React from "react";

export default function LogoStretchControls({
  stretchX,
  stretchY,
  onChange,
  xLabel = "Horizontal stretch",
  yLabel = "Vertical stretch",
}) {
  return (
    <div className="grid gap-2">
      <label className="block">
        <span className="mb-1 block text-xs font-bold">
          {xLabel} · {stretchX}%
        </span>
        <input
          type="range"
          min={20}
          max={400}
          step={5}
          value={stretchX}
          aria-label={xLabel}
          onChange={(e) => onChange("logoStretchX", Number(e.target.value))}
          className="w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold">
          {yLabel} · {stretchY}%
        </span>
        <input
          type="range"
          min={20}
          max={400}
          step={5}
          value={stretchY}
          aria-label={yLabel}
          onChange={(e) => onChange("logoStretchY", Number(e.target.value))}
          className="w-full"
        />
      </label>
      <p className="text-[11px] text-muted-foreground">
        Width and height stretch separately. They do not lock to the image aspect ratio.
      </p>
    </div>
  );
}
