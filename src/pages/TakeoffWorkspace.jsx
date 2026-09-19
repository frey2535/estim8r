import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cable, Cloud, FileUp, Hand, Image as ImageIcon, Layers3, MousePointer2,
  Pencil, Redo2, Route, Ruler, ScanSearch, Spline, Square, StickyNote,
  Trash2, Undo2, Upload, X, ZoomIn, ZoomOut, Crosshair, Gauge, Lightbulb, Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  CATEGORIES, DEFAULT_DROP_FEET, DRAWING_CATEGORY, TAKEOFF_TOOLS, TOOL_GROUPS,
  findSymbol, symbolsForCategory, toolByKey,
} from "@/domain/takeoff/catalog";
import {
  calibrationFromPoints, feetFromPercent, formatArea, formatFeet,
  hitTestMark, polylineLength, sheetAspect, widthPercentDistance,
} from "@/domain/takeoff/geometry";
import { conduitRuns, nextConduitRunNumber, projectConduitTotal, quantitiesToCsv, rollupTakeoff } from "@/domain/takeoff/quantities";
import { drawingSymbolsFromDocs, readDrawingDocuments } from "@/domain/takeoff/drawing-docs";
import SheetThumbnailPanel, { readThumbsOpen, writeThumbsOpen } from "@/components/takeoff/SheetThumbnailPanel";
import DevicePicker from "@/components/takeoff/DevicePicker";
import { getPdfDocument } from "@/lib/pdf-document";
import { syncStoredEstimate } from "@/domain/estimate/estimateStore";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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

let pendingDrawingFile = null;

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

function storageKey(file) {
  return `estim8r.takeoff.v1:${file?.name || "drawing"}:${file?.size || 0}`;
}

