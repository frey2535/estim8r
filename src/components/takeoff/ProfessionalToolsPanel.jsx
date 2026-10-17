import React, { Suspense, lazy, useState } from "react";
import { DEFAULT_ASSEMBLIES } from "@/domain/estimate/assemblies";
import {
  TRADE_PRESETS,
  evaluateFormula,
  interleavePages,
  measureMark,
  visualSearchGeometry,
} from "@/domain/takeoff/professionalTools";

const AerialScaleMap = lazy(() => import("./AerialScaleMap"));

export default function ProfessionalToolsPanel({
  selected,
  marks = [],
  drawingObjects = [],
  page = 1,
  pageCount = 1,
  slips = [],
  calibration,
  aspect = 1,
  comparePage = "",
  sessionId = "",
  onStatus,
  onTool,
  onPlaceAssembly,
  onCrop,
  onCompare,
  onSnapshot,
  onRevision,
  onWorkbook,
  onSign,
  onLiveLink,
  onSession,
  onOcr,
  onReport,
  onAerialLength,
  onFormula,
}) {
  const [formula, setFormula] = useState("qty * (1 + waste / 100)");
  const [waste, setWaste] = useState("10");
  const measured = selected ? measureMark(selected, calibration, aspect) : null;
  const pages = interleavePages(pageCount, slips);

  const section = "rounded-md border border-border bg-background";
  const summary = "cursor-pointer px-2 py-1.5 text-xs font-semibold";
  const body = "space-y-2 border-t border-border px-2 py-2";
  const action = "w-full rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-muted";

  return (
    <div className="space-y-2" data-testid="professional-tools">
      <details className={section}>
        <summary className={summary}>Measure</summary>
        <div className={body}>
      <label className="block text-[11px] font-semibold text-muted-foreground">Trade measurement
        <select className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs" defaultValue="" onChange={(event) => {
          const preset = TRADE_PRESETS.find((item) => item.id === event.target.value);
          if (!preset) return;
          onTool?.(preset.tool);
          onStatus?.(`${preset.label} uses ${preset.unit}${preset.asksHeight ? ". Enter a height to calculate volume." : "."}`);
        }}>
          <option value="">Choose a trade tool</option>
          {TRADE_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      {measured ? (
        <div className="rounded-md border border-border px-2 py-1.5 text-[11px] leading-5">
          <div>Length {measured.lengthLf == null ? "—" : `${measured.lengthLf.toFixed(2)} LF`}</div>
          <div>Perimeter {measured.perimeterLf == null ? "—" : `${measured.perimeterLf.toFixed(2)} LF`}</div>
          <div>Area {measured.areaSf == null ? "—" : `${measured.areaSf.toFixed(2)} SF`}</div>
          <div>Volume {measured.volumeCf == null ? "—" : `${measured.volumeCf.toFixed(2)} CF`}</div>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-1">
        <button type="button" className={action} onClick={() => {
          const seed = drawingObjects.find((item) => item.objectId === selected?.sourceObjectId || item.id === selected?.id) || selected;
          const found = visualSearchGeometry(drawingObjects, seed);
          onStatus?.(found.total ? `Matching geometry: ${found.total} on ${found.sheets.map((row) => `sheet ${row.sheet} (${row.count})`).join(", ")}.` : "No similar geometry was found.");
        }}>Find similar geometry</button>
        <button type="button" className={action} onClick={onCrop}>Crop to selection</button>
      </div>
      <label className="block text-[11px] font-semibold text-muted-foreground">Formula
        <input aria-label="Takeoff formula" value={formula} onChange={(event) => setFormula(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs" />
      </label>
      <label className="block text-[11px] font-semibold text-muted-foreground">Waste %
        <input aria-label="Waste percent" value={waste} onChange={(event) => setWaste(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs" />
      </label>
      <button type="button" className={action} onClick={() => {
        const qty = selected?.type === "count" ? 1 : (measured?.lengthLf || measured?.areaSf || 0);
        const result = evaluateFormula(formula, { qty, waste: Number(waste) || 0, count: marks.length });
        if (!result.ok) {
          onStatus?.(result.error);
          return;
        }
        onFormula?.(result.value, Number(waste) || 0);
        onStatus?.(`Formula result ${result.value.toFixed(2)} with ${waste}% waste variable.`);
      }}>Apply formula</button>
        </div>
      </details>
      <details className={section}>
        <summary className={summary}>Revisions and files</summary>
        <div className={body}>
          <button type="button" className={action} onClick={onSnapshot}>Save revision snapshot</button>
          <button type="button" className={action} onClick={onRevision}>Compare with snapshot</button>
          <button type="button" className={action} onClick={onWorkbook}>Excel workbook</button>
          <button type="button" className={action} onClick={onLiveLink}>Publish live quantities</button>
          <button type="button" className={action} onClick={onSign}>Sign quantity file</button>
          <button type="button" className={action} onClick={onOcr}>Read scanned text</button>
          <button type="button" className={action} onClick={onReport}>Bill of materials PDF</button>
        </div>
      </details>
      <details className={section}>
        <summary className={summary}>Sheets and session</summary>
        <div className={body}>
      <label className="block text-[11px] font-semibold text-muted-foreground">Side-by-side sheet
        <select aria-label="Compare sheet" className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={comparePage} onChange={(event) => onCompare?.(event.target.value)}>
          <option value="">Off</option>
          {Array.from({ length: pageCount }, (_, index) => index + 1).filter((item) => item !== page).map((item) => <option key={item} value={item}>Sheet {item}</option>)}
        </select>
      </label>
      <label className="block text-[11px] font-semibold text-muted-foreground">Shared session
        <span className="mt-1 flex gap-1">
          <input aria-label="Shared session id" value={sessionId} onChange={(event) => onSession?.(event.target.value.trim())} className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs" placeholder="Session id" />
        </span>
      </label>
      <label className="block text-[11px] font-semibold text-muted-foreground">Place assembly
        <select aria-label="Place assembly" className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs" defaultValue="" onChange={(event) => {
          const assembly = DEFAULT_ASSEMBLIES.find((item) => item.id === event.target.value);
          if (assembly) onPlaceAssembly?.(assembly);
        }}>
          <option value="">Click the sheet after choosing</option>
          {DEFAULT_ASSEMBLIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <div className="text-[11px] text-muted-foreground">Pages {pages.map((item) => item.label).join(" · ")}</div>
      <Suspense fallback={<p className="text-[11px] text-muted-foreground">Loading aerial map…</p>}>
        <AerialScaleMap onLength={onAerialLength} />
      </Suspense>
        </div>
      </details>
    </div>
  );
}
