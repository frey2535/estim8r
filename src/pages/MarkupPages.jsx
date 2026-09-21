import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { FileUp, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPdfDocument } from "@/lib/pdf-document";
import { buildMarkupPages, downloadBlob, getDrawingFile, listProjectFolders, readTakeoffSession, writeTakeoffSession } from "@/domain/estimate/projectDocuments";
import { readEstimate, syncStoredEstimate } from "@/domain/estimate/estimateStore";
import { titleBlockForMarkup } from "@/domain/estimate/fromDrawings";
import {
  assignDeviceToConduit,
  buildReviewMarkupPages,
  flattenMarkupMarks,
  reviewCategoryForMark,
} from "@/domain/takeoff/markupPages";
import { hitTestMark, sheetAspect } from "@/domain/takeoff/geometry";
import { rollupTakeoff } from "@/domain/takeoff/quantities";
import { paletteForTrade, findConduitOption, DEFAULT_CONDUIT_ID } from "@/domain/takeoff/trades";
import { buildAiMarks } from "@/domain/takeoff/aiTakeoff";
import { readAiPages } from "@/domain/takeoff/aiPages";
import { drawingSymbolsFromDocs, readDrawingDocuments } from "@/domain/takeoff/drawing-docs";
import { DEFAULT_LINE_SIZE, DEFAULT_MARKER_SIZE, resolvedLineSize } from "@/domain/takeoff/sizes";
import { OVERLAY_FONT_SIZE, layoutOverlayCallouts } from "@/domain/takeoff/overlayLayout";
import {
  CIRCUIT_COLOR,
  DEVICE_FILL_OPACITY,
  applyDeviceTypeColors,
  deviceOutline,
  isCircuitMark,
  isDeviceMark,
} from "@/domain/takeoff/deviceStyles";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function fitSheetSize(sheetW, sheetH, viewW, viewH, zoom) {
  if (!sheetW || !sheetH || !viewW || !viewH) return { width: 0, height: 0 };
  const availW = Math.max(48, viewW - 16);
  const availH = Math.max(48, viewH - 16);
  const fit = Math.min(availW / sheetW, availH / sheetH);
  return {
    width: Math.max(1, Math.floor(sheetW * fit * zoom)),
    height: Math.max(1, Math.floor(sheetH * fit * zoom)),
  };
}

function pageCountFrom(marks, session) {
  const marked = (marks || []).map((mark) => Number(mark.sheet) || 1);
  return Math.max(Number(session?.pageCount) || 1, Number(session?.sheet) || 1, ...marked, 1);
}