function loadSession(file) {
  try {
    const raw = localStorage.getItem(storageKey(file));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function TakeoffWorkspace() {
  const inputRef = useRef(null);
  const viewerRef = useRef(null);
  const viewportRef = useRef(null);
  const fileUrlRef = useRef("");
  const historyRef = useRef({ past: [], future: [] });
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [fileBytes, setFileBytes] = useState(null);
  const [loadingDrawing, setLoadingDrawing] = useState(false);
  const [drawingError, setDrawingError] = useState("");
  const [mode, setMode] = useState("manual");
  const [tool, setTool] = useState("count");
  const [category, setCategory] = useState("Receptacles");
  const [symbolId, setSymbolId] = useState("duplex");
  const [zoom, setZoom] = useState(1);
  const [marks, setMarks] = useState([]);
  const [draftPoints, setDraftPoints] = useState([]);
  const [status, setStatus] = useState("Upload a drawing to begin.");
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [sheetMeta, setSheetMeta] = useState({ page: 1, pageCount: 1 });
  const [calibration, setCalibration] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [measureLabel, setMeasureLabel] = useState("");
  const [thumbsOpen, setThumbsOpen] = useState(readThumbsOpen);
  const [savedAt, setSavedAt] = useState("");
  const [symbolQuery, setSymbolQuery] = useState("");
  const [drawingDocs, setDrawingDocs] = useState(null);
  const [hoverPoint, setHoverPoint] = useState(null);
  const [wideLayout, setWideLayout] = useState(() => (
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  ));

  const isPdf = file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");
  const drawingSymbols = useMemo(() => drawingSymbolsFromDocs(drawingDocs), [drawingDocs]);
  const categories = useMemo(
    () => (drawingSymbols.length ? [DRAWING_CATEGORY, ...CATEGORIES] : CATEGORIES),
    [drawingSymbols.length],
  );
  const symbols = useMemo(() => symbolsForCategory(category, drawingSymbols), [category, drawingSymbols]);
  const symbol = findSymbol(symbolId, drawingSymbols);
  const activeTool = toolByKey(tool);
  const sheetMarks = useMemo(
    () => marks.filter((mark) => (mark.sheet || 1) === (sheetMeta.page || 1)),
    [marks, sheetMeta.page],
  );
  const aspect = viewerRef.current
    ? sheetAspect(viewerRef.current.clientWidth, viewerRef.current.clientHeight)
    : 1;
  const rollup = useMemo(
    () => rollupTakeoff(marks, calibration, aspect),
    [marks, calibration, aspect],
  );
  const runs = useMemo(
    () => conduitRuns(marks, calibration, aspect),
    [marks, calibration, aspect],
  );
  const conduitTotal = projectConduitTotal(runs);

  useEffect(() => {
    if (!file) return;
    try {
      syncStoredEstimate({
        fileName: file.name,
        fileSize: file.size,
        drawingDocs,
        rollup,
        pageCount: sheetMeta.pageCount,
      });
    } catch {
      /* estimate copy failed; takeoff sheet is unchanged */
    }
  }, [file, drawingDocs, rollup, sheetMeta.pageCount]);
  const draftPreview = hoverPoint && draftPoints.length ? [...draftPoints, hoverPoint] : draftPoints;
  const draftFeet = feetFromPercent(polylineLength(draftPreview, aspect), calibration);
  const imageDisplay = fitSheetSize(
    imageSize.width,
    imageSize.height,
    viewportSize.width,
    viewportSize.height,
    zoom,
  );

  useEffect(() => {
    if (!symbols.some((item) => item.id === symbolId)) {
      setSymbolId(symbols[0]?.id || "duplex");
    }
  }, [category, symbolId, symbols]);

  async function chooseFile(nextFile) {
    if (!nextFile) {
      setStatus("No drawing selected.");
      return;
    }
    const allowed = nextFile.type === "application/pdf"
      || nextFile.type.startsWith("image/")
      || /\.(pdf|png|jpe?g|webp)$/i.test(nextFile.name || "");
    if (!allowed) {
      pendingDrawingFile = null;
      setDrawingError("Unsupported file. Choose a PDF, PNG, JPG, JPEG, or WEBP drawing.");
      setStatus("Drawing import failed.");
      return;
    }

    pendingDrawingFile = nextFile;
    setFile(nextFile);
    setLoadingDrawing(true);
    setDrawingError("");
    setStatus(`Importing ${nextFile.name}…`);
    setDraftPoints([]);
    setZoom(1);
    setImageSize({ width: 0, height: 0 });
    setSheetMeta({ page: 1, pageCount: 1 });
    setSelectedId(null);
    setMeasureLabel("");

    const saved = loadSession(nextFile);
    setMarks(Array.isArray(saved?.marks) ? saved.marks : []);
    setCalibration(saved?.calibration || null);
    setSavedAt(saved?.savedAt || "");
    if (saved?.symbolId) setSymbolId(saved.symbolId);
    if (saved?.category) setCategory(saved.category);
    if (saved?.sheet) setSheetMeta((current) => ({ ...current, page: saved.sheet }));

    try {
      const bytes = await nextFile.arrayBuffer();
      if (!bytes?.byteLength) throw new Error("The selected file is empty or could not be read.");
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
      const url = URL.createObjectURL(nextFile);
      fileUrlRef.current = url;
      setFileUrl(url);
      setFileBytes(bytes);
      setStatus(`${nextFile.name} imported. Calibrate scale, then take off the sheet.`);
    } catch (error) {
      console.error("Drawing import failed", error);
      pendingDrawingFile = null;
      setFile(null);
      setFileUrl("");
      setFileBytes(null);
      fileUrlRef.current = "";
      setDrawingError(error?.message || "Estim8r could not read the selected drawing.");
      setStatus("Drawing import failed.");
    } finally {
      setLoadingDrawing(false);
    }
  }

  useEffect(() => {
    if (pendingDrawingFile) void chooseFile(pendingDrawingFile);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWideLayout(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function sessionPayload() {
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      fileName: file?.name,
      fileSize: file?.size,
      marks,
      calibration,
      symbolId,
      category,
      sheet: sheetMeta.page,
    };
  }

  function saveTakeoff(silent = false) {
    if (!file) return;
    const payload = sessionPayload();
    try {
      localStorage.setItem(storageKey(file), JSON.stringify(payload));
      setSavedAt(payload.savedAt);
      if (!silent) setStatus(`Takeoff saved${file.name ? ` for ${file.name}` : ""}.`);
    } catch {
      setStatus("Could not save takeoff in this browser.");
    }
  }

  function downloadTakeoff() {
    if (!file) return;
    const payload = sessionPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `estim8r-takeoff-${(file.name || "drawing").replace(/\.[^.]+$/, "")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Takeoff JSON downloaded.");
  }

  useEffect(() => {
    if (!file) return;
    try {
      localStorage.setItem(storageKey(file), JSON.stringify({ ...sessionPayload(), savedAt: savedAt || undefined }));
    } catch {
      /* private mode */
    }
  }, [file, marks, calibration, symbolId, category, sheetMeta.page]);

  useEffect(() => {
    if (!isPdf || !fileBytes) {
      setDrawingDocs(null);
      return undefined;
    }
    let cancelled = false;
    readDrawingDocuments(fileBytes).then((docs) => {
      if (cancelled) return;
      setDrawingDocs(docs);
      const found = (docs.symbols?.length || 0) + (docs.scheduleItems?.length || 0);
      if (found) {
        setStatus(`Read ${docs.symbols.length} legend symbols and ${docs.scheduleItems.length} schedule / spec types from the drawing.`);
        setCategory(DRAWING_CATEGORY);
        const first = drawingSymbolsFromDocs(docs)[0];
        if (first) setSymbolId(first.id);
      } else if (docs.notes?.length) {
        setStatus(docs.notes[0]);
      }
    }).catch((error) => {
      if (!cancelled) setStatus(error?.message || "Could not read legend or schedules from this PDF.");
    });
    return () => { cancelled = true; };
  }, [fileBytes, isPdf]);

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
  }, [file]);

  function commitMarks(next, message) {
    historyRef.current.past.push(marks);
    historyRef.current.future = [];
    if (historyRef.current.past.length > 80) historyRef.current.past.shift();
    setMarks(next);
    if (message) setStatus(message);
  }

  function openDrawingPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }

  function handleInputChange(event) {
    void chooseFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function closeDrawing() {
    if (marks.length && !window.confirm("Close this drawing? Takeoff marks stay on this browser for this file.")) return;
    pendingDrawingFile = null;
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = "";
    setFile(null);
    setFileUrl("");
    setFileBytes(null);
    setMarks([]);
    setDraftPoints([]);
    setDrawingError("");
    setLoadingDrawing(false);
    setZoom(1);
    setImageSize({ width: 0, height: 0 });
    setSheetMeta({ page: 1, pageCount: 1 });
    setSelectedId(null);
    setStatus("Drawing closed. Choose another drawing to continue.");
  }

  function toggleThumbs() {
    setThumbsOpen((current) => {
      const next = !current;
      writeThumbsOpen(next);
      return next;
    });
  }

  function selectSheet(nextPage) {
    setSheetMeta((current) => (current.page === nextPage ? current : { ...current, page: nextPage }));
    setDraftPoints([]);
    setSelectedId(null);
    setStatus(`Sheet ${nextPage} of ${sheetMeta.pageCount || nextPage}.`);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const droppedFile = event.dataTransfer?.files?.[0]
      || [...(event.dataTransfer?.items || [])].find((item) => item.kind === "file")?.getAsFile();
    chooseFile(droppedFile);
  }

  function drawingPoint(event) {
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function currentAspect() {
    const el = viewerRef.current;
    return sheetAspect(el?.clientWidth, el?.clientHeight);
  }

  function addMark(partial, message) {
    const raceway = (partial.tool || tool) === "conduit";
    const device = raceway && symbol?.category !== "Raceway" ? findSymbol("emt") : symbol;
    const mark = {
      id: crypto.randomUUID(),
      sheet: sheetMeta.page || 1,
      category: device?.takeoffCategory || device?.category || category,
      symbol: device?.id,
      symbolLabel: device?.label,
      abbr: device?.abbr,
      ...partial,
    };
    commitMarks([...marks, mark], message);
    return mark;
  }

  function onDrawingClick(event) {
    if (!file || tool === "pan") return;
    const point = drawingPoint(event);
    if (!point) return;
    const sheetAspectRatio = currentAspect();

    if (tool === "select") {
      const hit = [...sheetMarks].reverse().find((mark) => hitTestMark(mark, point, sheetAspectRatio));
      setSelectedId(hit?.id || null);
      setStatus(hit ? `Selected ${hit.symbolLabel || hit.type}.` : "Nothing selected.");
      return;
    }

    if (tool === "scale") {
      if (draftPoints.length === 0) {
        setDraftPoints([point]);
        setStatus("Scale started. Click the other end of a known dimension.");
        return;
      }
      const feet = Number(window.prompt("What is that distance in feet?", "20"));
      const next = calibrationFromPoints(draftPoints[0], point, feet, sheetAspectRatio);
      setDraftPoints([]);
      if (!next) {
        setStatus("Scale not set. Enter a length greater than 0.");
        return;
      }
      setCalibration(next);
      setStatus(`Scale set: ${next.feet} ft on this sheet. Linear and area tools will read in feet.`);
      return;
    }

    if (tool === "measure") {
      if (draftPoints.length === 0) {
        setDraftPoints([point]);
        setStatus("Measure started. Click the end point.");
        return;
      }
      const percent = widthPercentDistance(draftPoints[0], point, sheetAspectRatio);
      const feet = feetFromPercent(percent, calibration);
      setDraftPoints([]);
      setMeasureLabel(feet == null ? "Calibrate scale to read feet." : formatFeet(feet));
      setStatus(feet == null ? "Measured. Calibrate scale to convert this to feet." : `Measured ${formatFeet(feet)}.`);
      return;
    }

    if (tool === "count" || tool === "drop") {
      addMark(
        { type: tool === "drop" ? "drop" : "count", ...point, feet: tool === "drop" ? DEFAULT_DROP_FEET : undefined },
        tool === "drop"
          ? `${symbol?.label || category} drop counted${calibration ? ` (${DEFAULT_DROP_FEET} LF typical)` : ""}.`
          : `${symbol?.label || category} counted.`,
      );
      return;
    }

    if (tool === "markup") {
      const text = window.prompt("Review note");
      if (text) addMark({ type: "note", text, ...point }, "Note placed.");
      return;
    }

    if (tool === "linear" || tool === "homerun") {
      if (draftPoints.length === 0) {
        setDraftPoints([point]);
        setStatus(tool === "homerun" ? "Homerun started. Click the panel or destination." : "Linear started. Click the end point.");
        return;
      }
      const points = [draftPoints[0], point];
      const feet = feetFromPercent(polylineLength(points, sheetAspectRatio), calibration);
      addMark(
        { type: tool === "homerun" ? "homerun" : "line", tool, points },
        feet == null ? `${tool === "homerun" ? "Homerun" : "Linear"} added. Calibrate scale to read LF.` : `${tool === "homerun" ? "Homerun" : "Linear"} ${formatFeet(feet)}.`,
      );
      setDraftPoints([]);
      return;
    }

    if (tool === "cloud") {
      if (draftPoints.length === 0) {
        setDraftPoints([point]);
        setStatus("Cloud started. Click the opposite corner.");
        return;
      }
      const a = draftPoints[0];
      addMark({
        type: "cloud",
        points: [a, { x: point.x, y: a.y }, point, { x: a.x, y: point.y }, a],
      }, "Revision cloud added.");
      setDraftPoints([]);
      return;
    }

    if (["polyline", "area", "conduit", "circuit"].includes(tool)) {
      const next = [...draftPoints, point];
      setDraftPoints(next);
      if (tool === "conduit") {
        const feet = feetFromPercent(polylineLength(next, sheetAspectRatio), calibration);
        setMeasureLabel(feet == null ? "Conduit run in progress. Calibrate to read LF." : `Run in progress: ${formatFeet(feet)}`);
        setStatus(feet == null ? "Conduit vertex added. Double-click to finish the run." : `Conduit run ${formatFeet(feet)}. Double-click to finish.`);
      } else {
        setStatus(`${activeTool.label} in progress. Double-click to finish.`);
      }
    }
  }

  function finishPath(event) {
    if (!["polyline", "area", "conduit", "circuit"].includes(tool) || draftPoints.length < 2) return;
    event.preventDefault();
    const sheetAspectRatio = currentAspect();
    if (tool === "area") {
      if (draftPoints.length < 3) return;
      const sf = rollupTakeoff([{ type: "area", points: draftPoints, category }], calibration, sheetAspectRatio).rows[0]?.sf;
      addMark({ type: "area", points: draftPoints }, calibration ? `Area ${formatArea(sf)}.` : "Area added. Calibrate scale to read SF.");
    } else {
      const feet = feetFromPercent(polylineLength(draftPoints, sheetAspectRatio), calibration);
      const runNumber = tool === "conduit" ? nextConduitRunNumber(marks) : undefined;
      addMark(
        { type: "route", tool, points: draftPoints, runNumber, storedFeet: feet },
        tool === "conduit"
          ? (feet == null ? `Conduit run ${runNumber} added. Calibrate scale to read LF.` : `Conduit run ${runNumber}: ${formatFeet(feet)}.`)
          : (feet == null ? `${activeTool.label} added. Calibrate scale to read LF.` : `${activeTool.label} ${formatFeet(feet)}.`),
      );
      if (tool === "conduit") {
        setMeasureLabel(feet == null ? `Run ${runNumber} stored. Calibrate to total LF.` : `Run ${runNumber}: ${formatFeet(feet)}`);
      }
    }
    setDraftPoints([]);
  }

  function undo() {
    if (draftPoints.length) {
      setDraftPoints((current) => current.slice(0, -1));
      return;
    }
    const previous = historyRef.current.past.pop();
    if (!previous) return;
    historyRef.current.future.push(marks);
    setMarks(previous);
    setStatus("Undid last takeoff change.");
  }

  function redo() {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(marks);
    setMarks(next);
    setStatus("Redid last takeoff change.");
  }

  function clearAll() {
    if (marks.length && !window.confirm("Clear all takeoff marks on every sheet of this drawing?")) return;
    commitMarks([], "All takeoff marks cleared.");
    setSelectedId(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    commitMarks(marks.filter((mark) => mark.id !== selectedId), "Mark deleted.");
    setSelectedId(null);
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedId && !["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
          event.preventDefault();
          deleteSelected();
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        saveTakeoff();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onViewerPointerDown(event) {
    if (tool !== "pan" && !(tool === "select" && selectedId)) return;
    const point = drawingPoint(event);
    if (tool === "select" && selectedId) {
      const mark = marks.find((item) => item.id === selectedId);
      if (!mark || !hitTestMark(mark, point, currentAspect(), 3.2)) return;
      const start = point;
      const origin = mark.points ? mark.points.map((item) => ({ ...item })) : { x: mark.x, y: mark.y };
      const move = (moveEvent) => {
        const now = drawingPoint(moveEvent);
        if (!now) return;
        const dx = now.x - start.x;
        const dy = now.y - start.y;
        setMarks((current) => current.map((item) => {
          if (item.id !== selectedId) return item;
          if (item.points) return { ...item, points: origin.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) };
          return { ...item, x: origin.x + dx, y: origin.y + dy };
        }));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    const scroller = viewportRef.current;
    if (!scroller) return;
    const originX = event.clientX;
    const originY = event.clientY;
    const startLeft = scroller.scrollLeft;
    const startTop = scroller.scrollTop;
    const move = (moveEvent) => {
      scroller.scrollLeft = startLeft - (moveEvent.clientX - originX);
      scroller.scrollTop = startTop - (moveEvent.clientY - originY);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function copyQuantities() {
    const csv = quantitiesToCsv(rollup, runs);
    try {
      await navigator.clipboard.writeText(csv);
      setStatus("Quantity schedule copied as CSV.");
    } catch {
      window.prompt("Copy quantity CSV", csv);
    }
  }

  const fileInput = (
    <input
      id="takeoff-drawing-input"
      ref={inputRef}
      type="file"
      accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
      className="pointer-events-none absolute h-px w-px opacity-0"
      tabIndex={-1}
      onChange={handleInputChange}
    />
  );

  if (!file) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-orange-500">Estim8r Takeoff</p>
          <h1 className="mt-1 text-2xl font-black text-foreground">Electrical takeoff workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">Calibrated counts, conduit LF, circuit traces, areas, and a quantity schedule on the live drawing. Upload a PDF or image to start.</p>
        </section>
        <section className="relative rounded-2xl border border-border bg-card p-4 shadow-sm">
          {fileInput}
          <div
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; }}
            onDrop={handleDrop}
            className="flex min-h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-8 text-center dark:border-orange-500/30 dark:bg-orange-500/5"
          >
            <FileUp className="mb-3 h-10 w-10 text-blue-600 dark:text-orange-500" />
            <span className="text-lg font-bold text-foreground">Upload electrical drawings</span>
            <span className="mt-1 text-sm text-muted-foreground">PDF, PNG, JPG, JPEG, or WEBP — full sheet fits the window</span>
            <button type="button" onClick={openDrawingPicker} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white dark:bg-orange-500">
              <Upload className="h-4 w-4" /> Choose drawing
            </button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{status}</div>
          {drawingError && <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{drawingError}</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-background">
      {fileInput}
      <div
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; }}
        onDrop={handleDrop}
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-orange-500/10 dark:text-orange-500"><ImageIcon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="truncate font-bold text-foreground">{file.name}</div>
            <div className="text-xs text-muted-foreground">
              {isPdf ? `PDF • ${sheetMeta.pageCount} sheet${sheetMeta.pageCount === 1 ? "" : "s"}` : "Drawing image"}
              {calibration ? ` • scale ${calibration.feet} ft` : " • scale not set"}
              {zoom === 1 ? " • fitted to window" : ` • ${Math.round(zoom * 100)}%`}
              {savedAt ? ` • saved ${new Date(savedAt).toLocaleTimeString()}` : " • not saved yet"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[["manual", "Manual"], ["hybrid", "Hybrid"], ["ai", "AI assist"]].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setMode(value)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold", mode === value ? "border-blue-600 bg-blue-600 text-white dark:border-orange-500 dark:bg-orange-500" : "border-border bg-background")}>{label}</button>
          ))}
          <button type="button" onClick={() => saveTakeoff()} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-orange-500">
            <Save className="h-4 w-4" /> Save
          </button>
          <Link to="/estimates/new" className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted">Estimate</Link>
          <button type="button" onClick={downloadTakeoff} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted">Export JSON</button>
          <button type="button" onClick={openDrawingPicker} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted">Replace</button>
          <button type="button" onClick={closeDrawing} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><X className="h-4 w-4" /> Close</button>
        </div>
      </div>
      {drawingError && <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{drawingError}</div>}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        <aside className="hidden min-h-0 overflow-auto border-r border-border bg-card p-3 lg:block">
          {TOOL_GROUPS.map((group) => (
            <div key={group.key} className="mb-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {TAKEOFF_TOOLS.filter((item) => item.group === group.key).map((item) => {
                  const Icon = TOOL_ICONS[item.key] || Pencil;
                  return (
                    <button key={item.key} type="button" onClick={() => { setTool(item.key); setDraftPoints([]); setMeasureLabel(""); }}
                      className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold",
                        tool === item.key ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-orange-500 dark:bg-orange-500/10 dark:text-orange-300" : "border-border bg-background hover:bg-muted")}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />{item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="border-t border-border pt-3">
            <DevicePicker
              categories={categories}
              category={category}
              onCategory={(value) => { setCategory(value); setSymbolQuery(""); }}
              symbols={symbols}
              symbolId={symbolId}
              onSymbol={setSymbolId}
              query={symbolQuery}
              onQuery={setSymbolQuery}
            />
          </div>
          <div className="mt-3 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
            <strong className="block text-foreground">{activeTool.label}</strong>{activeTool.help}
            {measureLabel && <div className="mt-2 font-bold text-foreground">{measureLabel}</div>}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-card lg:flex-row">
          <SheetThumbnailPanel
            layout={wideLayout ? "side" : "strip"}
            fileBytes={fileBytes}
            fileUrl={fileUrl}
            isPdf={isPdf}
            fileName={file.name}
            page={sheetMeta.page}
            pageCount={sheetMeta.pageCount}
            marks={marks}
            open={thumbsOpen}
            onToggle={toggleThumbs}
            onSelectPage={selectSheet}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-1 overflow-auto border-b border-border p-1 lg:hidden">
            {TAKEOFF_TOOLS.map((item) => {
              const Icon = TOOL_ICONS[item.key] || Pencil;
              return <button key={item.key} type="button" onClick={() => { setTool(item.key); setDraftPoints([]); }} className={cn("inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold", tool === item.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-border")}>
                <Icon className="h-3.5 w-3.5" />{item.label}
              </button>;
            })}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-2 py-1.5">
            <div className="flex items-center gap-1">
              <button type="button" onClick={undo} className="rounded-lg p-2 hover:bg-muted" title="Undo"><Undo2 className="h-4 w-4" /></button>
              <button type="button" onClick={redo} className="rounded-lg p-2 hover:bg-muted" title="Redo"><Redo2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))} className="rounded-lg p-2 hover:bg-muted" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
              <span className="min-w-12 text-center text-xs font-semibold">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))} className="rounded-lg p-2 hover:bg-muted" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
              <button type="button" onClick={() => setZoom(1)} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted">Fit sheet</button>
              {sheetMeta.pageCount > 1 && (
                <div className="ml-2 flex items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-0.5">
                  <button type="button" disabled={sheetMeta.page <= 1} onClick={() => selectSheet(sheetMeta.page - 1)} className="rounded border border-border px-2 py-1 text-xs font-semibold disabled:opacity-40">Previous</button>
                  <strong className="min-w-24 px-1 text-center text-xs">Sheet {sheetMeta.page} of {sheetMeta.pageCount}</strong>
                  <button type="button" disabled={sheetMeta.page >= sheetMeta.pageCount} onClick={() => selectSheet(sheetMeta.page + 1)} className="rounded border border-border px-2 py-1 text-xs font-semibold disabled:opacity-40">Next</button>
                </div>
              )}
              {selectedId && <button type="button" onClick={deleteSelected} className="rounded-lg px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">Delete</button>}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={clearAll} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" />Clear</button>
            </div>
          </div>
          <div ref={viewportRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-neutral-400/40 dark:bg-neutral-950">
            <div className="flex min-h-full min-w-full items-center justify-center p-2">
              <div
                ref={viewerRef}
                onClick={onDrawingClick}
                onDoubleClick={finishPath}
                onPointerDown={onViewerPointerDown}
                onPointerMove={(event) => {
                  if (!["conduit", "polyline", "linear", "measure", "homerun"].includes(tool)) return;
                  setHoverPoint(drawingPoint(event));
                }}
                onPointerLeave={() => setHoverPoint(null)}
                className={cn("relative bg-white shadow-xl", tool === "pan" ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair")}
              >
                {isPdf ? (
                  fileBytes ? (
                    <PdfDrawing
                      fileBytes={fileBytes}
                      fileName={file.name}
                      zoom={zoom}
                      pageNumber={sheetMeta.page}
                      onPageNumber={(page) => setSheetMeta((current) => (current.page === page ? current : { ...current, page }))}
                      viewportWidth={viewportSize.width}
                      viewportHeight={viewportSize.height}
                      onPageInfo={(info) => {
                        setSheetMeta((current) => (
                          current.page === info.page && current.pageCount === info.pageCount ? current : info
                        ));
                        setDrawingError("");
                      }}
                    />
                  ) : <div className="p-8 text-sm text-muted-foreground">Reading PDF…</div>
                ) : fileUrl ? (
                  <img
                    src={fileUrl}
                    alt={file.name}
                    draggable={false}
                    onLoad={(event) => {
                      setImageSize({
                        width: event.currentTarget.naturalWidth || 1,
                        height: event.currentTarget.naturalHeight || 1,
                      });
                      setDrawingError("");
                      setSheetMeta({ page: 1, pageCount: 1 });
                      setStatus(`${file.name} fitted to the window. Calibrate scale to take off in feet.`);
                    }}
                    onError={() => { setDrawingError("The drawing file was imported but could not be rendered."); setStatus("Drawing render failed."); }}
                    className="block select-none"
                    style={imageDisplay.width ? { width: imageDisplay.width, height: imageDisplay.height } : { maxWidth: "100%", height: "auto" }}
                  />
                ) : (
                  <div className="p-8 text-sm text-muted-foreground">Reading drawing…</div>
                )}
                <MarkupOverlay
                  marks={sheetMarks}
                  draftPoints={draftPreview}
                  draftFeet={["conduit", "polyline", "linear", "homerun"].includes(tool) ? draftFeet : null}
                  selectedId={selectedId}
                  tool={tool}
                />
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">{status}</div>
          </div>
        </section>

        <aside className="hidden min-h-0 overflow-auto border-l border-border bg-card p-3 lg:block">
          <div className="mb-2 flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-600 dark:text-orange-500" /><h3 className="font-bold">Quantity schedule</h3></div>
          {!rollup.calibrated && (
            <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Calibrate scale before trusting LF / SF. Counts still work.</p>
          )}
          <div className="space-y-2 text-sm">
            {rollup.rows.length === 0 && <p className="text-xs text-muted-foreground">No takeoff items yet.</p>}
            {rollup.rows.map((row) => (
              <div key={`${row.category}-${row.symbol}`} className="rounded-lg border border-border px-2 py-1.5">
                <div className="text-xs font-bold">{row.symbol || row.category}</div>
                <div className="text-[11px] text-muted-foreground">{row.category}</div>
                <div className="mt-1 flex justify-between text-xs">
                  <span>{row.count} ea</span>
                  <span>{row.hasLength ? formatFeet(row.lf) : "—"}</span>
                  <span>{row.hasArea ? formatArea(row.sf) : "—"}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conduit runs</div>
            {runs.length === 0 && <p className="text-[11px] text-muted-foreground">Trace conduit to store each run.</p>}
            <div className="space-y-1.5">
              {runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between rounded-lg border border-border px-2 py-1 text-[11px]">
                  <span className="font-semibold">Run {run.runNumber} · sh {run.sheet} · {run.type}</span>
                  <span>{run.calibrated ? formatFeet(run.lf) : "calibrate"}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="font-bold">Project conduit</span>
              <strong>{rollup.calibrated ? formatFeet(conduitTotal) : "calibrate"}</strong>
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><span className="font-bold">Devices</span><strong>{rollup.totals.count}</strong></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Linear</span><span>{rollup.calibrated ? formatFeet(rollup.totals.lf) : "calibrate"}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Area</span><span>{rollup.calibrated ? formatArea(rollup.totals.sf) : "calibrate"}</span></div>
          </div>
          {drawingDocs && (
            <div className="mt-3 rounded-lg border border-border p-2 text-[11px] leading-4 text-muted-foreground">
              <div className="font-bold text-foreground">Legend / schedules</div>
              <p>{drawingDocs.symbols.length} legend symbols · {drawingDocs.scheduleItems.length} schedule types</p>
              {drawingDocs.pages.filter((page) => page.kind !== "drawing").slice(0, 6).map((page) => (
                <button key={page.page} type="button" onClick={() => selectSheet(page.page)} className="mt-1 block text-left text-blue-700 hover:underline dark:text-orange-300">
                  Sheet {page.page}: {page.kind.replace("-", " ")}
                </button>
              ))}
              {drawingDocs.notes[0] && <p className="mt-1 text-amber-800 dark:text-amber-200">{drawingDocs.notes[0]}</p>}
            </div>
          )}
          <button type="button" onClick={copyQuantities} className="mt-3 w-full rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:bg-muted">Copy schedule CSV</button>
          {(mode === "ai" || mode === "hybrid") && (
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-orange-500/30 dark:bg-orange-500/5">
              <div className="flex items-center gap-2 text-sm font-bold"><ScanSearch className="h-4 w-4 text-blue-600 dark:text-orange-500" />AI assist</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Manual takeoff is live. Automatic symbol detection will add review candidates here when the analysis worker is connected — it will not silently zero a sheet.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function MarkupOverlay({ marks, draftPoints, draftFeet, selectedId, tool }) {
  const routes = marks.filter((m) => m.points?.length);
  const draftEnd = draftPoints[draftPoints.length - 1];
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {routes.map((mark) => {
        const points = mark.points.map((p) => `${p.x},${p.y}`).join(" ");
        const selected = mark.id === selectedId;
        const end = mark.points[mark.points.length - 1];
        if (mark.type === "area" || mark.type === "cloud") {
          return <polygon key={mark.id} points={points} fill={mark.type === "cloud" ? "none" : "rgba(37,99,235,0.12)"} stroke={selected ? "#ea580c" : mark.type === "cloud" ? "#dc2626" : "#2563eb"} strokeWidth={selected ? ".7" : ".4"} strokeDasharray={mark.type === "cloud" ? "1.2 0.8" : undefined} vectorEffect="non-scaling-stroke" />;
        }
        return (
          <g key={mark.id}>
            <polyline points={points} fill="none" stroke={selected ? "#ea580c" : mark.tool === "circuit" ? "#7c3aed" : mark.type === "homerun" ? "#0f766e" : "#2563eb"} strokeWidth={selected ? ".7" : ".45"} vectorEffect="non-scaling-stroke" />
            {mark.tool === "conduit" && end && (
              <text x={end.x} y={Math.max(2, end.y - 1.6)} fontSize="2.1" fontWeight="700" fill={selected ? "#ea580c" : "#1d4ed8"}>
                {`R${mark.runNumber || ""} ${mark.storedFeet != null ? `${Number(mark.storedFeet).toFixed(1)} LF` : ""}`}
              </text>
            )}
          </g>
        );
      })}
      {draftPoints.length > 1 && <polyline points={draftPoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#f97316" strokeWidth=".45" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />}
      {draftEnd && draftFeet != null && (
        <text x={draftEnd.x} y={Math.max(2, draftEnd.y - 1.8)} fontSize="2.3" fontWeight="700" fill="#ea580c">{formatFeet(draftFeet)}</text>
      )}
      {marks.filter((m) => m.type === "count" || m.type === "drop").map((mark, index) => (
        <g key={mark.id}>
          <circle cx={mark.x} cy={mark.y} r="1.5" fill={mark.id === selectedId ? "#ea580c" : "#2563eb"} stroke="white" strokeWidth=".3" vectorEffect="non-scaling-stroke" />
          <text x={mark.x} y={mark.y + .45} textAnchor="middle" fontSize="1.2" fontWeight="700" fill="white">{mark.abbr || index + 1}</text>
        </g>
      ))}
      {marks.filter((m) => m.type === "note").map((mark) => (
        <text key={mark.id} x={mark.x} y={mark.y} fontSize="1.8" fontWeight="700" fill={mark.id === selectedId ? "#ea580c" : "#dc2626"}>{mark.text}</text>
      ))}
      {tool === "scale" && <text x="2" y="6" fontSize="2.2" fontWeight="700" fill="#b45309">Click a known dimension</text>}
    </svg>
  );
}

function PdfDrawing({ fileBytes, fileName, zoom, pageNumber, onPageNumber, viewportWidth, viewportHeight, onPageInfo }) {
  const canvasRef = useRef(null);
  const pdfRef = useRef(null);
  const bytesRef = useRef(null);
  const onPageInfoRef = useRef(onPageInfo);
  const onPageNumberRef = useRef(onPageNumber);
  onPageInfoRef.current = onPageInfo;
  onPageNumberRef.current = onPageNumber;
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(true);
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
      setRendering(true);
      setError("");
      try {
        if (!pdfRef.current) {
          pdfRef.current = await getPdfDocument(fileBytes);
        }
        const pdf = pdfRef.current;
        if (cancelled) return;
        const safePage = Math.min(Math.max(pageNumber || 1, 1), pdf.numPages);
        if (safePage !== pageNumber) {
          onPageNumberRef.current?.(safePage);
          return;
        }
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
        if (!cancelled) onPageInfoRef.current?.({ page: safePage, pageCount: pdf.numPages });
      } catch (err) {
        if (!cancelled && err?.name !== "RenderingCancelledException") {
          console.error("PDF render failed", err);
          setError(err?.message || "Unable to render this PDF.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    renderPdf();
    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch { /* ignore */ }
    };
  }, [fileBytes, pageNumber, zoom, viewportWidth, viewportHeight]);

  return (
    <div className="relative bg-white" style={displaySize.width ? { width: displaySize.width, height: displaySize.height } : undefined}>
      {rendering && <div className="absolute inset-x-0 top-2 z-10 mx-auto w-fit rounded-lg bg-background/90 px-3 py-2 text-xs font-semibold shadow">Rendering {fileName}…</div>}
      {error && <div className="absolute inset-x-4 top-16 z-10 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      <canvas ref={canvasRef} className="block bg-white" />
    </div>
  );
}
