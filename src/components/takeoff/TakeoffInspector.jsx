import React from "react";
import { Layers3 } from "lucide-react";
import { formatArea, formatFeet } from "@/domain/takeoff/geometry";
import { symbolPatchFromCatalog } from "@/domain/takeoff/trades";
import {
  DEFAULT_LINE_SIZE,
  DEFAULT_MARKER_SIZE,
  isLineMark,
  isMarkerMark,
  lineSizePatch,
  markerSizePatch,
  resolvedLineSize,
  resolvedMarkerSize,
} from "@/domain/takeoff/sizes";
import TradeSymbolSelect from "@/components/takeoff/TradeSymbolSelect";
import { describeReconciliation } from "@/domain/takeoff/countReconciliation";

function Field({ label, children }) {
  return (
    <label className="block text-[11px]">
      <span className="mb-0.5 block font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-md border border-input bg-background px-1.5 py-1 text-xs";

export default function TakeoffInspector({
  rollup,
  runs,
  drawingDocs,
  trade,
  marks = [],
  pageKinds = {},
  selected,
  conduitOptions,
  onSelectRun,
  onUpdateMark,
  onEditRow,
  onRenameRow,
  onSelectSheet,
  onCopy,
  onDownloadQuoteExcel,
  onDownloadQuotePdf,
  scheduleEdits,
  totals,
  globalMarkerSize = DEFAULT_MARKER_SIZE,
  globalLineSize = DEFAULT_LINE_SIZE,
  trueAnalysis,
  trueTakeoffResult,
  onBuildTrueTakeoff,
  reconciliation,
  reviewSummary,
  isolationMode = false,
  onIsolationMode,
}) {
  const selectedIsLine = isLineMark(selected);
  const selectedIsMarker = isMarkerMark(selected);
  const selectedIsConduit = selected?.tool === "conduit" || selected?.type === "route" || selected?.category === "Raceway";
  const selectedIsNote = selected?.type === "note";
  return (
    <aside className="hidden min-h-0 overflow-auto border-l border-border bg-card p-3 lg:block">
      {selected && (
        <div className="mb-3 space-y-2 rounded-lg border border-border p-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selected item</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onIsolationMode?.(!isolationMode)} className={isolationMode ? "rounded-md bg-orange-600 px-2 py-1 text-[11px] font-bold text-white" : "rounded-md border border-border px-2 py-1 text-[11px] font-bold hover:bg-muted"}>
              {isolationMode ? "Exit isolation" : "Isolate selected"}
            </button>
            <span className="text-[10px] text-muted-foreground">{isolationMode ? "Only this item is shown for focused editing." : "Selected item is brought forward and editable below."}</span>
          </div>
          {selectedIsConduit || selectedIsNote ? (
            <Field label="Name">
              <input className={inputClass} value={selected.symbolLabel || ""} onChange={(e) => onUpdateMark(selected.id, { symbolLabel: e.target.value })} />
            </Field>
          ) : (
            <Field label="Device / symbol">
              <TradeSymbolSelect
                trade={trade}
                marks={marks}
                pageKinds={pageKinds}
                value={selected.symbol || selected.symbolLabel}
                className={inputClass}
                onChange={(item) => onUpdateMark(selected.id, symbolPatchFromCatalog(item))}
              />
            </Field>
          )}
          <Field label="Category">
            <input className={inputClass} value={selected.category || ""} readOnly />
          </Field>
          <Field label="Marker text">
            <input className={inputClass} value={selected.abbr || ""} onChange={(e) => onUpdateMark(selected.id, { abbr: e.target.value })} />
          </Field>
          {selectedIsMarker ? (
            <>
              <Field label="Circuit">
                <input
                  className={inputClass}
                  value={selected.circuit || selected.circuitNumber || ""}
                  placeholder="Example: LN1-12"
                  onChange={(e) => onUpdateMark(selected.id, { circuit: e.target.value, circuitNumber: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Breaker amps">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={inputClass}
                    value={selected.breakerAmps || selected.circuitAmps || ""}
                    placeholder="20"
                    onChange={(e) => onUpdateMark(selected.id, { breakerAmps: Number(e.target.value) || "" })}
                  />
                </Field>
                <Field label="Poles">
                  <select
                    className={inputClass}
                    value={selected.circuitPoles || selected.poles || 1}
                    onChange={(e) => onUpdateMark(selected.id, { circuitPoles: Number(e.target.value) || 1 })}
                  >
                    <option value={1}>1-pole</option>
                    <option value={2}>2-pole</option>
                    <option value={3}>3-pole</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Wire size">
                  <input
                    className={inputClass}
                    value={selected.circuitWireSize || selected.wireSize || ""}
                    placeholder="#12"
                    onChange={(e) => onUpdateMark(selected.id, { circuitWireSize: e.target.value })}
                  />
                </Field>
                <Field label="Ground size">
                  <input
                    className={inputClass}
                    value={selected.circuitGroundSize || selected.groundSize || ""}
                    placeholder="#12"
                    onChange={(e) => onUpdateMark(selected.id, { circuitGroundSize: e.target.value })}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-[11px] font-semibold">
                <input
                  type="checkbox"
                  checked={selected.neutralRequired ?? selected.circuitNeutralRequired ?? true}
                  onChange={(e) => onUpdateMark(selected.id, { neutralRequired: e.target.checked, circuitNeutralRequired: e.target.checked })}
                />
                Neutral required
              </label>
              <Field label="Assigned conduit">
                <select
                  className={inputClass}
                  value={selected.circuitRunId || ""}
                  onChange={(e) => onUpdateMark(selected.id, { circuitRunId: e.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {runs
                    .filter((run) => run.sheet === (selected.sheet || 1))
                    .map((run) => <option key={run.id} value={run.id}>Conduit {run.runNumber} · {run.type}</option>)}
                </select>
              </Field>
            </>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Color">
              <input type="color" className="h-8 w-full" value={selected.color || "#2563eb"} onChange={(e) => onUpdateMark(selected.id, { color: e.target.value })} />
            </Field>
            {selectedIsLine && (
              <Field label="Line size">
                <input
                  type="number"
                  min="0.5"
                  step="0.1"
                  className={inputClass}
                  aria-label="This line size"
                  value={resolvedLineSize(selected, globalLineSize)}
                  onChange={(e) => onUpdateMark(selected.id, lineSizePatch(e.target.value))}
                />
              </Field>
            )}
            {selectedIsMarker && (
              <Field label="Marker size">
                <input
                  type="number"
                  min="0.5"
                  step="0.1"
                  className={inputClass}
                  aria-label="This marker size"
                  value={resolvedMarkerSize(selected, globalMarkerSize)}
                  onChange={(e) => onUpdateMark(selected.id, markerSizePatch(e.target.value))}
                />
              </Field>
            )}
          </div>
          {selectedIsConduit && trueAnalysis?.conduitWireMakeup ? (() => {
            const makeup = trueAnalysis.conduitWireMakeup.find((row) => row.conduitId === selected.id);
            if (!makeup) return null;
            return (
              <div className="rounded-lg border border-border bg-muted/30 p-2 text-[11px]">
                <div className="font-bold">Wire makeup · C{makeup.runNumber || "?"}</div>
                <div className="mt-1">{makeup.lengthLf.toFixed(1)} LF conduit · {makeup.totalConductorFeet.toFixed(1)} conductor LF</div>
                <div className="mt-1 space-y-0.5">
                  {makeup.wireTotals.map((wire) => <div key={wire.size}>{wire.size}: {wire.feet.toFixed(1)} LF</div>)}
                </div>
                {makeup.warnings.map((warning) => <div key={warning} className="mt-1 text-amber-700 dark:text-amber-300">• {warning}</div>)}
              </div>
            );
          })() : null}
          {(selected.tool === "conduit" || selected.type === "route") && (
            <Field label="Conduit type / size">
              <select
                className={inputClass}
                value={conduitOptions.find((item) => item.label === selected.symbolLabel)?.id || ""}
                onChange={(e) => {
                  const option = conduitOptions.find((item) => item.id === e.target.value);
                  if (!option) return;
                  onUpdateMark(selected.id, {
                    symbol: option.id,
                    symbolLabel: option.label,
                    abbr: option.size,
                    conduitSize: option.size,
                    conduitMaterial: option.material,
                    category: "Raceway",
                  });
                }}
              >
                {!conduitOptions.some((item) => item.label === selected.symbolLabel) && <option value="">{selected.symbolLabel || "Custom"}</option>}
                {conduitOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </Field>
          )}
          {selected.type === "note" && (
            <Field label="Note">
              <input className={inputClass} value={selected.text || ""} onChange={(e) => onUpdateMark(selected.id, { text: e.target.value })} />
            </Field>
          )}
        </div>
      )}

      {reviewSummary ? (
        <div className="mb-3 rounded-lg border border-border p-2 text-[11px] leading-4">
          <div className="font-bold text-foreground">Accuracy review</div>
          <p className="mt-1 text-muted-foreground">
            {reviewSummary.pending
              ? `${reviewSummary.pending} item${reviewSummary.pending === 1 ? "" : "s"} still need a look (${reviewSummary.typesPending} type${reviewSummary.typesPending === 1 ? "" : "s"}, ${reviewSummary.uncertainPending} uncertain).`
              : "Every detection on this sheet has been accepted or rejected."}
          </p>
          <p className="mt-1 text-muted-foreground">{reviewSummary.vector} extracted outlines · {reviewSummary.text} text tags · {reviewSummary.accepted} accepted · {reviewSummary.rejected} rejected. These are review counts, not a 99% claim.</p>
        </div>
      ) : null}
      {reconciliation ? (
        <div className="mb-3 rounded-lg border border-border p-2 text-[11px] leading-4">
          <div className="font-bold text-foreground">Plan vs schedule</div>
          <p className="mt-1 text-muted-foreground">{describeReconciliation(reconciliation)}</p>
          {reconciliation.discrepancyCount ? (
            <p className="mt-1 text-amber-800 dark:text-amber-200">Takeoff quantity is still the plan count ({reconciliation.persistedCount}).</p>
          ) : null}
        </div>
      ) : null}
      <div className="mb-2 flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-600 dark:text-orange-500" /><h3 className="font-bold">Quantity schedule</h3></div>
      {!rollup.calibrated && (
        <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Calibrate scale before trusting LF / SF. Counts still work.</p>
      )}
      <div className="space-y-2 text-sm">
        {rollup.rows.length === 0 && <p className="text-xs text-muted-foreground">No takeoff items yet.</p>}
        {rollup.rows.map((row) => {
          const key = `${row.category}|${row.symbol}`;
          const edit = scheduleEdits[key] || {};
          const symbol = edit.symbol ?? row.symbol;
          const category = edit.category ?? row.category;
          const count = edit.count ?? row.count;
          const lf = edit.lf ?? (row.hasLength ? row.lf : "");
          const sf = edit.sf ?? (row.hasArea ? row.sf : "");
          return (
            <div key={key} className="space-y-1 rounded-lg border border-border px-2 py-1.5">
              <TradeSymbolSelect
                trade={trade}
                marks={marks}
                pageKinds={pageKinds}
                value={symbol}
                className={inputClass}
                aria-label="Item name"
                onChange={(item) => {
                  const next = { symbol: item.label, category: item.takeoffCategory || item.category };
                  onEditRow(row, next);
                  onRenameRow?.(row, next);
                }}
              />
              <input className={inputClass} aria-label="Item category" value={category} readOnly />
              <div className="grid grid-cols-3 gap-1">
                <input className={inputClass} aria-label="Count" type="number" value={count} onChange={(e) => onEditRow(row, { count: e.target.value })} />
                <input className={inputClass} aria-label="Length" type="number" value={lf} onChange={(e) => onEditRow(row, { lf: e.target.value })} />
                <input className={inputClass} aria-label="Area" type="number" value={sf} onChange={(e) => onEditRow(row, { sf: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conduit runs</div>
        {runs.length === 0 && <p className="text-[11px] text-muted-foreground">Trace conduit to store each run.</p>}
        <div className="space-y-2">
          {runs.map((run) => (
            <div key={run.id} className="space-y-1 rounded-lg border border-border px-2 py-1.5">
              <button type="button" onClick={() => onSelectRun(run.id)} className="text-left text-[11px] font-semibold">Run {run.runNumber} · sheet {run.sheet}</button>
              <select
                className={inputClass}
                value={conduitOptions.find((item) => item.label === run.type)?.id || ""}
                onChange={(e) => {
                  const option = conduitOptions.find((item) => item.id === e.target.value);
                  if (!option) return;
                  onUpdateMark(run.id, { symbol: option.id, symbolLabel: option.label, abbr: option.size, conduitSize: option.size, conduitMaterial: option.material });
                }}
              >
                {!conduitOptions.some((item) => item.label === run.type) && <option value="">{run.type}</option>}
                {conduitOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-1">
                <input type="color" aria-label="Run color" className="h-8 w-full" value={run.color || "#2563eb"} onChange={(e) => onUpdateMark(run.id, { color: e.target.value })} />
                <input type="number" aria-label="This line size" min="0.5" step="0.1" className={inputClass} value={run.thickness} onChange={(e) => onUpdateMark(run.id, lineSizePatch(e.target.value))} />
                <input type="number" aria-label="Run length" step="0.1" className={inputClass} value={run.lf || ""} onChange={(e) => onUpdateMark(run.id, { storedFeet: Number(e.target.value), lengthEdited: true })} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {drawingDocs && (
        <div className="mt-3 rounded-lg border border-border p-2 text-[11px] leading-4 text-muted-foreground">
          <div className="font-bold text-foreground">Legend / schedules</div>
          <p>{drawingDocs.symbols.length} legend symbols · {drawingDocs.scheduleItems.length} schedule types</p>
          {drawingDocs.pages.filter((page) => page.kind !== "drawing").slice(0, 6).map((page) => (
            <button key={page.page} type="button" onClick={() => onSelectSheet(page.page)} className="mt-1 block text-left text-blue-700 hover:underline dark:text-orange-300">
              Sheet {page.page}: {page.kind.replace("-", " ")}
            </button>
          ))}
          {drawingDocs.notes[0] && <p className="mt-1 text-amber-800 dark:text-amber-200">{drawingDocs.notes[0]}</p>}
        </div>
      )}
      {trueAnalysis && (
        <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-50/50 p-2 text-[11px] leading-4 dark:bg-emerald-500/5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-emerald-800 dark:text-emerald-300">True electrical audit</div>
            <button type="button" onClick={onBuildTrueTakeoff} className="rounded bg-emerald-600 px-2 py-1 font-bold text-white">Build</button>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-foreground">
            <span>Devices</span><strong>{trueAnalysis.totals.devices}</strong>
            <span>Measured conduit</span><strong>{trueAnalysis.totals.conduitLf.toFixed(1)} LF</strong>
            <span>Panels</span><strong>{trueAnalysis.panels.length}</strong>
            <span>Transformers</span><strong>{trueAnalysis.transformers.length}</strong>
            <span>Mechanical tags</span><strong>{Object.values(trueAnalysis.equipment).flat().length}</strong>
            <span>Warnings</span><strong>{trueAnalysis.warnings.length}</strong>
          </div>
          {trueTakeoffResult?.summary ? (
            <div className="mt-2 rounded border border-emerald-500/30 bg-background p-2">
              <div className="flex justify-between"><span>Direct</span><strong>{`${trueTakeoffResult.summary.direct.toLocaleString()}`}</strong></div>
              <div className="flex justify-between text-sm"><span>Bid total</span><strong className="text-emerald-700 dark:text-emerald-300">{`${trueTakeoffResult.summary.total.toLocaleString()}`}</strong></div>
            </div>
          ) : null}
          {trueAnalysis.warnings.slice(0, 4).map((warning) => (
            <p key={warning} className="mt-1 text-amber-800 dark:text-amber-200">• {warning}</p>
          ))}
        </div>
      )}

      <button type="button" onClick={onCopy} className="mt-3 w-full rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:bg-muted">Copy schedule CSV</button>
      <button type="button" onClick={onDownloadQuoteExcel} className="mt-2 w-full rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:bg-muted">Download quote (Excel)</button>
      <button type="button" onClick={onDownloadQuotePdf} className="mt-2 w-full rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:bg-muted">Download quote (PDF)</button>
      <p className="mt-2 text-[10px] text-muted-foreground">Totals {totals.count} devices · {rollup.calibrated ? formatFeet(totals.lf) : "LF needs scale"} · {rollup.calibrated ? formatArea(totals.sf) : "SF needs scale"}</p>
    </aside>
  );
}
