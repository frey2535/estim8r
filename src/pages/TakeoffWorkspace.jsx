import React from "react";
import { Cable, CheckCircle2, FileSearch, Layers3, MousePointer2, Pencil, Ruler, Route, ScanSearch, Shapes, Sigma, SplitSquareVertical } from "lucide-react";

const manualTools = [
  ["Select / edit", "Select, move, resize, relabel and delete any manual or accepted AI markup", MousePointer2],
  ["Count", "Click-to-count devices, equipment, fittings, boxes and custom symbols", Shapes],
  ["Linear", "Straight or segmented linear measurement for conduit, cable, trench and raceway", Ruler],
  ["Area", "Rectangle/polygon area takeoff for slabs, rooms, grounding grids and custom scopes", Ruler],
  ["Conduit route", "Draw branch circuit, feeder, home-run and rack paths manually", Route],
  ["Circuit trace", "Connect panel/circuit sources to devices and assign circuit identity", Cable],
  ["Markup", "Text, notes, dimensions, symbols, highlights and custom annotations", Pencil],
  ["Scale calibration", "Printed scale, two-point calibration or known-dimension calibration", Ruler],
];

const capabilities = [
  ["Drawing ingestion", "PDF drawing sets, sheet indexing, scale and revision metadata", FileSearch],
  ["Notes + context", "Sheet notes, equipment tags, circuit and panel context", ScanSearch],
  ["Symbol intelligence", "Detection records with confidence and human review status", Shapes],
  ["Circuit tracing", "Panel/circuit/device relationships and device sequence", Cable],
  ["Conduit routing", "Proposed branch, home-run, feeder and rack geometry", Route],
  ["Circuit grouping", "Multiple circuits can share a route/home-run group", Layers3],
  ["NEC pull points", "Junction box, pull box and condulet insertion records", SplitSquareVertical],
  ["Quantity rollup", "Per-sheet, per-category, per-circuit and project quantities", Sigma],
];

export default function TakeoffWorkspace() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-orange-500">Elite Takeoff Engine</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Drawing Intelligence & Takeoff</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Foundation for drawing analysis, electrical symbol recognition, circuit tracing, conduit routing, circuit grouping, NEC-aware pull points and separated marked-sheet takeoffs.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-orange-500" />
            Architecture ready
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-foreground">Takeoff mode</h3>
            <p className="text-sm text-muted-foreground">AI-assisted, fully manual, or hybrid. Manual edits remain first-class takeoff records.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["AI Assisted", "Manual", "Hybrid"].map((mode) => <span key={mode} className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold">{mode}</span>)}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Manual takeoff toolbox</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {manualTools.map(([title, description, Icon]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-orange-500/10 dark:text-orange-500"><Icon className="h-5 w-5" /></div>
              <h4 className="text-sm font-bold">{title}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Automated intelligence</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {capabilities.map(([title, description, Icon]) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-orange-500/10 dark:text-orange-500">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
        ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold text-foreground">Marked-sheet output model</h3>
        <p className="mt-1 text-sm text-muted-foreground">Takeoff detections are stored independently by category so exports can generate as many marked sheets as necessary for each trade/device class.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Receptacles", "Lighting", "HVAC", "Panels / MCC", "Equipment", "Raceway", "Low Voltage", "Access Control"].map((item) => (
            <span key={item} className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">{item}</span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">
        The data model is now separated from the recognition/routing workers. The next implementation layer connects drawing upload/rendering, AI/CV analysis, editable overlays, route planning and marked PDF exports without weakening tenant isolation.
      </div>
    </div>
  );
}