export default function MarkupPages() {
  const [params] = useSearchParams();
  const fileName = params.get("file") || "";
  const fileSize = Number(params.get("size") || 0);
  const inputRef = useRef(null);
  const viewportRef = useRef(null);
  const viewerRef = useRef(null);
  const [session, setSession] = useState(null);
  const [marks, setMarks] = useState([]);
  const [fileBytes, setFileBytes] = useState(null);
  const [drawingName, setDrawingName] = useState(fileName);
  const [status, setStatus] = useState("Open markup pages from the Estimates folder, or import a markup JSON.");
  const [busy, setBusy] = useState(false);
  const [pageId, setPageId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const folders = useMemo(() => listProjectFolders(), []);

  const calibration = session?.calibration || null;
  const reviewPages = useMemo(() => buildReviewMarkupPages({ marks }), [marks]);
  const activePage = reviewPages.find((page) => page.id === pageId) || reviewPages[0] || null;
  const selected = marks.find((mark) => mark.id === selectedId) || null;
  const groups = activePage?.kind === "circuits" ? activePage.groups : [];

  useEffect(() => {
    if (!fileName) return;
    const stored = readTakeoffSession(fileName, fileSize);
    setSession(stored);
    setMarks(stored?.marks || []);
    setDrawingName(fileName);
    if (stored?.marks?.length) setStatus(`Loaded ${stored.marks.length} takeoff marks. Review the AI markup pages, then edit anything that is wrong.`);
    else setStatus("No saved takeoff yet. Estim8r will create AI markup pages from the drawing if it is on this device.");
    void loadDrawing(fileName, fileSize, stored);
  }, [fileName, fileSize]);

  useEffect(() => {
    if (reviewPages.length && !reviewPages.some((page) => page.id === pageId)) {
      setPageId(reviewPages[0].id);
    }
  }, [reviewPages, pageId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setViewportSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [drawingName]);

  async function loadDrawing(name, size, stored) {
    const file = await getDrawingFile(name, size);
    if (!file) return;
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setDrawingName(file.name || name);
    if (!(stored?.marks || []).length && (file.type === "application/pdf" || /\.pdf$/i.test(file.name || name))) {
      await createAiMarkup(bytes, file.name || name, size, stored);
    }
  }

  async function createAiMarkup(bytes, name, size, stored) {
    setBusy(true);
    setStatus("AI is creating markup pages from the drawing…");
    try {
      const pages = await readAiPages(bytes);
      let drawingSymbols = [];
      try {
        drawingSymbols = drawingSymbolsFromDocs(await readDrawingDocuments(bytes));
      } catch {
        drawingSymbols = [];
      }
      const palette = paletteForTrade(stored?.trade || "electrical", drawingSymbols);
      const planned = buildAiMarks({
        pages,
        trade: stored?.trade || "electrical",
        symbols: palette.symbols,
        drawingSymbols: palette.fromDrawing,
        maxHomeruns: stored?.maxHomeruns || 3,
        conduit: findConduitOption(stored?.conduitId || DEFAULT_CONDUIT_ID, stored?.trade || "electrical"),
      });
      persistMarks(planned.marks, {
        ...(stored || {}),
        fileName: name,
        fileSize: size,
        pageCount: pages.length,
        marks: planned.marks,
      }, planned.summary);
    } catch (error) {
      setStatus(error?.message || "AI could not create markup pages from this drawing.");
    } finally {
      setBusy(false);
    }
  }

  function persistMarks(nextMarks, nextSession, message) {
    const payload = {
      version: 2,
      savedAt: new Date().toISOString(),
      fileName: nextSession?.fileName || fileName || drawingName,
      fileSize: nextSession?.fileSize || fileSize,
      marks: nextMarks,
      calibration: nextSession?.calibration || calibration,
      trade: nextSession?.trade || "electrical",
      sheet: activePage?.sourcePage || nextSession?.sheet || 1,
      pageCount: pageCountFrom(nextMarks, nextSession),
    };
    setMarks(nextMarks);
    setSession(payload);
    if (payload.fileName) {
      writeTakeoffSession(payload.fileName, payload.fileSize, payload);
      try {
        syncStoredEstimate({
          fileName: payload.fileName,
          fileSize: payload.fileSize,
          rollup: rollupTakeoff(nextMarks, payload.calibration),
          pageCount: payload.pageCount,
        });
      } catch {
        /* estimate copy failed; markup edits still saved */
      }
    }
    if (message) setStatus(message);
  }

  function updateMark(id, patch) {
    persistMarks(marks.map((mark) => (mark.id === id ? { ...mark, ...patch } : mark)), session, "Markup edit saved.");
  }

  function deleteSelected() {
    if (!selectedId) return;
    persistMarks(marks.filter((mark) => mark.id !== selectedId), session, "Removed that mark from the AI takeoff.");
    setSelectedId("");
  }

  function reassignCircuit(deviceId, conduitId) {
    persistMarks(assignDeviceToConduit(marks, deviceId, conduitId), session, "Circuit grouping updated.");
  }

  function downloadMarkup() {
    const estimate = readEstimate(fileName || session?.fileName, fileSize || session?.fileSize);
    const markup = buildMarkupPages({
      fileName: fileName || session?.fileName || drawingName,
      pageCount: pageCountFrom(marks, session),
      marks,
      calibration,
      titleBlock: titleBlockForMarkup(estimate?.header),
    });
    downloadBlob(
      new Blob([JSON.stringify(markup, null, 2)], { type: "application/json" }),
      `${(fileName || drawingName || "markup").replace(/\.[^.]+$/, "")}-markup-pages.json`,
    );
  }

  function importMarkupFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const nextMarks = flattenMarkupMarks(parsed);
        persistMarks(nextMarks, {
          fileName: parsed.fileName || file.name,
          fileSize: 0,
          calibration: parsed.calibration || null,
          pageCount: Math.max(parsed.pages?.length || 1, ...nextMarks.map((mark) => Number(mark.sheet) || 1), 1),
          marks: nextMarks,
        }, `Imported ${nextMarks.length} marks. Review and edit the AI takeoff.`);
        setDrawingName(parsed.fileName || file.name);
        if (parsed.fileName) void loadDrawing(parsed.fileName, 0, { marks: nextMarks, calibration: parsed.calibration });
      } catch {
        setStatus("That file is not markup JSON.");
      }
    };
    reader.readAsText(file);
  }

  function onOverlayClick(event) {
    if (!viewerRef.current || !activePage) return;
    const rect = viewerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
    const aspect = sheetAspect(rect.width, rect.height);
    const hit = [...(activePage.marks || [])].reverse().find((mark) => hitTestMark(mark, point, aspect));
    setSelectedId(hit?.id || "");
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-orange-500">Markup pages</p>
          <h1 className="text-2xl font-black">Review AI takeoff</h1>
          <p className="text-sm text-muted-foreground">
            Each device type is its own drawing. Conduit runs and circuit groups are separate pages. Edit a mark to correct the takeoff.
            {drawingName ? ` Drawing: ${drawingName}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Estimates</Link>
          <Link to="/takeoff" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Takeoff</Link>
          <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            <FileUp className="h-4 w-4" /> Import JSON
          </button>
          <button type="button" onClick={downloadMarkup} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Download JSON</button>
          <input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={(event) => { importMarkupFile(event.target.files?.[0]); event.target.value = ""; }} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <aside className="min-h-0 overflow-auto border-b border-border p-3 lg:border-b-0 lg:border-r">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">AI pages</h2>
          {!fileName && !marks.length ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">Pick a saved project or import the markup JSON.</p>
              {folders.map((folder) => (
                <Link key={folder.id} to={`/markup?file=${encodeURIComponent(folder.fileName || "")}&size=${folder.fileSize || 0}`} className="block rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
                  {folder.projectName}
                </Link>
              ))}
            </div>
          ) : null}
          {busy ? <p className="mt-3 text-sm font-semibold">Creating markup pages…</p> : null}
          <div className="mt-3 grid gap-2">
            {reviewPages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => { setPageId(page.id); setSelectedId(""); }}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm",
                  activePage?.id === page.id ? "border-blue-600 bg-blue-600/10 dark:border-orange-500 dark:bg-orange-500/10" : "border-border hover:bg-muted",
                )}
              >
                <div className="font-semibold">{page.title}</div>
                <div className="text-xs text-muted-foreground">{page.summary}</div>
              </button>
            ))}
            {!reviewPages.length && !busy ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">No conduit or device marks yet.</p>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))} className="rounded-lg p-2 hover:bg-muted" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
            <span className="min-w-12 text-center text-xs font-semibold">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(4, Number((value + 0.25).toFixed(2))))} className="rounded-lg p-2 hover:bg-muted" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
            {selectedId ? (
              <button type="button" onClick={deleteSelected} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" /> Delete mark
              </button>
            ) : null}
          </div>
          <div ref={viewportRef} className="min-h-[20rem] min-w-0 flex-1 overflow-hidden bg-neutral-400/40 dark:bg-neutral-950">
            <div className="flex h-full w-full items-center justify-center p-2">
              <div ref={viewerRef} onClick={onOverlayClick} className="relative bg-white shadow-xl">
                {fileBytes ? (
                  <PdfSheet
                    fileBytes={fileBytes}
                    fileName={drawingName}
                    zoom={zoom}
                    pageNumber={activePage?.sourcePage || 1}
                    viewportWidth={viewportSize.width}
                    viewportHeight={viewportSize.height}
                  />
                ) : (
                  <div className="flex h-[28rem] w-[36rem] max-w-full items-center justify-center bg-white text-sm text-muted-foreground">
                    {activePage ? "Drawing file is not on this device. Marks still show on the sheet grid." : "Select a markup page."}
                  </div>
                )}
                <ReviewOverlay marks={activePage?.marks || []} selectedId={selectedId} groups={groups} />
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">{status}</div>
        </section>

        <aside className="min-h-0 overflow-auto border-t border-border p-3 lg:border-l lg:border-t-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Edit takeoff</h2>
          {selected ? (
            <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
              <label className="block text-xs font-bold text-muted-foreground">Name
                <input className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={selected.symbolLabel || ""} onChange={(e) => updateMark(selected.id, { symbolLabel: e.target.value })} />
              </label>
              <label className="block text-xs font-bold text-muted-foreground">Category
                <input className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={selected.category || ""} onChange={(e) => updateMark(selected.id, { category: e.target.value })} />
              </label>
              <label className="block text-xs font-bold text-muted-foreground">Marker
                <input className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={selected.abbr || ""} onChange={(e) => updateMark(selected.id, { abbr: e.target.value })} />
              </label>
              {selected.type === "count" || selected.type === "drop" ? (
                <label className="block text-xs font-bold text-muted-foreground">Conduit group
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={selected.circuitRunId || groups.find((group) => group.deviceIds.includes(selected.id))?.conduitId || ""}
                    onChange={(e) => reassignCircuit(selected.id, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {groups.map((group) => (
                      <option key={group.conduitId} value={group.conduitId}>{group.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <p className="text-xs text-muted-foreground">Review category: {reviewCategoryForMark(selected)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Click a mark on the drawing to edit or delete it.</p>
          )}
          {activePage?.kind === "circuits" ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-bold">Circuits per conduit</h3>
              {groups.map((group) => (
                <div key={group.conduitId} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="font-semibold">{group.label}</div>
                  <div className="text-xs text-muted-foreground">{group.deviceCount} device{group.deviceCount === 1 ? "" : "s"} on this run</div>
                </div>
              ))}
            </div>
          ) : null}
          {activePage?.kind === "devices" ? (
            <p className="mt-4 text-sm text-muted-foreground">{activePage.summary} on this drawing. Other device types are on their own pages.</p>
          ) : null}
          {activePage?.kind === "conduit" ? (
            <p className="mt-4 text-sm text-muted-foreground">Every conduit run on this sheet. Open Circuits per conduit to see how devices are grouped.</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ReviewOverlay({ marks, selectedId }) {
  const styled = applyDeviceTypeColors(marks);
  const devices = styled.filter((mark) => isDeviceMark(mark));
  const circuits = styled.filter((mark) => isCircuitMark(mark) && mark.points?.length);
  const callouts = layoutOverlayCallouts({
    conduits: circuits.filter((mark) => mark.tool === "conduit"),
    devices,
    selectedId,
  });
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {circuits.map((mark) => {
        const points = mark.points.map((point) => `${point.x},${point.y}`).join(" ");
        const width = resolvedLineSize(mark, DEFAULT_LINE_SIZE);
        return (
          <g key={mark.id}>
            {mark.id === selectedId ? <polyline points={points} fill="none" stroke="#ffffff" strokeWidth={width + 1.4} vectorEffect="non-scaling-stroke" /> : null}
            <polyline points={points} fill="none" stroke={CIRCUIT_COLOR} strokeWidth={width} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
      {devices.map((mark) => {
        const outline = deviceOutline(mark, DEFAULT_MARKER_SIZE);
        const color = mark.color || "#1e3a8a";
        const selected = mark.id === selectedId;
        if (outline.kind === "circle") {
          return (
            <circle key={mark.id} cx={mark.x} cy={mark.y} r={outline.r} fill={color} fillOpacity={DEVICE_FILL_OPACITY} stroke={selected ? "#ea580c" : color} strokeWidth={selected ? 0.28 : 0.12} vectorEffect="non-scaling-stroke" />
          );
        }
        return (
          <rect key={mark.id} x={mark.x - outline.w / 2} y={mark.y - outline.h / 2} width={outline.w} height={outline.h} rx={0.12} fill={color} fillOpacity={DEVICE_FILL_OPACITY} stroke={selected ? "#ea580c" : color} strokeWidth={selected ? 0.28 : 0.12} vectorEffect="non-scaling-stroke" />
        );
      })}
      {[...callouts.conduitLabels, ...callouts.deviceLabels].map((label) => (
        <text
          key={`${label.id}-${label.text}`}
          x={label.x}
          y={label.y}
          fontSize={OVERLAY_FONT_SIZE}
          fontWeight="600"
          fill={devices.find((mark) => mark.id === label.id)?.color || "#475569"}
          stroke="#ffffff"
          strokeWidth="0.22"
          paintOrder="stroke"
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}

function PdfSheet({ fileBytes, fileName, zoom, pageNumber, viewportWidth, viewportHeight }) {
  const canvasRef = useRef(null);
  const pdfRef = useRef(null);
  const bytesRef = useRef(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (bytesRef.current !== fileBytes) {
      pdfRef.current = null;
      bytesRef.current = fileBytes;
    }
  }, [fileBytes]);

  useEffect(() => {
    if (!fileBytes || !canvasRef.current || viewportWidth < 40 || viewportHeight < 40) return undefined;
    let cancelled = false;
    let renderTask;
    async function renderPdf() {
      try {
        if (!pdfRef.current) pdfRef.current = await getPdfDocument(fileBytes);
        const pdf = pdfRef.current;
        if (cancelled) return;
        const safePage = Math.min(Math.max(pageNumber || 1, 1), pdf.numPages);
        const page = await pdf.getPage(safePage);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const fitted = fitSheetSize(base.width, base.height, viewportWidth, viewportHeight, zoom);
        if (!fitted.width || !fitted.height) return;
        setDisplaySize(fitted);
        const outputScale = Math.min(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: (fitted.width / base.width) * outputScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${fitted.width}px`;
        canvas.style.height = `${fitted.height}px`;
        context.setTransform(1, 0, 0, 1, 0, 0);
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled && error?.name !== "RenderingCancelledException") console.error("Markup PDF render failed", error);
      }
    }
    void renderPdf();
    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch { /* ignore */ }
    };
  }, [fileBytes, pageNumber, zoom, viewportWidth, viewportHeight]);

  return (
    <div className="relative bg-white" style={displaySize.width ? { width: displaySize.width, height: displaySize.height } : undefined}>
      <canvas ref={canvasRef} className="block bg-white" aria-label={fileName} />
    </div>
  );
}
