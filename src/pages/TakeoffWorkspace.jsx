import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cable, Cloud, FileUp, Hand, Image as ImageIcon, MousePointer2,
  Pencil, Redo2, Route, Ruler, Spline, Square, StickyNote,
  Trash2, Undo2, Upload, X, ZoomIn, ZoomOut, Crosshair, Gauge, Lightbulb, Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  DEFAULT_DROP_FEET, DRAWING_CATEGORY, TAKEOFF_TOOLS, TOOL_GROUPS,
  toolByKey,
} from "@/domain/takeoff/catalog";
import {
  calibrationFromPoints, feetFromPercent, formatArea, formatFeet,
  hitTestMark, polylineLength, sheetAspect, widthPercentDistance,
} from "@/domain/takeoff/geometry";
import { conduitRuns, nextConduitRunNumber, quantitiesToCsv, rollupTakeoff, applyScheduleEdits, markLengthFeet } from "@/domain/takeoff/quantities";
import { drawingSymbolsFromDocs, readDrawingDocuments } from "@/domain/takeoff/drawing-docs";
import { paletteForTrade, tradeById, conduitOptionsForTrade, findConduitOption, TRADES, DEFAULT_CONDUIT_ID } from "@/domain/takeoff/trades";
import { buildAiMarks } from "@/domain/takeoff/aiTakeoff";
import { readAiPages } from "@/domain/takeoff/aiPages";
import SheetThumbnailPanel, { readThumbsOpen, writeThumbsOpen } from "@/components/takeoff/SheetThumbnailPanel";
import DevicePicker from "@/components/takeoff/DevicePicker";
import TakeoffInspector from "@/components/takeoff/TakeoffInspector";
import TakeoffSizeControl from "@/components/takeoff/TakeoffSizeControl";
import AccuracyPopout from "@/components/takeoff/AccuracyPopout";
import {
  devicesForAccuracyReview,
  neighborReviewId,
  needsAccuracyReview,
  reviewSummary,
} from "@/domain/takeoff/accuracyReview";
import { getPdfDocument } from "@/lib/pdf-document";
import { syncStoredEstimate } from "@/domain/estimate/estimateStore";
import { putDrawingFile } from "@/domain/estimate/projectDocuments";
import {
  DEFAULT_LINE_SIZE,
  DEFAULT_MARKER_SIZE,
  normalizeSavedLineSize,
  normalizeSavedMarkerSize,
  resolvedLineSize,
  resolvedMarkerSize,
} from "@/domain/takeoff/sizes";
import { OVERLAY_FONT_SIZE, layoutOverlayCallouts } from "@/domain/takeoff/overlayLayout";
import {
  CIRCUIT_COLOR,
  DEVICE_FILL_OPACITY,
  applyDeviceTypeColors,
  deviceOutline,
  hitTestDeviceFill,
  isCircuitMark,
  isDeviceMark,
  selectMarkAtPoint,
  shortenCircuitPath,
} from "@/domain/takeoff/deviceStyles";

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
  const [trade, setTrade] = useState("electrical");
  const [conduitId, setConduitId] = useState(DEFAULT_CONDUIT_ID);
  const [penColor, setPenColor] = useState("#2563eb");
  const [penThickness, setPenThickness] = useState(DEFAULT_LINE_SIZE);
  const [penSize, setPenSize] = useState(DEFAULT_MARKER_SIZE);
  const [maxHomeruns, setMaxHomeruns] = useState(3);
  const [scheduleEdits, setScheduleEdits] = useState({});
  const [aiBusy, setAiBusy] = useState(false);
  const [tool, setTool] = useState("count");
  const [category, setCategory] = useState("Receptacles");
  const [symbolId, setSymbolId] = useState("duplex");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;
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
  const [reviewOpen, setReviewOpen] = useState(false);

  const isPdf = file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");
  const drawingSymbols = useMemo(() => drawingSymbolsFromDocs(drawingDocs), [drawingDocs]);
  const palette = useMemo(() => paletteForTrade(trade, drawingSymbols), [trade, drawingSymbols]);
  const categories = palette.categories;
  const symbols = useMemo(
    () => (category === DRAWING_CATEGORY ? palette.fromDrawing : palette.symbols.filter((item) => item.category === category)),
    [category, palette],
  );
  const conduitChoices = useMemo(() => conduitOptionsForTrade(trade), [trade]);
  const conduitChoice = findConduitOption(conduitId, trade);
  const symbol = palette.symbols.find((item) => item.id === symbolId)
    || palette.fromDrawing.find((item) => item.id === symbolId)
    || palette.symbols[0];

  useEffect(() => {
    if (categories.length && !categories.includes(category)) setCategory(categories[0]);
  }, [trade, categories, category]);

  useEffect(() => {
    if (conduitChoices.length && !conduitChoices.some((item) => item.id === conduitId)) {
      setConduitId(conduitChoices[0].id);
    }
  }, [trade, conduitChoices, conduitId]);

  useEffect(() => {
    if (mode !== "ai" && mode !== "hybrid") return undefined;
    if (!fileBytes || !isPdf) return undefined;
    const timer = setTimeout(() => { void runAiTakeoff(); }, 0);
    return () => clearTimeout(timer);
  }, [mode, trade, maxHomeruns, fileBytes]);
  const activeTool = toolByKey(tool);
  const sheetMarks = useMemo(
    () => marks.filter((mark) => (mark.sheet || 1) === (sheetMeta.page || 1)),
    [marks, sheetMeta.page],
  );
  const sheetReview = useMemo(
    () => devicesForAccuracyReview(sheetMarks, sheetMeta.page),
    [sheetMarks, sheetMeta.page],
  );
  const accuracyTotals = useMemo(() => reviewSummary(sheetMarks, sheetMeta.page), [sheetMarks, sheetMeta.page]);
  const selectedMark = marks.find((mark) => mark.id === selectedId) || null;
  const reviewIndex = Math.max(0, sheetReview.findIndex((mark) => mark.id === selectedId));
  const aspect = viewerRef.current
    ? sheetAspect(viewerRef.current.clientWidth, viewerRef.current.clientHeight)
    : 1;
  const rollup = useMemo(
    () => rollupTakeoff(marks, calibration, aspect),
    [marks, calibration, aspect],
  );
  const editedRollup = useMemo(() => applyScheduleEdits(rollup, scheduleEdits), [rollup, scheduleEdits]);
  const runs = useMemo(
    () => conduitRuns(marks, calibration, aspect, penThickness),
    [marks, calibration, aspect, penThickness],
  );

  useEffect(() => {
    if (!file) return;
    try {
      syncStoredEstimate({
        fileName: file.name,
        fileSize: file.size,
        drawingDocs,
        rollup: editedRollup,
        pageCount: sheetMeta.pageCount,
      });
    } catch {
      /* estimate copy failed; takeoff sheet is unchanged */
    }
  }, [file, drawingDocs, editedRollup, sheetMeta.pageCount]);
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
    void putDrawingFile(nextFile);
    setFile(nextFile);
    setLoadingDrawing(true);
    setDrawingError("");
    setStatus(`Importing ${nextFile.name}…`);
    setDraftPoints([]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
    if (saved?.trade) setTrade(saved.trade);
    if (saved?.conduitId) setConduitId(saved.conduitId);
    if (saved?.maxHomeruns) setMaxHomeruns(saved.maxHomeruns);
    if (saved?.penColor) setPenColor(saved.penColor);
    if (saved?.penThickness) setPenThickness(normalizeSavedLineSize(saved.penThickness));
    if (saved?.penSize) setPenSize(normalizeSavedMarkerSize(saved.penSize));
    if (saved?.scheduleEdits) setScheduleEdits(saved.scheduleEdits);
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
      trade,
      conduitId,
      maxHomeruns,
      penColor,
      penThickness,
      penSize,
      scheduleEdits,
      sheet: sheetMeta.page,
      pageCount: sheetMeta.pageCount,
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
    setPan({ x: 0, y: 0 });
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
    setPan({ x: 0, y: 0 });
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

  function sizedMark(mark) {
    return {
      ...mark,
      markerSize: resolvedMarkerSize(mark, penSize),
      thickness: resolvedLineSize(mark, penThickness),
    };
  }

  function markHitThreshold(mark, base = 2.2) {
    const sized = sizedMark(mark);
    if (sized.points?.length) return Math.max(base, sized.thickness);
    return Math.max(base, sized.markerSize);
  }

  function addMark(partial, message) {
    const isConduit = (partial.tool || tool) === "conduit";
    const device = isConduit ? null : symbol;
    const mark = {
      id: crypto.randomUUID(),
      sheet: sheetMeta.page || 1,
      trade,
      source: "manual",
      color: penColor,
      category: isConduit ? "Raceway" : (device?.takeoffCategory || device?.category || category),
      symbol: isConduit ? conduitChoice.id : device?.id,
      symbolLabel: isConduit ? conduitChoice.label : device?.label,
      abbr: isConduit ? conduitChoice.size : device?.abbr,
      conduitSize: isConduit ? conduitChoice.size : undefined,
      conduitMaterial: isConduit ? conduitChoice.material : undefined,
      ...partial,
    };
    if (isDeviceMark(mark)) {
      mark.typeCode = mark.typeCode || device?.abbr || mark.abbr;
      const colored = applyDeviceTypeColors([...marks.filter((item) => item.sheet === mark.sheet), mark]);
      const next = colored.find((item) => item.id === mark.id) || mark;
      mark.color = next.color;
      mark.layer = "device";
      mark.fillOpacity = DEVICE_FILL_OPACITY;
    } else if (isCircuitMark(mark)) {
      mark.color = CIRCUIT_COLOR;
      mark.layer = "circuit";
    }
    commitMarks([...marks, mark], message);
    return mark;
  }

  function updateMark(id, patch) {
    setMarks((current) => current.map((mark) => (mark.id === id ? { ...mark, ...patch } : mark)));
  }

  function openAccuracyReview() {
    const pending = sheetReview.find(needsAccuracyReview) || sheetReview[0];
    if (!pending) {
      setStatus("No device counts on this sheet to review.");
      return;
    }
    setTool("select");
    setSelectedId(pending.id);
    setReviewOpen(true);
    setStatus(`Accuracy review ${accuracyTotals.pending} pending · ${accuracyTotals.accepted} accepted · ${accuracyTotals.rejected} rejected.`);
  }

  function stepAccuracyReview(direction) {
    const nextId = neighborReviewId(sheetMarks, selectedId, direction, sheetMeta.page);
    if (!nextId) return;
    setSelectedId(nextId);
    setReviewOpen(true);
  }

  function setReviewStatus(status) {
    if (!selectedId) return;
    updateMark(selectedId, { reviewStatus: status });
    setStatus(status === "accepted" ? "Count accepted against the original PDF." : "Count rejected. The marker stays on the sheet.");
    const remaining = sheetReview.filter((mark) => mark.id !== selectedId && needsAccuracyReview(mark));
    if (remaining[0]) {
      setSelectedId(remaining[0].id);
      setReviewOpen(true);
    }
  }

  function editScheduleRow(row, patch) {
    const key = `${row.category}|${row.symbol}`;
    setScheduleEdits((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function renameScheduleRow(row, patch) {
    const nextSymbol = patch.symbol || row.symbol;
    const nextCategory = patch.category || row.category;
    if (nextSymbol === row.symbol && nextCategory === row.category) return;
    setMarks((current) => current.map((mark) => {
      const label = mark.symbolLabel || mark.symbol || "";
      if ((mark.category || "") !== row.category || label !== row.symbol) return mark;
      return { ...mark, symbolLabel: nextSymbol, category: nextCategory };
    }));
    setScheduleEdits((current) => {
      const key = `${row.category}|${row.symbol}`;
      const nextKey = `${nextCategory}|${nextSymbol}`;
      const prev = current[key] || {};
      const next = { ...current };
      delete next[key];
      if (prev.count != null || prev.lf != null || prev.sf != null) {
        next[nextKey] = { count: prev.count, lf: prev.lf, sf: prev.sf };
      }
      return next;
    });
  }

  async function runAiTakeoff() {
    if (!isPdf || !fileBytes) {
      setStatus("AI takeoff needs a PDF with a text layer. Image drawings stay manual for the selected trade.");
      return;
    }
    setAiBusy(true);
    const tradeLabel = tradeById(trade).label;
    setStatus(`AI is taking off ${tradeLabel} only…`);
    try {
      const pages = await readAiPages(fileBytes);
      const planned = buildAiMarks({
        pages,
        trade,
        symbols: palette.symbols,
        drawingSymbols: palette.fromDrawing,
        maxHomeruns,
        conduit: conduitChoice,
        color: penColor,
      });
      setMarks((current) => [
        ...current.filter((mark) => !(mark.source === "ai" && mark.trade === trade)),
        ...planned.marks,
      ]);
      setStatus(planned.summary);
    } catch (error) {
      setStatus(error?.message || "AI takeoff could not read this drawing.");
    } finally {
      setAiBusy(false);
    }
  }

  function onDrawingClick(event) {
    if (!file || tool === "pan") return;
    const point = drawingPoint(event);
    if (!point) return;
    const sheetAspectRatio = currentAspect();

    if (tool === "select") {
      const hit = selectMarkAtPoint(sheetMarks, point, {
        aspect: sheetAspectRatio,
        markerSize: penSize,
        hitRoute: (mark, at, aspect) => hitTestMark(sizedMark(mark), at, aspect, markHitThreshold(mark)),
      });
      setSelectedId(hit?.id || null);
      setReviewOpen(Boolean(hit && isDeviceMark(hit)));
      setStatus(hit ? `Selected ${hit.symbolLabel || hit.typeCode || hit.type}.` : "Nothing selected.");
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

  function onPanPointerDown(event) {
    if (tool !== "pan" || event.button > 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const originX = event.clientX;
    const originY = event.clientY;
    const startX = panRef.current.x;
    const startY = panRef.current.y;
    const target = event.currentTarget;
    target.setPointerCapture(pointerId);
    const move = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      setPan({
        x: startX + (moveEvent.clientX - originX),
        y: startY + (moveEvent.clientY - originY),
      });
    };
    const up = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  function onViewerPointerDown(event) {
    if (tool === "pan" || (tool !== "select" || !selectedId)) return;
    const point = drawingPoint(event);
    if (tool === "select" && selectedId) {
      const mark = marks.find((item) => item.id === selectedId);
      if (!mark) return;
      const canDrag = isDeviceMark(mark)
        ? hitTestDeviceFill(mark, point, penSize)
        : hitTestMark(sizedMark(mark), point, currentAspect(), markHitThreshold(mark, 3.2));
      if (!canDrag) return;
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
    }
  }

  async function copyQuantities() {
    const csv = quantitiesToCsv(editedRollup, runs);
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
          <Link to={file ? `/estimates/new?file=${encodeURIComponent(file.name)}&size=${file.size}` : "/estimates/new"} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted">Estimate</Link>
          <button type="button" onClick={downloadTakeoff} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted">Export JSON</button>
          <button type="button" onClick={openDrawingPicker} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted">Replace</button>
          <button type="button" onClick={closeDrawing} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><X className="h-4 w-4" /> Close</button>
        </div>
      </div>
      {drawingError && <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{drawingError}</div>}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
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
          <div className="border-t border-border pt-3 space-y-2">
            <label className="block text-xs font-bold text-muted-foreground">Trade
              <select value={trade} onChange={(event) => setTrade(event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm font-semibold text-foreground">
                {TRADES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold text-muted-foreground">Conduit size
              <select value={conduitChoice.id} onChange={(event) => setConduitId(event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm font-semibold text-foreground">
                {conduitChoices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-muted-foreground">Color
              <input type="color" value={penColor} onChange={(event) => setPenColor(event.target.value)} className="mt-1 h-8 w-full" />
            </label>
            <TakeoffSizeControl
              markerSize={penSize}
              lineSize={penThickness}
              onMarkerSize={setPenSize}
              onLineSize={setPenThickness}
            />
            <label className="block text-xs font-bold text-muted-foreground">Homeruns per conduit
              <input type="number" min="1" max="12" value={maxHomeruns} onChange={(event) => setMaxHomeruns(Math.max(1, Number(event.target.value) || 1))} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm" />
            </label>
            <p className="text-[11px] leading-4 text-muted-foreground">Default is 3. AI will not put more homeruns in one conduit unless you raise this.</p>
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
            {(mode === "ai" || mode === "hybrid") && (
              <div className="mt-2 text-foreground">{aiBusy ? `Taking off ${tradeById(trade).label}…` : `AI takeoff runs for ${tradeById(trade).label} only. Other trades stay out until you select them.`}</div>
            )}
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
            <div className="flex flex-wrap items-center gap-1">
              <div className="lg:hidden">
                <TakeoffSizeControl
                  compact
                  markerSize={penSize}
                  lineSize={penThickness}
                  onMarkerSize={setPenSize}
                  onLineSize={setPenThickness}
                />
              </div>
              <button type="button" onClick={undo} className="rounded-lg p-2 hover:bg-muted" title="Undo"><Undo2 className="h-4 w-4" /></button>
              <button type="button" onClick={redo} className="rounded-lg p-2 hover:bg-muted" title="Redo"><Redo2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))} className="rounded-lg p-2 hover:bg-muted" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
              <span className="min-w-12 text-center text-xs font-semibold">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))} className="rounded-lg p-2 hover:bg-muted" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted">Fit sheet</button>
              {sheetMeta.pageCount > 1 && (
                <div className="ml-2 flex items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-0.5">
                  <button type="button" disabled={sheetMeta.page <= 1} onClick={() => selectSheet(sheetMeta.page - 1)} className="rounded border border-border px-2 py-1 text-xs font-semibold disabled:opacity-40">Previous</button>
                  <strong className="min-w-24 px-1 text-center text-xs">Sheet {sheetMeta.page} of {sheetMeta.pageCount}</strong>
                  <button type="button" disabled={sheetMeta.page >= sheetMeta.pageCount} onClick={() => selectSheet(sheetMeta.page + 1)} className="rounded border border-border px-2 py-1 text-xs font-semibold disabled:opacity-40">Next</button>
                </div>
              )}
              {selectedId && <button type="button" onClick={deleteSelected} className="rounded-lg px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">Delete</button>}
              <button type="button" onClick={openAccuracyReview} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted">
                Review{accuracyTotals.pending ? ` ${accuracyTotals.pending}` : ""}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={clearAll} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" />Clear</button>
            </div>
          </div>
          <div
            ref={viewportRef}
            onPointerDown={onPanPointerDown}
            className={cn("min-h-0 min-w-0 flex-1 overflow-hidden bg-neutral-400/40 dark:bg-neutral-950", tool === "pan" && "cursor-grab touch-none")}
          >
            <div className="flex h-full w-full items-center justify-center p-2">
              <div
                ref={viewerRef}
                onClick={onDrawingClick}
                onDoubleClick={finishPath}
                onPointerDown={onViewerPointerDown}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
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
                  markerSize={penSize}
                  lineSize={penThickness}
                  lengthFor={(mark) => markLengthFeet(mark, calibration, aspect)}
                />
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">{status}</div>
          </div>
        </section>

        <TakeoffInspector
          rollup={rollup}
          totals={editedRollup.totals}
          runs={runs}
          drawingDocs={drawingDocs}
          selected={selectedMark}
          conduitOptions={conduitChoices}
          scheduleEdits={scheduleEdits}
          onSelectRun={(id) => { setSelectedId(id); setTool("select"); }}
          onUpdateMark={updateMark}
          onEditRow={editScheduleRow}
          onRenameRow={renameScheduleRow}
          onSelectSheet={selectSheet}
          onCopy={copyQuantities}
          globalMarkerSize={penSize}
          globalLineSize={penThickness}
        />
      </div>
      <AccuracyPopout
        open={reviewOpen && Boolean(selectedMark && isDeviceMark(selectedMark))}
        onOpenChange={setReviewOpen}
        mark={selectedMark && isDeviceMark(selectedMark) ? selectedMark : null}
        fileBytes={isPdf ? fileBytes : null}
        index={reviewIndex}
        total={sheetReview.length}
        onAccept={() => setReviewStatus("accepted")}
        onReject={() => setReviewStatus("rejected")}
        onPrev={() => stepAccuracyReview(-1)}
        onNext={() => stepAccuracyReview(1)}
      />
    </div>
  );
}

function offsetPolyline(points, offset) {
  return (points || []).map((point, index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: point.x - (dy / len) * offset, y: point.y + (dx / len) * offset };
  });
}

function conduitPolylines(mark) {
  const runs = Math.max(1, Math.min(8, Number(mark.parallelRuns) || 1));
  if (runs === 1) return [mark.points];
  const spread = 0.28;
  return Array.from({ length: runs }, (_, index) => {
    const offset = (index - (runs - 1) / 2) * spread;
    return offset ? offsetPolyline(mark.points, offset) : mark.points;
  });
}

function OverlayLabel({ label, fill }) {
  return (
    <text
      x={label.x}
      y={label.y}
      fontSize={OVERLAY_FONT_SIZE}
      fontWeight="600"
      fill={fill}
      stroke="#ffffff"
      strokeWidth="0.22"
      paintOrder="stroke"
    >
      {label.text}
    </text>
  );
}

function DeviceFill({ mark, selected, markerSize }) {
  const outline = deviceOutline(mark, markerSize, { selected });
  const color = mark.color || "#1e3a8a";
  const opacity = mark.fillOpacity ?? DEVICE_FILL_OPACITY;
  const stroke = selected ? "#ea580c" : color;
  const strokeWidth = selected ? 0.28 : 0.12;
  if (outline.kind === "path" && outline.points?.length >= 3) {
    return (
      <polygon
        points={outline.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={color}
        fillOpacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (outline.kind === "circle") {
    return (
      <circle
        cx={mark.x}
        cy={mark.y}
        r={outline.r}
        fill={color}
        fillOpacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  return (
    <rect
      x={mark.x - outline.w / 2}
      y={mark.y - outline.h / 2}
      width={outline.w}
      height={outline.h}
      rx={0.12}
      fill={color}
      fillOpacity={opacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function MarkupOverlay({ marks, draftPoints, draftFeet, selectedId, tool, lengthFor, markerSize = DEFAULT_MARKER_SIZE, lineSize = DEFAULT_LINE_SIZE }) {
  const otherRoutes = marks.filter((m) => m.points?.length && !isCircuitMark(m));
  const devices = marks.filter((m) => isDeviceMark(m));
  const circuits = marks.filter((m) => isCircuitMark(m) && m.points?.length);
  const callouts = layoutOverlayCallouts({
    conduits: circuits.filter((m) => m.tool === "conduit"),
    devices,
    selectedId,
    lengthTextFor: (mark) => {
      const feet = lengthFor?.(mark);
      return feet == null ? "" : formatFeet(feet);
    },
  });
  const draftEnd = draftPoints[draftPoints.length - 1];
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {otherRoutes.map((mark) => {
        const points = mark.points.map((p) => `${p.x},${p.y}`).join(" ");
        const selected = mark.id === selectedId;
        const color = mark.color || (mark.type === "cloud" ? "#dc2626" : "#2563eb");
        const width = resolvedLineSize(mark, lineSize);
        if (mark.type === "area" || mark.type === "cloud") {
          return <polygon key={mark.id} points={points} fill={mark.type === "cloud" ? "none" : "rgba(37,99,235,0.12)"} stroke={color} strokeWidth={width} strokeDasharray={mark.type === "cloud" ? "1.2 0.8" : undefined} vectorEffect="non-scaling-stroke" />;
        }
        return (
          <g key={mark.id}>
            {selected && <polyline points={points} fill="none" stroke="#ffffff" strokeWidth={width + 1.4} vectorEffect="non-scaling-stroke" />}
            <polyline points={points} fill="none" stroke={color} strokeWidth={width} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
      {circuits.map((mark) => {
        const selected = mark.id === selectedId;
        const color = CIRCUIT_COLOR;
        const width = resolvedLineSize(mark, lineSize);
        const path = mark.tool === "conduit" ? conduitPolylines({ ...mark, points: shortenCircuitPath(mark.points) }) : [shortenCircuitPath(mark.points)];
        const dash = mark.tool === "circuit" || mark.type === "homerun" ? "0.9 0.65" : undefined;
        return (
          <g key={mark.id}>
            {selected && path.map((line, index) => (
              <polyline key={`${mark.id}-sel-${index}`} points={line.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#ffffff" strokeWidth={width + 1.2} vectorEffect="non-scaling-stroke" />
            ))}
            {path.map((line, index) => (
              <polyline
                key={`${mark.id}-run-${index}`}
                points={line.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeDasharray={dash}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}
      {draftPoints.length > 1 && <polyline points={draftPoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#f97316" strokeWidth=".45" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />}
      {draftEnd && draftFeet != null && (
        <text x={draftEnd.x} y={Math.max(2, draftEnd.y - 1.2)} fontSize={OVERLAY_FONT_SIZE} fontWeight="600" fill="#ea580c" stroke="#ffffff" strokeWidth="0.22" paintOrder="stroke">{formatFeet(draftFeet)}</text>
      )}
      {devices.map((mark) => (
        <DeviceFill key={mark.id} mark={mark} selected={mark.id === selectedId} markerSize={resolvedMarkerSize(mark, markerSize)} />
      ))}
      {callouts.conduitLabels.map((label) => (
        <OverlayLabel key={`conduit-${label.id}`} label={label} fill={label.selected ? "#334155" : "#475569"} />
      ))}
      {callouts.deviceLabels.map((label) => (
        <OverlayLabel key={`device-${label.id}`} label={label} fill={devices.find((mark) => mark.id === label.id)?.color || "#1e3a8a"} />
      ))}
      {marks.filter((m) => m.type === "note").map((mark) => (
        <text key={mark.id} x={mark.x} y={mark.y} fontSize={OVERLAY_FONT_SIZE} fontWeight="600" fill={mark.color || (mark.id === selectedId ? "#ea580c" : "#dc2626")}>{mark.text}</text>
      ))}
      {tool === "scale" && <text x="2" y="6" fontSize={OVERLAY_FONT_SIZE} fontWeight="600" fill="#b45309">Click a known dimension</text>}
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
