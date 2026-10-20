import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Cable, Cloud, FileUp, Hand, MousePointer2,
  Pencil, Route, Ruler, Spline, Square, StickyNote,
  Upload, Crosshair, Gauge, Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  DEFAULT_DROP_FEET, TAKEOFF_TOOLS,
  toolByKey,
} from "@/domain/takeoff/catalog";
import {
  calibrationFromPoints, feetFromPercent, formatArea, formatFeet,
  hitTestMark, polylineLength, previewOrthogonalSegment, sheetAspect,
  snapOrthogonalPoint, widthPercentDistance,
} from "@/domain/takeoff/geometry";
import { conduitRuns, nextConduitRunNumber, quantitiesToCsv, rollupTakeoff, applyScheduleEdits, markLengthFeet } from "@/domain/takeoff/quantities";
import { overlayBidMarks } from "@/domain/takeoff/liveLinkedTakeoff";
import {
  attachJunctionToConduit,
  createJunctionBoxMark,
  junctionHardwareTotals,
} from "@/domain/takeoff/junctionHardware";
import { drawingSymbolsFromDocs, printedScaleCalibration, readDrawingDocuments } from "@/domain/takeoff/drawing-docs";
import { paletteForTrade, pageKindsFromDocs, symbolsOnDrawingForTrade, tradeById, conduitOptionsForTrade, findConduitOption, TRADES, DEFAULT_CONDUIT_ID } from "@/domain/takeoff/trades";
import { buildAiMarks, legendDictionaryFromPages, pagesToScan } from "@/domain/takeoff/aiTakeoff";
import TakeoffActionsMenu, { takeoffEstimatePath, takeoffMarkupPath } from "@/components/takeoff/TakeoffActionsMenu";
import { TakeoffMobileCommandBar, TakeoffMobileDock, TakeoffMobileSheet } from "@/components/takeoff/TakeoffMobileChrome";
import { persistableAiPages, readAiPages } from "@/domain/takeoff/aiPages";
import { drawingProcessingPlan } from "@/domain/takeoff/drawingUpload";
import { hydratePagesRaster, pagesNeedingRaster } from "@/domain/takeoff/rasterSymbols";
import { isScannedOrSparsePage } from "@/domain/takeoff/takeoffQuality";
import { pickInteractiveSymbolGeometry, matchGeometryToLegend, attachLegendGeometryPrototypes } from "@/domain/takeoff/legendGeometry";
import { shouldShowSymbolHover } from "@/domain/takeoff/legendHover";
import { filterMarksByInspect, hoverBoundToLegend } from "@/domain/takeoff/professionalReview";
import { buildDrawingObjectLayer, enclosingRoom, hitDrawingObject, materializeDrawingObject, printedHighlightGeometry, printedSelectionId } from "@/domain/takeoff/drawingObjectLayer";
import ProfessionalToolsPanel from "@/components/takeoff/ProfessionalToolsPanel";
import {
  COLLAB_CHANNEL_PREFIX,
  QUANTITY_LINK_CHANNEL,
  aerialLengthMark,
  applyRemoteMark,
  createSigningKey,
  cropToObject,
  markFromAssembly,
  measureMark,
  quantityWorkbookRows,
  rememberLiveQuantity,
  reportLines,
  revisionReport,
  signQuantity,
  spreadsheetMl,
} from "@/domain/takeoff/professionalTools";
import { recognizeImage } from "@/domain/takeoff/ocrText";
import { jsPDF } from "jspdf";
import {
  addSlipSheet,
  addToolChestItem,
  countInteractiveObjects,
  interactiveOpenMessage,
  isPageTakeoffEnabled,
  mergeStudioPackage,
  normalizePageTakeoff,
  pagesIncludedInTakeoff,
  quantityLinkChecksum,
  quantityLinkCsv,
  setPageTakeoff as setPageTakeoffEnabled,
  studioPackage,
  visualSearchCounts,
} from "@/domain/takeoff/interactiveSheet";
import SheetThumbnailPanel, { readThumbsOpen, writeThumbsOpen } from "@/components/takeoff/SheetThumbnailPanel";
import { TakeoffCommandBar, TakeoffSelectionBar, TakeoffToolRail } from "@/components/takeoff/TakeoffStudio";
import DevicePicker from "@/components/takeoff/DevicePicker";
import TakeoffInspector from "@/components/takeoff/TakeoffInspector";
import TakeoffSizeControl from "@/components/takeoff/TakeoffSizeControl";
import AccuracyPopout from "@/components/takeoff/AccuracyPopout";
import AiSearchManifestPanel from "@/components/takeoff/AiSearchManifestPanel";
import {
  applyReviewDecision,
  isUncertainDetection,
  needsAccuracyReview,
  reviewQueue,
  reviewSummary,
  typeInstanceCount,
} from "@/domain/takeoff/accuracyReview";
import {
  changeReviewDeviceType,
  createManualDeviceMark,
  moveReviewMark,
  projectPrototypesFromCorrections,
  resizeReviewBounds,
} from "@/domain/takeoff/reviewActions";
import {
  describeSheetCoverage,
  mergeReviewQueue,
  neighborQueueId,
  pagesCoverage,
  planSheetCoverage,
} from "@/domain/takeoff/sheetCoverage";
import { getPdfDocument } from "@/lib/pdf-document";
import { pdfBackingScale } from "@/domain/takeoff/pdfBackingScale";
import { readEstimate, syncStoredEstimate, writeEstimate } from "@/domain/estimate/estimateStore";
import { downloadBlob, getDrawingFile, putDrawingFile } from "@/domain/estimate/projectDocuments";
import {
  DRAWING_INPUT_ID,
  captureFileList,
  clearPendingDrawing,
  snapshotDrawingFile,
  subscribeDrawingUpload,
  validateDrawingFile,
} from "@/domain/takeoff/drawingUpload";
import {
  analyzeElectricalTakeoff,
  buildTrueElectricalEstimateDraft,
  trueTakeoffCsv,
} from "@/domain/estimate/trueElectricalTakeoff";
import {
  buildSupplyQuote,
  buildSupplyQuotePdf,
  catalogForQuote,
  supplyQuoteExcelFileName,
  supplyQuoteToExcel,
} from "@/domain/takeoff/supplyQuote";
import {
  DEFAULT_LINE_SIZE,
  DEFAULT_MARKER_SIZE,
  normalizeSavedLineSize,
  normalizeSavedMarkerSize,
  resolvedLineSize,
  resolvedMarkerSize,
} from "@/domain/takeoff/sizes";
import { MOBILE_OVERLAY_FONT_SIZE, OVERLAY_FONT_SIZE, layoutOverlayCallouts } from "@/domain/takeoff/overlayLayout";
import {
  CIRCUIT_COLOR,
  DEVICE_CHIP_R,
  DEVICE_FILL_OPACITY,
  DEVICE_FILL_STROKE_PX,
  MIN_VISIBLE_FILL,
  applyDeviceTypeColors,
  displayDeviceOutline,
  interiorDeviceOutline,
  deviceFillEnabled,
  hitTestDeviceFill,
  isCircuitMark,
  isDeviceMark,
  marksForTrade,
  planOverlayMarks,
  readableFillColor,
  selectMarkAtPoint,
  sheetTypeColorSwatches,
  shortenCircuitPath,
} from "@/domain/takeoff/deviceStyles";
import {
  buildConduitCircuitSchedulePdf,
  buildConduitWireMakeupPdf,
  buildMarkedDrawingPdf,
} from "@/domain/takeoff/markedDrawingPdf";
import { conduitCircuitScheduleCsv } from "@/domain/takeoff/markupPages";
import { conduitWireMakeupCsv } from "@/domain/takeoff/conduitWireMakeup";
import { reconcilePlanToSchedule } from "@/domain/takeoff/countReconciliation";
import {
  TAKEOFF_MAX_ZOOM,
  TAKEOFF_MIN_ZOOM,
  pinchMidpoint,
  pointerDistance,
  sheetPinchViewport,
  sheetZoomAboutPoint,
} from "@/lib/sheetViewport";

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

let applyIncomingDrawing = null;

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

const ACTIVE_DRAWING_KEY = "estim8r.activeDrawing.v1";

function loadSession(file) {
  try {
    const raw = localStorage.getItem(storageKey(file));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeRestoredMarks(savedMarks = []) {
  return applyDeviceTypeColors((savedMarks || []).map((mark) => {
    if (mark?.source !== "ai" || !isDeviceMark(mark)) return mark;
    return {
      ...mark,
      markerSize: mark.markerSize || 1.35,
      markerSizeOverride: mark.markerSizeOverride ?? true,
      fillOpacity: mark.fillOpacity ?? DEVICE_FILL_OPACITY,
    };
  }));
}

function restoredSessionSheet(saved, fallbackPage) {
  const marks = Array.isArray(saved?.marks) ? saved.marks : [];
  const requested = Number(saved?.sheet || fallbackPage);
  if (requested && marks.some((mark) => (mark.sheet || 1) === requested && (isDeviceMark(mark) || isCircuitMark(mark)))) {
    return requested;
  }
  return marks.find((mark) => isDeviceMark(mark) || isCircuitMark(mark))?.sheet || requested || 1;
}


function rememberActiveDrawing(file, page = 1) {
  try {
    if (!file) return;
    localStorage.setItem(ACTIVE_DRAWING_KEY, JSON.stringify({ name: file.name, size: file.size, type: file.type || "", page, savedAt: new Date().toISOString() }));
  } catch { /* best effort */ }
}
function readActiveDrawing() {
  try { const raw = localStorage.getItem(ACTIVE_DRAWING_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export default function TakeoffWorkspace() {
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
  const [drawingObjects, setDrawingObjects] = useState([]);
  const [tool, setTool] = useState("select");
  const [pageTakeoff, setPageTakeoff] = useState({});
  const [slipSheets, setSlipSheets] = useState([]);
  const [comparePage, setComparePage] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [pendingAssembly, setPendingAssembly] = useState(null);
  const [revisionBaseline, setRevisionBaseline] = useState([]);
  const collabSender = useRef("");
  const applyingRemote = useRef(false);
  const sessionJoinRef = useRef("");
  if (!collabSender.current) collabSender.current = globalThis.crypto?.randomUUID?.() || `tab-${Date.now()}`;
  const [batchQueue, setBatchQueue] = useState([]);
  const [toolChest, setToolChest] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("estim8r-tool-chest") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const spacePanRef = useRef(false);
  const [category, setCategory] = useState("Receptacles");
  const [symbolId, setSymbolId] = useState("duplex");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const panLayerRef = useRef(null);
  const panningRef = useRef(false);
  const pinchActiveRef = useRef(false);
  const suppressEditClickRef = useRef(false);
  zoomRef.current = zoom;
  panRef.current = pan;
  const draftJunctionIdsRef = useRef([]);
  const [marks, setMarks] = useState([]);
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const [draftPoints, setDraftPoints] = useState([]);
  const [status, setStatus] = useState("Upload a drawing to begin.");
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [sheetMeta, setSheetMeta] = useState({ page: 1, pageCount: 1 });
  const [calibrations, setCalibrations] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [isolationMode, setIsolationMode] = useState(false);
  const [measureLabel, setMeasureLabel] = useState("");
  const [thumbsOpen, setThumbsOpen] = useState(() => (
    typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches
      ? false
      : readThumbsOpen()
  ));
  const [savedAt, setSavedAt] = useState("");
  const [symbolQuery, setSymbolQuery] = useState("");
  const [drawingDocs, setDrawingDocs] = useState(null);
  const [hoverPoint, setHoverPoint] = useState(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState(null);
  const [pointerSheet, setPointerSheet] = useState(null);
  const [hoveredGeometryInfo, setHoveredGeometryInfo] = useState(null);
  const [inspectType, setInspectType] = useState("");
  const [wideLayout, setWideLayout] = useState(() => (
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  ));
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState("");
  const [studioPanel, setStudioPanel] = useState("quantities");
  const [aiPages, setAiPages] = useState([]);
  const [searchManifest, setSearchManifest] = useState(null);
  const [emptyNoticeDismissed, setEmptyNoticeDismissed] = useState(false);
  const [confirmedCoverageIds, setConfirmedCoverageIds] = useState([]);
  const [confirmedEmptySheets, setConfirmedEmptySheets] = useState({});
  const [supplyQuote, setSupplyQuote] = useState(null);
  const [trueTakeoffResult, setTrueTakeoffResult] = useState(null);
  const [conduitContextMenu, setConduitContextMenu] = useState(null);
  const calibration = calibrations[sheetMeta.page] || null;
  const setCalibration = (next) => {
    setCalibrations((current) => ({
      ...current,
      [sheetMeta.page]: typeof next === "function" ? next(current[sheetMeta.page] || null) : next,
    }));
  };

  const isPdf = file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");
  const drawingSymbols = useMemo(() => drawingSymbolsFromDocs(drawingDocs), [drawingDocs]);
  const legendDictionary = useMemo(() => {
    const base = legendDictionaryFromPages(
      aiPages,
      drawingSymbols,
      paletteForTrade(trade, drawingSymbols).symbols,
      trade,
    );
    return attachLegendGeometryPrototypes(base, aiPages);
  }, [drawingSymbols, aiPages, trade]);
  const palette = useMemo(() => paletteForTrade(trade, drawingSymbols), [trade, drawingSymbols]);
  const pageKinds = useMemo(() => pageKindsFromDocs(drawingDocs), [drawingDocs]);
  const drawingTypes = useMemo(
    () => symbolsOnDrawingForTrade(trade, marks, { pageKinds }),
    [trade, marks, pageKinds],
  );
  const availableDeviceSymbols = useMemo(() => {
    const merged = new Map();
    for (const item of [...(palette.symbols || []), ...(palette.fromDrawing || []), ...drawingTypes]) {
      if (!item?.id || (item.trade && item.trade !== trade)) continue;
      merged.set(item.id, item);
    }
    return [...merged.values()];
  }, [palette.symbols, palette.fromDrawing, drawingTypes, trade]);
  const categories = useMemo(
    () => [...new Set(availableDeviceSymbols.map((item) => item.takeoffCategory || item.category).filter(Boolean))],
    [availableDeviceSymbols],
  );
  const symbols = useMemo(
    () => availableDeviceSymbols.filter((item) => {
      if (!categories.includes(category)) return true;
      return (item.takeoffCategory || item.category) === category;
    }),
    [availableDeviceSymbols, category, categories],
  );
  const conduitChoices = useMemo(() => conduitOptionsForTrade(trade), [trade]);
  const conduitChoice = findConduitOption(conduitId, trade);
  const symbol = symbols.find((item) => item.id === symbolId) || symbols[0];

  useEffect(() => {
    // Empty category is the explicit "All on drawing" selection, not an invalid category.\n    if (category && categories.length && !categories.includes(category)) setCategory("");
  }, [trade, categories, category]);

  useEffect(() => {
    if (conduitChoices.length && !conduitChoices.some((item) => item.id === conduitId)) {
      setConduitId(conduitChoices[0].id);
    }
  }, [trade, conduitChoices, conduitId]);

  useEffect(() => {
    setSelectedId(null);
    setIsolationMode(false);
  }, [trade]);


  const activeTool = toolByKey(tool);
  const tradeMarks = useMemo(() => marksForTrade(marks, trade), [marks, trade]);
  const sheetMarks = useMemo(
    () => tradeMarks.filter((mark) => (mark.sheet || 1) === (sheetMeta.page || 1)),
    [tradeMarks, sheetMeta.page],
  );
  const overlayMarks = useMemo(() => planOverlayMarks(sheetMarks, { interactive: true }), [sheetMarks]);
  const visibleOverlayMarks = useMemo(() => {
    const isolated = isolationMode && selectedId ? overlayMarks.filter((mark) => mark.id === selectedId) : overlayMarks;
    return filterMarksByInspect(isolated, { type: inspectType });
  }, [overlayMarks, isolationMode, selectedId, inspectType]);
  const typeSwatches = useMemo(() => sheetTypeColorSwatches(overlayMarks), [overlayMarks]);
  const coverageOptions = useMemo(() => ({
    pageKinds,
    trade,
    confirmedRegionIds: confirmedCoverageIds,
    confirmedEmptySheets,
  }), [pageKinds, trade, confirmedCoverageIds, confirmedEmptySheets]);
  const coverage = useMemo(
    () => pagesCoverage(aiPages, marks, coverageOptions),
    [aiPages, marks, coverageOptions],
  );
  const sheetCoverage = useMemo(() => {
    const fromPages = coverage.sheets.find((sheet) => sheet.sheet === sheetMeta.page);
    if (fromPages) return fromPages;
    const page = aiPages.find((item) => item.page === sheetMeta.page);
    return page ? planSheetCoverage(page, marks, coverageOptions) : null;
  }, [coverage, aiPages, marks, sheetMeta.page, coverageOptions]);
  const sheetReview = useMemo(
    () => mergeReviewQueue(reviewQueue(tradeMarks, sheetMeta.page), coverage, sheetMeta.page),
    [tradeMarks, sheetMeta.page, coverage],
  );
  const accuracyTotals = useMemo(() => {
    const base = reviewSummary(tradeMarks, sheetMeta.page);
    const unscannedPending = (coverage.unscannedRegions || []).filter((region) => region.sheet === sheetMeta.page).length;
    return {
      ...base,
      pending: base.pending + unscannedPending,
      unscannedPending,
    };
  }, [tradeMarks, sheetMeta.page, coverage]);
  const reconciliation = useMemo(() => reconcilePlanToSchedule({
    marks: tradeMarks,
    scheduleItems: drawingSymbols,
    pages: aiPages,
    pageKinds,
    trade,
  }), [tradeMarks, drawingSymbols, aiPages, pageKinds, trade]);
  const reviewSymbols = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const item of [...(palette.symbols || []), ...drawingTypes]) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }, [palette.symbols, drawingTypes]);
  const selectedMark = marks.find((mark) => mark.id === selectedId) || null;
  const printedSelection = drawingObjects.find((item) => printedSelectionId(item) === selectedId) || null;
  const hoveredPrinted = String(hoveredDeviceId || "").startsWith("object:")
    ? drawingObjects.find((item) => `object:${item.objectId || item.id}` === hoveredDeviceId) || null
    : null;
  const selectedReviewItem = selectedMark
    || sheetReview.find((item) => item.id === selectedId)
    || null;
  const reviewIndex = Math.max(0, sheetReview.findIndex((mark) => mark.id === selectedId));
  const aspect = viewerRef.current
    ? sheetAspect(viewerRef.current.clientWidth, viewerRef.current.clientHeight)
    : 1;
  const rollup = useMemo(
    () => rollupTakeoff(tradeMarks, calibrations, aspect),
    [tradeMarks, calibrations, aspect],
  );
  const editedRollup = useMemo(() => applyScheduleEdits(rollup, scheduleEdits), [rollup, scheduleEdits]);
  const bidMarks = useMemo(() => overlayBidMarks(marks, pageKinds), [marks, pageKinds]);
  const bidRollup = useMemo(
    () => applyScheduleEdits(rollupTakeoff(bidMarks, calibrations, aspect), scheduleEdits),
    [bidMarks, calibrations, aspect, scheduleEdits],
  );
  const runs = useMemo(
    () => conduitRuns(bidMarks, calibrations, aspect, penThickness),
    [bidMarks, calibrations, aspect, penThickness],
  );
  const trueAnalysis = useMemo(
    () => analyzeElectricalTakeoff({ drawingDocs, rollup: bidRollup, runs, marks: bidMarks }),
    [drawingDocs, bidRollup, runs, bidMarks],
  );

  useEffect(() => {
    if (!file) return;
    try {
      const existing = readEstimate(file.name, file.size);
      if (existing?.trueTakeoff) {
        const draft = buildTrueElectricalEstimateDraft(existing, {
          fileName: file.name,
          fileSize: file.size,
          drawingDocs,
          rollup: bidRollup,
          runs,
          marks: bidMarks,
          pageKinds,
          settings: existing.trueTakeoff.settings,
        });
        writeEstimate(draft);
        setTrueTakeoffResult(draft.trueTakeoff);
      } else {
        syncStoredEstimate({
          fileName: file.name,
          fileSize: file.size,
          drawingDocs,
          rollup: bidRollup,
          pageCount: sheetMeta.pageCount,
          marks: bidMarks,
          runs,
          pageKinds,
        });
      }
    } catch {
      /* estimate copy failed; takeoff sheet is unchanged */
    }
  }, [file, drawingDocs, bidRollup, bidMarks, pageKinds, runs, sheetMeta.pageCount]);
  const draftPreview = tool === "conduit"
    ? previewOrthogonalSegment(draftPoints, hoverPoint)
    : (hoverPoint && draftPoints.length ? [...draftPoints, hoverPoint] : draftPoints);
  const draftFeet = feetFromPercent(polylineLength(draftPreview, aspect), calibration);
  const hardwareTotals = useMemo(() => junctionHardwareTotals(tradeMarks), [tradeMarks]);
  const imageDisplay = fitSheetSize(
    imageSize.width,
    imageSize.height,
    viewportSize.width,
    viewportSize.height,
    zoom,
  );

  useEffect(() => {
    if (!symbols.some((item) => item.id === symbolId)) {
      setSymbolId(symbols[0]?.id || "");
    }
  }, [category, symbolId, symbols]);

  async function chooseFile(nextFile, preparedBytes) {
    if (!nextFile) {
      setDrawingError("No drawing selected.");
      setStatus("Drawing import failed.");
      return;
    }
    const typeError = validateDrawingFile(nextFile);
    if (typeError) {
      setDrawingError(typeError);
      setStatus("Drawing import failed.");
      return;
    }

    setFile(nextFile);
    setLoadingDrawing(true);
    setDrawingError("");
    setStatus(`Importing ${nextFile.name || "drawing"}…`);
    setDraftPoints([]);
    setTool("select");
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setImageSize({ width: 0, height: 0 });
    setSheetMeta({ page: 1, pageCount: 1 });
    setSelectedId(null);
    setDrawingObjects([]);
    setMeasureLabel("");
    setAiPages([]);

    const saved = loadSession(nextFile);
    const restoredMarks = normalizeRestoredMarks(Array.isArray(saved?.marks) ? saved.marks : []);
    setMarks(restoredMarks);
    historyRef.current = { past: [], future: [] };
    setConfirmedCoverageIds(Array.isArray(saved?.confirmedCoverageIds) ? saved.confirmedCoverageIds : []);
    setConfirmedEmptySheets(saved?.confirmedEmptySheets && typeof saved.confirmedEmptySheets === "object" ? saved.confirmedEmptySheets : {});
    setCalibrations(saved?.calibrations || (saved?.calibration ? { [saved?.sheet || 1]: saved.calibration } : {}));
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
    if (saved?.pageTakeoff) setPageTakeoff(saved.pageTakeoff);
    if (Array.isArray(saved?.slipSheets)) setSlipSheets(saved.slipSheets);
    if (saved?.sheet || restoredMarks.length) setSheetMeta((current) => ({ ...current, page: restoredSessionSheet(saved, current.page) }));
    setSupplyQuote(saved?.supplyQuote || null);
    if (restoredMarks.length) {
      setStatus(`Restored ${restoredMarks.length} saved takeoff object${restoredMarks.length === 1 ? "" : "s"} for ${nextFile.name || "drawing"}.`);
    }

    try {
      let file = nextFile;
      let bytes = preparedBytes;
      if (!bytes?.byteLength) {
        const snap = await snapshotDrawingFile(nextFile);
        file = snap.file;
        bytes = snap.bytes;
        setFile(file);
      }
      try {
        await putDrawingFile(file);
      } catch (storageError) {
        console.error("Drawing store failed", storageError);
        setDrawingError(storageError?.message || "The drawing opened, but Estim8r could not store it on this device.");
      }
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
      const url = URL.createObjectURL(file);
      fileUrlRef.current = url;
      setFileUrl(url);
      setFileBytes(bytes);
      const opened = interactiveOpenMessage(file.name, {}, { image: !String(file.type || file.name || "").toLowerCase().includes("pdf") && !String(file.name || "").toLowerCase().endsWith(".pdf") });
      setStatus(restoredMarks.length
        ? `${opened} Restored ${restoredMarks.length} saved takeoff object${restoredMarks.length === 1 ? "" : "s"}.`
        : opened);
    } catch (error) {
      console.error("Drawing import failed", error);
      clearPendingDrawing();
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
  applyIncomingDrawing = chooseFile;

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      if (file) return;
      const active = readActiveDrawing();
      if (!active?.name || !active?.size) return;
      try {
        const stored = await getDrawingFile(active.name, active.size);
        if (!cancelled && stored) {
          await chooseFile(stored);
          if (active.page) {
            const saved = loadSession(stored);
            setSheetMeta((current) => ({ ...current, page: restoredSessionSheet(saved, active.page) }));
          }
          setStatus(`${stored.name} restored after update.`);
        }
      } catch (error) {
        if (!cancelled) console.error("Could not restore active drawing", error);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (file) rememberActiveDrawing(file, sheetMeta.page);
  }, [file, sheetMeta.page]);

  useEffect(() => {
    try {
      localStorage.setItem("estim8r-tool-chest", JSON.stringify(toolChest));
    } catch {
      /* private mode can reject storage */
    }
  }, [toolChest]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const channel = new BroadcastChannel(`${COLLAB_CHANNEL_PREFIX}${sessionId}`);
    channel.onmessage = (event) => {
      const data = event?.data;
      if (!data || data.sender === collabSender.current || data.kind !== "estim8r-collab") return;
      if (data.op === "request") {
        if (marksRef.current.length) {
          channel.postMessage({ kind: "estim8r-collab", op: "replace", marks: marksRef.current, sender: collabSender.current });
        }
        return;
      }
      applyingRemote.current = true;
      setMarks((current) => applyRemoteMark(current, data));
    };
    channel.postMessage({ kind: "estim8r-collab", op: "request", sender: collabSender.current });
    return () => channel.close();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return undefined;
    }
    const joining = sessionJoinRef.current !== sessionId;
    sessionJoinRef.current = sessionId;
    if (joining && marks.length === 0) return undefined;
    const channel = new BroadcastChannel(`${COLLAB_CHANNEL_PREFIX}${sessionId}`);
    channel.postMessage({ kind: "estim8r-collab", op: "replace", marks, sender: collabSender.current });
    channel.close();
    return undefined;
  }, [marks, sessionId]);

  useEffect(() => {
    const preserveForUpdate = () => {
      if (!file) return;
      saveTakeoff(true);
      rememberActiveDrawing(file, sheetMeta.page);
    };
    window.addEventListener("estim8r-before-update", preserveForUpdate);
    return () => window.removeEventListener("estim8r-before-update", preserveForUpdate);
  }, [file, marks, calibrations, scheduleEdits, sheetMeta.page, supplyQuote, trade, category, symbolId, conduitId, maxHomeruns, penColor, penThickness, penSize, confirmedCoverageIds, confirmedEmptySheets, pageTakeoff, slipSheets]);

  useEffect(() => {
    const resetErrors = () => setDrawingError("");
    window.addEventListener("estim8r-reset-errors", resetErrors);
    return () => window.removeEventListener("estim8r-reset-errors", resetErrors);
  }, []);

  useEffect(() => {
    return subscribeDrawingUpload((payload) => {
      if (payload.error) {
        setDrawingError(payload.error);
        setStatus("Drawing import failed.");
        return;
      }
      if (Array.isArray(payload.queue) && payload.queue.length) setBatchQueue(payload.queue);
      if (payload.file) void applyIncomingDrawing?.(payload.file, payload.bytes);
    });
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
      calibrations,
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
      pageTakeoff,
      slipSheets,
      supplyQuote,
      confirmedCoverageIds,
      confirmedEmptySheets,
    };
  }

  function saveTakeoff(silent = false) {
    if (!file) return;
    const quote = persistSupplyQuote();
    const payload = { ...sessionPayload(), supplyQuote: quote };
    try {
      localStorage.setItem(storageKey(file), JSON.stringify(payload));
      setSavedAt(payload.savedAt);
      if (!silent) setStatus(`Takeoff saved${file.name ? ` for ${file.name}` : ""}.`);
    } catch {
      setStatus("Could not save takeoff in this browser.");
    }
  }

  async function downloadMarkedDeviceDrawings() {
    if (!fileBytes || !file) return;
    setStatus("Building counted-device drawing set…");
    try {
      const { doc, fileName } = await buildMarkedDrawingPdf({
        fileBytes,
        fileName: file.name,
        marks,
        mode: "devices",
      });
      downloadBlob(doc.output("blob"), fileName);
      setStatus(`Downloaded ${fileName}.`);
    } catch (error) {
      setStatus(error?.message || "Could not build the counted-device drawing set.");
    }
  }

  async function downloadConduitRouteDrawings() {
    if (!fileBytes || !file) return;
    setStatus("Building conduit-route drawing set…");
    try {
      const { doc, fileName } = await buildMarkedDrawingPdf({
        fileBytes,
        fileName: file.name,
        marks,
        mode: "routes",
      });
      downloadBlob(doc.output("blob"), fileName);
      setStatus(`Downloaded ${fileName}.`);
    } catch (error) {
      setStatus(error?.message || "Could not build the conduit-route drawing set.");
    }
  }

  function downloadConduitCircuitSchedule() {
    if (!file) return;
    const { doc, fileName, schedule } = buildConduitCircuitSchedulePdf({ marks, fileName: file.name });
    downloadBlob(doc.output("blob"), fileName);
    setStatus(schedule.length
      ? `Downloaded ${fileName} with ${schedule.length} conduit run${schedule.length === 1 ? "" : "s"}.`
      : "Conduit schedule created, but no conduit runs are assigned yet.");
  }

  function downloadConduitCircuitCsv() {
    if (!file) return;
    const csv = conduitCircuitScheduleCsv(marks);
    const stem = (file.name || "electrical-takeoff").replace(/\.[^.]+$/, "");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${stem}-conduit-circuit-schedule.csv`);
    setStatus("Conduit / circuit schedule CSV downloaded.");
  }

  function downloadWireMakeupPdf() {
    if (!file) return;
    const { doc, fileName, rows } = buildConduitWireMakeupPdf({
      marks,
      runs,
      longCircuitRule: trueAnalysis?.longCircuitRule,
      fileName: file.name,
    });
    downloadBlob(doc.output("blob"), fileName);
    const reviewCount = rows.filter((row) => row.status !== "ready").length;
    setStatus(reviewCount
      ? `Downloaded ${fileName}; ${reviewCount} conduit run${reviewCount === 1 ? "" : "s"} still need wire-makeup review.`
      : `Downloaded ${fileName}; all conduit wire-makeup rows are ready.`);
  }

  function downloadWireMakeupCsv() {
    if (!file) return;
    const rows = trueAnalysis?.conduitWireMakeup || [];
    const csv = conduitWireMakeupCsv(rows);
    const stem = (file.name || "electrical-takeoff").replace(/\.[^.]+$/, "");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${stem}-conduit-wire-makeup.csv`);
    setStatus("Conduit wire makeup CSV downloaded.");
  }

  function makeSupplyQuote(nextMarks = marks) {
    return buildSupplyQuote({
      marks: nextMarks,
      drawingSymbols,
      catalog: catalogForQuote(),
      pageKinds: pageKindsFromDocs(drawingDocs),
      fileName: file?.name,
      projectName: file?.name,
    });
  }

  function persistSupplyQuote(nextMarks = marks) {
    const quote = makeSupplyQuote(nextMarks);
    setSupplyQuote(quote);
    return quote;
  }

  function downloadQuoteExcel() {
    const quote = persistSupplyQuote();
    downloadBlob(
      new Blob([supplyQuoteToExcel(quote)], { type: "application/vnd.ms-excel" }),
      supplyQuoteExcelFileName(quote),
    );
    setStatus(quote.rows.length
      ? `Downloaded ${supplyQuoteExcelFileName(quote)} for the supply house.`
      : "No takeoff devices to quote yet.");
  }

  function downloadQuotePdf() {
    const quote = persistSupplyQuote();
    const { doc, fileName } = buildSupplyQuotePdf(quote);
    downloadBlob(doc.output("blob"), fileName);
    setStatus(quote.rows.length
      ? `Downloaded ${fileName} for the supply house.`
      : "No takeoff devices to quote yet.");
  }

  useEffect(() => {
    if (!file) return;
    try {
      localStorage.setItem(storageKey(file), JSON.stringify({ ...sessionPayload(), savedAt: savedAt || undefined }));
    } catch {
      /* private mode */
    }
  }, [file, marks, calibrations, symbolId, category, sheetMeta.page]);

  useEffect(() => {
    if (!isPdf || !fileBytes) {
      setDrawingDocs(null);
      return undefined;
    }
    let cancelled = false;
    readDrawingDocuments(fileBytes).then((docs) => {
      if (cancelled) return;
      setDrawingDocs(docs);
      setCalibrations((current) => {
        const next = { ...current };
        for (const page of docs.pages || []) {
          if (next[page.page]?.feet) continue;
          const auto = printedScaleCalibration(page);
          if (auto) next[page.page] = auto;
        }
        return next;
      });
      const found = (docs.symbols?.length || 0) + (docs.scheduleItems?.length || 0);
      if (found) {
        setStatus(`Read ${docs.symbols.length} legend symbols and ${docs.scheduleItems.length} schedule / spec types for matching. Device list uses types found on the plan.`);
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

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !file) return undefined;

    const pointers = new Map();
    let pinch = null;
    let raf = 0;

    function clientPoints(list) {
      return [...list].map((item) => ({ x: item.clientX ?? item.x, y: item.clientY ?? item.y }));
    }

    function flushViewport() {
      raf = 0;
      setZoom(zoomRef.current);
      setPan(panRef.current);
    }

    function applyPinch(points) {
      if (points.length < 2) return;
      const viewportRect = el.getBoundingClientRect();
      const currentMid = pinchMidpoint(points[0], points[1]);
      const currentDistance = pointerDistance(points[0], points[1]);
      if (!pinch) {
        pinch = {
          startZoom: zoomRef.current,
          startDistance: currentDistance || 1,
          startPan: { ...panRef.current },
          startMid: currentMid,
        };
        pinchActiveRef.current = true;
        panningRef.current = false;
        return;
      }
      const next = sheetPinchViewport({
        startZoom: pinch.startZoom,
        startDistance: pinch.startDistance,
        startPan: pinch.startPan,
        startMid: pinch.startMid,
        currentDistance,
        currentMid,
        viewportRect,
      });
      zoomRef.current = next.zoom;
      panRef.current = next.pan;
      if (panLayerRef.current) {
        panLayerRef.current.style.transform = `translate(${next.pan.x}px, ${next.pan.y}px)`;
      }
      if (!raf) raf = window.requestAnimationFrame(flushViewport);
    }

    function endPinch() {
      pinch = null;
      pinchActiveRef.current = false;
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
      setZoom(zoomRef.current);
      setPan(panRef.current);
    }

    function onTouchStart(event) {
      if (event.touches.length >= 2) {
        event.preventDefault();
        pinch = null;
        applyPinch(clientPoints(event.touches));
      }
    }

    function onTouchMove(event) {
      if (event.touches.length >= 2) {
        event.preventDefault();
        applyPinch(clientPoints(event.touches));
      }
    }

    function onTouchEnd(event) {
      if (event.touches.length >= 2) {
        event.preventDefault();
        pinch = null;
        applyPinch(clientPoints(event.touches));
        return;
      }
      if (pinch) endPinch();
    }

    function onPointerDown(event) {
      if (event.pointerType === "mouse") return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        event.preventDefault();
        pinch = null;
        applyPinch([...pointers.values()]);
      }
    }

    function onPointerMove(event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        event.preventDefault();
        applyPinch([...pointers.values()]);
      }
    }

    function onPointerUp(event) {
      pointers.delete(event.pointerId);
      if (pointers.size < 2 && pinch) endPinch();
    }

    function preventNativeGesture(event) {
      event.preventDefault();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });
    el.addEventListener("pointerdown", onPointerDown, { passive: false });
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("gesturestart", preventNativeGesture, { passive: false });
    el.addEventListener("gesturechange", preventNativeGesture, { passive: false });
    el.addEventListener("gestureend", preventNativeGesture, { passive: false });
    document.addEventListener("gesturestart", preventNativeGesture, { passive: false });
    document.addEventListener("gesturechange", preventNativeGesture, { passive: false });
    document.addEventListener("gestureend", preventNativeGesture, { passive: false });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      pinchActiveRef.current = false;
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("gesturestart", preventNativeGesture);
      el.removeEventListener("gesturechange", preventNativeGesture);
      el.removeEventListener("gestureend", preventNativeGesture);
      document.removeEventListener("gesturestart", preventNativeGesture);
      document.removeEventListener("gesturechange", preventNativeGesture);
      document.removeEventListener("gestureend", preventNativeGesture);
    };
  }, [file]);


  function focusMarkedSheet(nextMarks) {
    const first = (nextMarks || []).find((mark) => isDeviceMark(mark) || isCircuitMark(mark));
    if (first?.sheet && first.sheet !== sheetMeta.page) {
      selectSheet(first.sheet);
    }
    setIsolationMode(false);
    setSelectedId(first?.id || null);
  }

  async function buildAndSaveTrueElectricalEstimate({ download = false } = {}) {
    if (!file) return null;
    setMode("hybrid");
    let workingMarks = marks;
    if (!workingMarks.some(isDeviceMark) && isPdf && fileBytes) {
      setStatus("True Takeoff is running AI markup on the drawings so you can verify counts…");
      workingMarks = await runAiTakeoff({ silent: true }) || marks;
    }
    focusMarkedSheet(workingMarks);
    const existing = readEstimate(file.name, file.size);
    const nextBid = overlayBidMarks(workingMarks, pageKinds);
    const draft = buildTrueElectricalEstimateDraft(existing, {
      fileName: file.name,
      fileSize: file.size,
      drawingDocs,
      rollup: applyScheduleEdits(rollupTakeoff(nextBid, calibrations, aspect), scheduleEdits),
      runs: conduitRuns(nextBid, calibrations, aspect, penThickness),
      marks: nextBid,
      pageKinds,
    });
    writeEstimate(draft);
    setTrueTakeoffResult(draft.trueTakeoff);
    saveTakeoff(true);
    if (download) {
      const csv = trueTakeoffCsv(
        draft.trueTakeoff.analysis,
        draft.lines,
        draft.trueTakeoff.summary,
      );
      downloadBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `${(file.name || "electrical-takeoff").replace(/\.[^.]+$/, "")}-true-electrical-takeoff.csv`,
      );
    }
    const warningCount = draft.trueTakeoff.analysis.warnings.length;
    const devices = workingMarks.filter(isDeviceMark).length;
    const conduits = workingMarks.filter(isCircuitMark).length;
    setStatus(
      `True Takeoff marked ${devices} devices and ${conduits} conduit runs on the drawings, then built the electrical estimate: $${draft.trueTakeoff.summary.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      + (warningCount ? ` · ${warningCount} bid-lock warning${warningCount === 1 ? "" : "s"}` : " · bid-lock checks clear"),
    );
    return draft;
  }


  function commitMarks(next, message) {
    historyRef.current.past.push(marks);
    historyRef.current.future = [];
    if (historyRef.current.past.length > 80) historyRef.current.past.shift();
    setMarks(next);
    if (message) setStatus(message);
  }

  function closeDrawing() {
    if (marks.length && !window.confirm("Close this drawing? Takeoff marks stay on this browser for this file.")) return;
    clearPendingDrawing();
    try { localStorage.removeItem(ACTIVE_DRAWING_KEY); } catch { /* best effort */ }
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = "";
    setFile(null);
    setFileUrl("");
    setFileBytes(null);
    setMarks([]);
    setAiPages([]);
    setConfirmedCoverageIds([]);
    setConfirmedEmptySheets({});
    setSupplyQuote(null);
    setTrueTakeoffResult(null);
    setCalibrations({});
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
    const dropped = [...(event.dataTransfer?.files || [])].filter((item) => item && !validateDrawingFile(item));
    const droppedFile = dropped[0]
      || captureFileList(event.dataTransfer?.files)
      || [...(event.dataTransfer?.items || [])].find((item) => item.kind === "file")?.getAsFile();
    if (!droppedFile) {
      setDrawingError("No drawing selected.");
      setStatus("Drawing import failed.");
      return;
    }
    setBatchQueue(dropped.slice(1));
    void chooseFile(droppedFile);
  }

  function drawingPoint(event) {
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function commitSheetViewport(nextZoom, nextPan) {
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    if (panLayerRef.current) {
      panLayerRef.current.style.transform = `translate(${nextPan.x}px, ${nextPan.y}px)`;
    }
    setZoom(nextZoom);
    setPan(nextPan);
  }

  function handleDrawingWheel(event) {
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();

    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport?.width || !viewport?.height) return;

    // Normal mouse wheel / trackpad: wheel up zooms in, wheel down zooms out.
    // Keep the drawing point under the cursor in approximately the same screen
    // position by compensating pan as the centered drawing grows/shrinks.
    const direction = event.deltaY < 0 ? 1 : -1;
    const step = event.ctrlKey ? 0.1 : 0.15;
    const currentZoom = zoomRef.current;
    const nextZoom = Math.min(
      TAKEOFF_MAX_ZOOM,
      Math.max(TAKEOFF_MIN_ZOOM, Number((currentZoom + direction * step).toFixed(2))),
    );
    if (nextZoom === currentZoom) return;

    const next = sheetZoomAboutPoint({
      zoom: currentZoom,
      nextZoom,
      pan: panRef.current,
      focusClient: { x: event.clientX, y: event.clientY },
      viewportRect: viewport,
    });
    commitSheetViewport(next.zoom, next.pan);
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
      mark.color = mark.color || CIRCUIT_COLOR;
      mark.layer = "circuit";
    }
    commitMarks([...marks, mark], message);
    return mark;
  }

  function updateMark(id, patch) {
    const named = Boolean(patch.circuit || patch.circuitNumber || patch.roomName || patch.symbol);
    const nextPatch = named ? { ...patch, bidUse: true, prediction: false } : patch;
    if (nextPatch.roomName) nextPatch.symbolLabel = nextPatch.roomName;
    const next = marks.map((mark) => (mark.id === id ? { ...mark, ...nextPatch } : mark));
    commitMarks(next, "Selected takeoff object updated.");
  }

  function coverageAfterConfirm(region) {
    const nextIds = confirmedCoverageIds.includes(region.id)
      ? confirmedCoverageIds
      : [...confirmedCoverageIds, region.id];
    const nextEmpty = { ...confirmedEmptySheets };
    const page = aiPages.find((item) => item.page === region.sheet);
    const preview = page
      ? planSheetCoverage(page, marks, {
        pageKinds,
        trade,
        confirmedRegionIds: nextIds,
        confirmedEmptySheets: nextEmpty,
      })
      : null;
    if (preview?.unscannedCount === 0 && preview.deviceCount === 0) {
      nextEmpty[region.sheet] = true;
    }
    return { nextIds, nextEmpty };
  }

  function openAccuracyReview() {
    const pending = sheetReview.find((mark) => (
      mark.type === "coverage" || needsAccuracyReview(mark, marks, sheetMeta.page)
    )) || sheetReview[0];
    if (!pending) {
      setStatus("No device types or unscanned regions left to review on this sheet.");
      return;
    }
    setTool("select");
    setSelectedId(pending.id);
    setReviewOpen(true);
    setStatus(`Accuracy review ${accuracyTotals.typesPending} type(s) · ${accuracyTotals.uncertainPending} uncertain · ${accuracyTotals.unscannedPending} unscanned.`);
  }

  function stepAccuracyReview(direction) {
    const nextId = neighborQueueId(sheetReview, selectedId, direction);
    if (!nextId) return;
    setSelectedId(nextId);
    setReviewOpen(true);
  }

  function setReviewStatus(status) {
    const current = selectedReviewItem;
    if (!current) return;
    if (current.type === "coverage") {
      if (status === "accepted") {
        const { nextIds, nextEmpty } = coverageAfterConfirm(current);
        setConfirmedCoverageIds(nextIds);
        setConfirmedEmptySheets(nextEmpty);
        setStatus("Region marked scanned. An empty sheet is not complete until every region has been looked at.");
        const remaining = mergeReviewQueue(
          reviewQueue(marks, sheetMeta.page),
          pagesCoverage(aiPages, marks, {
            pageKinds,
            trade,
            confirmedRegionIds: nextIds,
            confirmedEmptySheets: nextEmpty,
          }),
          sheetMeta.page,
        );
        if (remaining[0]) {
          setSelectedId(remaining[0].id);
          setReviewOpen(true);
        }
      } else {
        setStatus("Region left unresolved. The sheet stays incomplete.");
      }
      return;
    }
    if (!isDeviceMark(current)) return;
    const instanceOnly = isUncertainDetection(current);
    const count = instanceOnly ? 1 : typeInstanceCount(marks, current);
    commitMarks(applyReviewDecision(marks, current, status), "Device review decision updated.");
    setStatus(instanceOnly
      ? (status === "accepted" ? "Uncertain count accepted." : "Uncertain count rejected. The marker stays on the sheet.")
      : (status === "accepted"
        ? `Type ${current.typeCode || current.abbr || ""} accepted for ${count} counts.`
        : `Type ${current.typeCode || current.abbr || ""} rejected for ${count} counts. Markers stay on the sheet.`));
    const remaining = mergeReviewQueue(
      reviewQueue(applyReviewDecision(marks, current, status), sheetMeta.page),
      coverage,
      sheetMeta.page,
    );
    if (remaining[0]) {
      setSelectedId(remaining[0].id);
      setReviewOpen(true);
    }
  }

  function changeReviewType(nextSymbol) {
    if (!selectedMark || !nextSymbol) return;
    commitMarks(
      changeReviewDeviceType(marks, selectedMark, nextSymbol),
      `Changed to ${nextSymbol.abbr || nextSymbol.label}. This correction can seed a project prototype.`,
    );
  }

  function moveSelectedReview(point) {
    if (!selectedMark || !point) return;
    commitMarks(moveReviewMark(marks, selectedMark, point), "Device moved.");
  }

  function resizeSelectedReview(bounds) {
    if (!selectedMark) return;
    commitMarks(resizeReviewBounds(marks, selectedMark, bounds), "Device highlight resized.");
  }

  function addMissedDevice() {
    const x = Number(selectedReviewItem?.x) || 50;
    const y = Number(selectedReviewItem?.y) || 50;
    const next = createManualDeviceMark({
      sheet: sheetMeta.page,
      trade,
      symbol,
      x,
      y,
    });
    const colored = applyDeviceTypeColors([...marks, next]);
    commitMarks(colored, `Added missed ${next.typeCode || "device"} at ${x.toFixed(1)}, ${y.toFixed(1)}.`);
    if (selectedReviewItem?.type === "coverage") {
      const { nextIds, nextEmpty } = coverageAfterConfirm(selectedReviewItem);
      setConfirmedCoverageIds(nextIds);
      setConfirmedEmptySheets(nextEmpty);
    }
    setSelectedId(next.id);
    setReviewOpen(true);
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

  useEffect(() => {
    if (!fileBytes?.byteLength || !isPdf) {
      setDrawingObjects([]);
      return;
    }
    let cancelled = false;
    const objectize = async () => {
      try {
        const pages = await readAiPages(fileBytes, { includeRaster: false });
        if (cancelled) return;
        const persistable = persistableAiPages(pages);
        setAiPages(persistable);
        const layer = buildDrawingObjectLayer({ pages: persistable, detectedMarks: [], trade: "electrical" });
        setDrawingObjects(layer);
        const counts = countInteractiveObjects(layer);
        setStatus(interactiveOpenMessage(file?.name, counts));
        setPageTakeoff((current) => normalizePageTakeoff(current, pages.length || 1));
      } catch (error) {
        if (!cancelled) console.error("Drawing object layer failed", error);
      }
    };
    void objectize();
    return () => { cancelled = true; };
  }, [fileBytes, isPdf]);

  useEffect(() => {
    if (!isPdf || !aiPages.length) return;
    setDrawingObjects(buildDrawingObjectLayer({
      pages: aiPages,
      detectedMarks: marks.filter(isDeviceMark),
      trade,
    }));
  }, [aiPages, isPdf, marks, trade]);

  async function runAiTakeoff({ silent = false, onlyPage = null } = {}) {
    if (!isPdf || !fileBytes) {
      const message = "AI assist needs a PDF with a text layer. Image drawings stay manual for the selected trade.";
      if (!silent) {
        setDrawingError(message);
        setStatus(message);
      }
      return marks;
    }
    setAiBusy(true);
    setEmptyNoticeDismissed(false);
    setDrawingError("");
    const tradeLabel = tradeById(trade).label;
    if (!silent) setStatus(`AI assist is reading ${tradeLabel} sheets…`);
    try {
      const pages = await readAiPages(fileBytes, {
        includeRaster: false,
        onProgress: (current, total) => {
          if (!silent) setStatus(`AI assist is reading sheet ${current} of ${total}…`);
        },
      });
      const processing = drawingProcessingPlan({ type: "application/pdf", size: fileBytes.byteLength }, {
        byteLength: fileBytes.byteLength,
      });
      if (processing.scanned || processing.largePlan) {
        for (const page of pages) {
          if (isScannedOrSparsePage(page)) page.forceRaster = true;
        }
      }
      // Raster only the sparse electrical scan pages. Full-set raster at CAD
      // scale OOM'd / jetsam'd the tab while AI takeoff was running.
      const scanDictionary = legendDictionaryFromPages(pages, palette.fromDrawing, palette.symbols, trade);
      const pagesForTakeoff = pages.map((page) => {
        const enabled = onlyPage == null
          ? isPageTakeoffEnabled(pageTakeoff, page.page)
          : Number(page.page) === Number(onlyPage) || page.kind === "legend";
        return enabled ? page : { ...page, takeoffDisabled: true };
      });
      const scanPages = pagesIncludedInTakeoff(pagesToScan(pagesForTakeoff, trade, scanDictionary));
      await hydratePagesRaster(pagesNeedingRaster(scanPages));
      if (!silent) setStatus(`AI assist is marking ${tradeLabel} on the drawings…`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const persistable = persistableAiPages(pages);
      setAiPages(persistable);
      const planned = buildAiMarks({
        pages: pagesForTakeoff,
        trade,
        symbols: palette.symbols,
        drawingSymbols: palette.fromDrawing,
        maxHomeruns,
        conduit: conduitChoice,
        color: penColor,
        projectPrototypes: projectPrototypesFromCorrections(marks),
      });
      setSearchManifest(planned.searchManifest || null);
      // Distinguish a failed/empty scan from a genuine zero-symbol result.
      // This is especially important on mobile where the PDF may render while
      // text and vector extraction produce no usable symbol candidates.
      const scannedPages = pagesIncludedInTakeoff(pagesToScan(pagesForTakeoff, trade, scanDictionary));
      const scanDiagnostics = {
        totalPages: pages.length,
        scannedPages: scannedPages.length,
        textTokens: scannedPages.reduce((sum, page) => sum + (page.tokens?.length || 0), 0),
        vectorPaths: scannedPages.reduce((sum, page) => sum + (page.paths?.length || 0), 0),
        rasterCandidates: scannedPages.reduce((sum, page) => sum + (page.rasterPaths?.length || 0), 0),
        legendEntries: scanDictionary?.entries?.length || 0,
      };
      const colored = applyDeviceTypeColors(
        (planned.marks || []).map((mark) => ({
          ...mark,
          source: mark.source || "ai",
          trade: mark.trade || trade,
          sheet: mark.sheet || mark.page,
          markerSize: mark.markerSize || Math.max(penSize, 1.35),
          markerSizeOverride: mark.markerSizeOverride ?? true,
          reviewStatus: mark.reviewStatus || "pending",
        })),
      );
      let nextMarks = colored;
      setMarks((current) => {
        nextMarks = applyDeviceTypeColors([
          ...current.filter((mark) => !(mark.source === "ai" && mark.trade === trade && (onlyPage == null || Number(mark.sheet) === Number(onlyPage)))),
          ...colored,
        ]);
        return nextMarks;
      });
      setDrawingObjects(buildDrawingObjectLayer({
        pages: persistable,
        detectedMarks: nextMarks.filter(isDeviceMark),
        trade,
      }));
      if (onlyPage == null) focusMarkedSheet(nextMarks);
      const quote = persistSupplyQuote(nextMarks);
      const devices = nextMarks.filter(isDeviceMark).length;
      const conduits = nextMarks.filter((mark) => mark.tool === "conduit" || mark.type === "homerun").length;
      if (!silent) {
        if (planned.deviceCount === 0) {
          const d = scanDiagnostics;
          const reason = d.scannedPages === 0
            ? "No eligible plan sheets were recognized."
            : d.vectorPaths === 0 && d.rasterCandidates === 0
              ? "No usable symbol geometry was extracted."
              : d.legendEntries === 0
                ? "No usable legend entries were recognized."
                : "Symbol matching returned zero counted devices.";
          setStatus(`AI found 0 devices. ${reason} Diagnostic: ${d.scannedPages}/${d.totalPages} sheets scanned; ${d.textTokens} text tokens; ${d.vectorPaths} vector paths; ${d.rasterCandidates} raster candidates; ${d.legendEntries} legend entries. Please share this diagnostic when reporting the failure.`);
        } else {
        setStatus(
          `${planned.summary || `AI marked ${devices} devices and ${conduits} conduit runs.`} `
          + `${planned.searchManifest?.totalSymbols ? `Searched ${planned.searchManifest.totalSymbols} legend symbol targets across ${planned.searchManifest.sheetCount} applicable sheet${planned.searchManifest.sheetCount === 1 ? "" : "s"}. ` : ""}`
          + `${planned.reconciliationNote || ""} `
          + `Verify the colored marks on the sheet.`
          + (quote.rows.length ? ` Supply quote ready (${quote.totals.quantity} plan devices).` : ""),
        );
        }
      }
      return nextMarks;
    } catch (error) {
      const message = error?.message || "AI takeoff could not read this drawing.";
      if (!silent) {
        setDrawingError(message);
        setStatus(message);
      }
      return marks;
    } finally {
      setAiBusy(false);
    }
  }

  const runAiTakeoffRef = useRef(runAiTakeoff);
  runAiTakeoffRef.current = runAiTakeoff;
  useEffect(() => {
    const onRun = () => {
      setMode("ai");
      void runAiTakeoffRef.current();
    };
    window.addEventListener("estim8r-owner-run-ai-takeoff", onRun);
    return () => window.removeEventListener("estim8r-owner-run-ai-takeoff", onRun);
  }, []);

  function interactiveGeometryAt(point) {
    const page = aiPages.find((item) => item.page === sheetMeta.page);
    if (!page || !point) return null;
    const geometry = pickInteractiveSymbolGeometry(page, point, { radius: 1.35 });
    if (!geometry) return null;
    const match = matchGeometryToLegend(geometry, legendDictionary, {
      planType: page.planType || "",
      nearby: (page.paths || []).filter((path) => Math.hypot((path.cx || 0) - geometry.cx, (path.cy || 0) - geometry.cy) <= 0.8),
    });
    return { geometry, match };
  }

  function onDrawingClick(event) {
    if (conduitContextMenu) setConduitContextMenu(null);
    if (!file || tool === "pan") return;
    const point = drawingPoint(event);
    if (!point) return;
    if (pendingAssembly) {
      const placed = markFromAssembly(pendingAssembly, point, sheetMeta.page);
      if (placed) {
        commitMarks([...marks, placed], `${placed.symbolLabel} assembly placed. Its components stay on the estimate.`);
        setSelectedId(placed.id);
      }
      setPendingAssembly(null);
      return;
    }
    const sheetAspectRatio = currentAspect();

    if (tool === "select") {
      const hit = selectMarkAtPoint(overlayMarks, point, {
        aspect: sheetAspectRatio,
        markerSize: (mark) => resolvedMarkerSize(mark, penSize),
        hitRoute: (mark, at, aspect) => hitTestMark(sizedMark(mark), at, aspect, markHitThreshold(mark, 0.7)),
      });
      if (hit) {
        setSelectedId(hit.id);
        setReviewOpen(Boolean(isDeviceMark(hit) && needsAccuracyReview(hit, marks, sheetMeta.page)));
        setStatus(`Selected ${hit.symbolLabel || hit.typeCode || hit.type}.`);
        return;
      }
      const drawingObject = hitDrawingObject(drawingObjects, point, sheetMeta.page);
      if (drawingObject) {
        if (drawingObject.objectKind === "recognized-device" && drawingObject.sourceMarkId) {
          const sourceMark = overlayMarks.find((mark) => mark.id === drawingObject.sourceMarkId)
            || marks.find((mark) => mark.id === drawingObject.sourceMarkId);
          setSelectedId(drawingObject.sourceMarkId);
          setIsolationMode(false);
          setReviewOpen(Boolean(sourceMark && isDeviceMark(sourceMark) && needsAccuracyReview(sourceMark, marks, sheetMeta.page)));
          setStatus(`Selected ${sourceMark?.symbolLabel || sourceMark?.typeCode || "detected device"}.`);
          return;
        }
        const name = drawingObject.objectKind === "room" ? "room" : drawingObject.objectKind === "circuit" ? "line" : "symbol";
        setSelectedId(printedSelectionId(drawingObject));
        setIsolationMode(false);
        setReviewOpen(false);
        setStatus(`Highlighted the printed ${name} under the pointer. Nothing was added.`);
        return;
      }
      setSelectedId(null);
      setIsolationMode(false);
      setReviewOpen(false);
      setStatus("Nothing on the print is under the pointer.");
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
      const picked = interactiveGeometryAt(point);
      const drawingObject = hitDrawingObject(drawingObjects, point, sheetMeta.page);
      const objectGeometry = drawingObject?.objectKind === "unclassified-vector" || drawingObject?.objectKind === "recognized-device"
        ? { cx: drawingObject.x, cy: drawingObject.y, outline: drawingObject.outline, source: drawingObject.outline?.source || "vector" }
        : null;
      const candidates = [picked?.geometry, objectGeometry].filter((item) => item && Number.isFinite(item.cx) && Number.isFinite(item.cy));
      candidates.sort((a, b) => Math.hypot(a.cx - point.x, a.cy - point.y) - Math.hypot(b.cx - point.x, b.cy - point.y));
      const geometry = candidates[0] || null;
      if (!geometry) {
        setStatus("No printed symbol geometry detected at that point. Zoom in and click directly inside the symbol.");
        return;
      }
      const matched = picked?.match?.entry?.symbol;
      const selectedSymbol = symbol || matched;
      const body = {
        x: geometry.cx,
        y: geometry.cy,
        symbolBodyLocation: { x: geometry.cx, y: geometry.cy },
        outline: geometry.outline,
        outlineSource: geometry.outline?.source || geometry.source || "vector",
        fillEnabled: true,
        fillMode: "inside",
        fillOpacity: 0.34,
      };
      addMark(
        {
          type: tool === "drop" ? "drop" : "count",
          ...body,
          symbol: selectedSymbol?.id,
          symbolLabel: selectedSymbol?.label,
          abbr: selectedSymbol?.abbr,
          typeCode: selectedSymbol?.abbr || matched?.abbr,
          category: selectedSymbol?.takeoffCategory || selectedSymbol?.category || category,
          feet: tool === "drop" ? DEFAULT_DROP_FEET : undefined,
        },
        tool === "drop"
          ? `${selectedSymbol?.label || category} drop counted and snapped to printed symbol geometry.`
          : `${selectedSymbol?.label || category} counted and filled inside the printed symbol.`,
      );
      return;
    }

    if (tool === "markup") {
      const text = window.prompt("Review note");
      if (text) addMark({ type: "note", text, ...point }, "Note placed.");
      return;
    }

    if (tool === "conduit") {
      const nextPoint = draftPoints.length
        ? snapOrthogonalPoint(draftPoints[draftPoints.length - 1], point)
        : point;
      if (!draftPoints.length) {
        draftJunctionIdsRef.current = [];
        setDraftPoints([nextPoint]);
        setStatus('Conduit started on 90° runs. Click corners, Add JB / press J for a 4" square metal box, double-click to finish.');
        return;
      }
      const last = draftPoints[draftPoints.length - 1];
      if (Math.hypot(nextPoint.x - last.x, nextPoint.y - last.y) < 0.15) return;
      setDraftPoints([...draftPoints, nextPoint]);
      setStatus(`Conduit corner ${draftPoints.length + 1}. Add JB / press J for a junction box, double-click to finish.`);
      return;
    }

    if (["linear", "homerun"].includes(tool)) {
      if (draftPoints.length === 0) {
        setDraftPoints([point]);
        const label = tool === "homerun" ? "Homerun" : "Linear";
        setStatus(`${label} started. Click the end point.`);
        return;
      }
      const points = [draftPoints[0], point];
      const feet = feetFromPercent(polylineLength(points, sheetAspectRatio), calibration);
      addMark(
        {
          type: tool === "homerun" ? "homerun" : "line",
          tool,
          points,
          storedFeet: feet,
        },
        feet == null
          ? `${tool === "homerun" ? "Homerun" : "Linear"} added. Calibrate scale to read LF.`
          : `${tool === "homerun" ? "Homerun" : "Linear"} ${formatFeet(feet)}.`,
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

    if (tool === "area" && draftPoints.length === 0) {
      const room = enclosingRoom(drawingObjects, point, sheetMeta.page);
      if (room) {
        const materialized = materializeDrawingObject(room, marks);
        const hit = materialized?.mark || null;
        if (hit && !materialized.existing) {
          commitMarks([...marks, hit], "Room boundary filled from the printed outline. Name the room before using its area in the bid.");
          setSelectedId(hit.id);
        } else if (hit) {
          setSelectedId(hit.id);
          setStatus("Selected the room. Edit its name in the inspector.");
        }
        return;
      }
    }

    if (["polyline", "area", "circuit"].includes(tool)) {
      const next = [...draftPoints, point];
      setDraftPoints(next);
      setStatus(`${activeTool.label} in progress. Double-click to finish.`);
    }
  }

  function finishPath(event) {
    if (!["polyline", "area", "circuit", "conduit"].includes(tool) || draftPoints.length < 2) return;
    event?.preventDefault?.();
    const sheetAspectRatio = currentAspect();
    if (tool === "area") {
      if (draftPoints.length < 3) return;
      const measured = measureMark({ type: "area", points: draftPoints, heightFeet: 0 }, calibration, sheetAspectRatio);
      addMark({
        type: "area",
        points: draftPoints,
        areaSf: measured.areaSf,
        perimeterLf: measured.perimeterLf,
      }, measured.areaSf == null
        ? "Area added. Calibrate scale to read SF and perimeter."
        : `Area ${formatArea(measured.areaSf)}. Perimeter ${measured.perimeterLf == null ? "—" : formatFeet(measured.perimeterLf)}.`);
    } else if (tool === "conduit") {
      finishConduitRun(draftPoints);
    } else {
      const feet = feetFromPercent(polylineLength(draftPoints, sheetAspectRatio), calibration);
      addMark(
        { type: "route", tool, points: draftPoints, storedFeet: feet },
        feet == null ? `${activeTool.label} added. Calibrate scale to read LF.` : `${activeTool.label} ${formatFeet(feet)}.`,
      );
    }
    setDraftPoints([]);
    draftJunctionIdsRef.current = [];
  }

  function finishConduitRun(points) {
    if (!points || points.length < 2) return;
    const sheetAspectRatio = currentAspect();
    const feet = feetFromPercent(polylineLength(points, sheetAspectRatio), calibration);
    const runNumber = nextConduitRunNumber(marks);
    const runId = crypto.randomUUID();
    const junctionIds = [...draftJunctionIdsRef.current];
    const conduitMark = {
      id: runId,
      type: "route",
      tool: "conduit",
      points,
      runNumber,
      storedFeet: feet,
      junctionBoxIds: junctionIds,
      conduitSize: conduitChoice?.size || "",
      conduitMaterial: conduitChoice?.material || "EMT",
      symbol: conduitChoice?.id || "emt-3-4",
      symbolLabel: conduitChoice?.label || '3/4" EMT',
      category: "Raceway",
      color: CIRCUIT_COLOR,
      thickness: penThickness,
      sheet: sheetMeta.page || 1,
      trade,
      source: "manual",
    };
    let nextMarks = [...marks, conduitMark];
    nextMarks = nextMarks.map((mark) => {
      if (!junctionIds.includes(mark.id)) return mark;
      const through = points.some((point, index) => (
        index > 0 && index < points.length - 1
        && Math.hypot(point.x - mark.x, point.y - mark.y) < 1.6
      ));
      const atEnd = Math.hypot(points[0].x - mark.x, points[0].y - mark.y) < 1.6
        || Math.hypot(points[points.length - 1].x - mark.x, points[points.length - 1].y - mark.y) < 1.6;
      const connectors = Math.max(Number(mark.connectorCount) || 0, through ? 2 : (atEnd ? 1 : 2));
      return { ...mark, parentConduitId: runId, connectorCount: connectors };
    });
    commitMarks(nextMarks, feet == null
      ? `Conduit run ${runNumber} added with ${junctionIds.length} junction box${junctionIds.length === 1 ? "" : "es"}. Calibrate scale to read LF.`
      : `Conduit run ${runNumber}: ${formatFeet(feet)} · ${junctionIds.length} JB.`);
    setMeasureLabel(feet == null ? `Run ${runNumber} stored. Calibrate to total LF.` : `Run ${runNumber}: ${formatFeet(feet)}`);
    setSelectedId(runId);
  }

  function placeJunctionOnDraft() {
    if (tool !== "conduit" || !draftPoints.length) {
      setStatus('Select Conduit and click a point before placing a 4" square metal junction box.');
      return;
    }
    const point = draftPoints[draftPoints.length - 1];
    const box = createJunctionBoxMark({
      id: crypto.randomUUID(),
      sheet: sheetMeta.page || 1,
      trade,
      point,
      color: "#92400e",
      connectorCount: draftPoints.length > 1 ? 2 : 1,
    });
    draftJunctionIdsRef.current = [...draftJunctionIdsRef.current, box.id];
    commitMarks([...marks, box], `4" square metal JB placed. Continue the conduit or double-click to finish.`);
    setSelectedId(box.id);
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
    if (selectedId && !previous.some((mark) => mark.id === selectedId)) {
      setSelectedId(null);
      setIsolationMode(false);
    }
    setStatus("Undid last takeoff change.");
  }

  function redo() {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(marks);
    setMarks(next);
    if (selectedId && !next.some((mark) => mark.id === selectedId)) {
      setSelectedId(null);
      setIsolationMode(false);
    }
    setStatus("Redid last takeoff change.");
  }

  function clearAll() {
    if (marks.length && !window.confirm("Clear all takeoff marks on every sheet of this drawing?")) return;
    commitMarks([], "All takeoff marks cleared.");
    setSelectedId(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    if (printedSelection) {
      setSelectedId(null);
      setStatus("Cleared the printed highlight. Nothing was removed from the drawing.");
      return;
    }
    commitMarks(marks.filter((mark) => mark.id !== selectedId), "Mark deleted.");
    setSelectedId(null);
  }

  function countPrintedSelection() {
    if (!printedSelection) return;
    const materialized = materializeDrawingObject(printedSelection, marks);
    if (!materialized?.mark) return;
    if (!materialized.existing) {
      const kind = printedSelection.objectKind;
      const counted = {
        ...materialized.mark,
        fillEnabled: false,
        bidUse: true,
        prediction: false,
        symbolLabel: kind === "room" ? "Printed room" : kind === "circuit" ? "Printed line" : (materialized.mark.symbolLabel || "Printed symbol"),
        roomName: kind === "room" ? "Printed room" : materialized.mark.roomName,
      };
      const nextMarks = applyDeviceTypeColors([...marks, counted]);
      commitMarks(nextMarks, "Added the printed item to the counted items. The drawing itself was not changed.");
      persistSupplyQuote(nextMarks);
      setSelectedId(counted.id);
    } else {
      setSelectedId(materialized.mark.id);
    }
    setStudioPanel("quantities");
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
      if (!event.metaKey && !event.ctrlKey && !event.altKey && (event.key === "j" || event.key === "J")) {
        if (tool === "conduit" && draftPoints.length) {
          event.preventDefault();
          placeJunctionOnDraft();
        }
      }
      if (!event.metaKey && !event.ctrlKey && event.key === "Enter" && tool === "conduit" && draftPoints.length >= 2) {
        event.preventDefault();
        finishPath(event);
      }
      if (event.key === " " && !["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
        event.preventDefault();
        spacePanRef.current = true;
      }
    };
    const onKeyUp = (event) => {
      if (event.key === " ") spacePanRef.current = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  function onPanPointerDown(event) {
    const panGesture = tool === "pan" || event.button === 1 || spacePanRef.current;
    if (!panGesture || event.button > 1 || pinchActiveRef.current) return;
    if (tool !== "pan") suppressEditClickRef.current = true;
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const originX = event.clientX;
    const originY = event.clientY;
    const startX = panRef.current.x;
    const startY = panRef.current.y;
    const target = event.currentTarget;
    panningRef.current = true;
    const move = (moveEvent) => {
      if (pinchActiveRef.current || moveEvent.pointerId !== pointerId) return;
      const next = {
        x: startX + (moveEvent.clientX - originX),
        y: startY + (moveEvent.clientY - originY),
      };
      panRef.current = next;
      // Update the transform directly so pan does not re-render the PDF each frame.
      if (panLayerRef.current) {
        panLayerRef.current.style.transform = `translate(${next.x}px, ${next.y}px)`;
      }
    };
    const up = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      panningRef.current = false;
      setPan(panRef.current);
      try { target.releasePointerCapture?.(pointerId); } catch { /* already released */ }
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move, { passive: true });
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
    // Do not capture touch pointers: Safari/iOS then never delivers the second
    // finger, so pinch/spread would be stolen by a one-finger pan.
    if (event.pointerType !== "touch") {
      try { target.setPointerCapture?.(pointerId); } catch { /* already released */ }
    }
  }

  function onViewerPointerDown(event) {
    if (tool === "pan" || (tool !== "select" || !selectedId)) return;
    const point = drawingPoint(event);
    if (!point) return;
    if (tool === "select" && selectedId) {
      const mark = marks.find((item) => item.id === selectedId);
      if (!mark) return;
      const canDrag = isDeviceMark(mark)
        ? hitTestDeviceFill(mark, point, penSize)
        : hitTestMark(sizedMark(mark), point, currentAspect(), markHitThreshold(mark, 3.2));
      // The southeast resize handle is intentionally larger than its visual dot
      // so it can be grabbed with a finger without moving the device instead.
      const bodyBounds = mark.symbolBodyBounds;
      const width = Number(bodyBounds?.w || mark.outline?.w || 0.7);
      const height = Number(bodyBounds?.h || mark.outline?.h || 0.7);
      const handleX = (Number(mark.x) || 0) + width / 2;
      const handleY = (Number(mark.y) || 0) + height / 2;
      const resizeHandle = isDeviceMark(mark)
        && Math.abs(point.x - handleX) < 0.35
        && Math.abs(point.y - handleY) < 0.35;
      if (resizeHandle) {
        event.preventDefault();
        const beforeResize = marks;
        let changed = false;
        suppressEditClickRef.current = false;
        const pointerId = event.pointerId;
        const resize = (moveEvent) => {
          if (moveEvent.pointerId !== pointerId) return;
          const next = drawingPoint(moveEvent);
          if (!next) return;
          const w = Math.max(0.2, Math.min(2.4, 2 * (next.x - (Number(mark.x) || 0))));
          const h = Math.max(0.2, Math.min(2.4, 2 * (next.y - (Number(mark.y) || 0))));
          if (!changed && Math.abs(w - width) < 0.01 && Math.abs(h - height) < 0.01) return;
          if (!changed) {
            suppressEditClickRef.current = true;
            historyRef.current.past.push(beforeResize);
            historyRef.current.future = [];
            if (historyRef.current.past.length > 80) historyRef.current.past.shift();
            changed = true;
          }
          setMarks((current) => resizeReviewBounds(current, mark, { w, h }));
        };
        const finish = (upEvent) => {
          if (upEvent.pointerId !== pointerId) return;
          window.removeEventListener("pointermove", resize);
          window.removeEventListener("pointerup", finish);
          window.removeEventListener("pointercancel", finish);
          if (upEvent.type === "pointercancel") suppressEditClickRef.current = false;
          if (changed) saveTakeoff(true);
        };
        window.addEventListener("pointermove", resize);
        window.addEventListener("pointerup", finish);
        window.addEventListener("pointercancel", finish);
        return;
      }
      if (!canDrag) return;
      event.preventDefault();
      let changed = false;
      suppressEditClickRef.current = false;
      const start = point;
      const origin = mark.points ? mark.points.map((item) => ({ ...item })) : { x: mark.x, y: mark.y };
      const isEditableConduit = mark.tool === "conduit" && Array.isArray(origin) && origin.length >= 2;
      let endpointIndex = -1;
      if (isEditableConduit) {
        const endpointThreshold = Math.max(1.4, markHitThreshold(mark, 2.4));
        const first = origin[0];
        const last = origin[origin.length - 1];
        const firstDistance = Math.hypot(point.x - first.x, point.y - first.y);
        const lastDistance = Math.hypot(point.x - last.x, point.y - last.y);
        if (firstDistance <= endpointThreshold || lastDistance <= endpointThreshold) {
          endpointIndex = firstDistance <= lastDistance ? 0 : origin.length - 1;
        }
      }
      const pointerId = event.pointerId;
      const move = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        const now = drawingPoint(moveEvent);
        if (!now) return;
        const dx = now.x - start.x;
        const dy = now.y - start.y;
        if (!changed && Math.hypot(dx, dy) < 0.05) return;
        if (!changed) {
          suppressEditClickRef.current = true;
          historyRef.current.past.push(marks);
          historyRef.current.future = [];
          if (historyRef.current.past.length > 80) historyRef.current.past.shift();
          changed = true;
        }
        setMarks((current) => current.map((item) => {
          if (item.id !== selectedId) return item;
          if (item.points) {
            if (endpointIndex >= 0) {
              return {
                ...item,
                points: origin.map((pt, index) => (
                  index === endpointIndex ? { x: now.x, y: now.y } : { ...pt }
                )),
                lengthEdited: false,
              };
            }
            return { ...item, points: origin.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })), lengthEdited: false };
          }
          if (isDeviceMark(item)) {
            return moveReviewMark([item], item, { x: origin.x + dx, y: origin.y + dy })[0];
          }
          return { ...item, x: origin.x + dx, y: origin.y + dy };
        }));
      };
      const up = (upEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (upEvent.type === "pointercancel") suppressEditClickRef.current = false;
        if (changed) saveTakeoff(true);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    }
  }


  function onViewerContextMenu(event) {
    event.preventDefault();
    if (!file) return;
    const point = drawingPoint(event);
    if (!point) return;
    const sheetAspectRatio = currentAspect();
    const candidates = sheetMarks.filter((mark) => mark?.tool === "conduit" && mark?.points?.length >= 2);
    const hit = [...candidates].reverse().find((mark) => (
      hitTestMark(sizedMark(mark), point, sheetAspectRatio, markHitThreshold(mark, 3.8))
    ));
    if (!hit) {
      setConduitContextMenu(null);
      setStatus("Right-click directly on a conduit run for conduit options.");
      return;
    }
    const bounds = viewerRef.current?.getBoundingClientRect();
    setSelectedId(hit.id);
    setTool("select");
    setConduitContextMenu({
      conduitId: hit.id,
      point,
      left: Math.max(8, event.clientX - (bounds?.left || 0)),
      top: Math.max(8, event.clientY - (bounds?.top || 0)),
    });
    setStatus(`Conduit ${hit.runNumber || ""} selected.`);
  }

  function addJunctionBoxFromContext() {
    if (!conduitContextMenu) return;
    const conduit = marks.find((mark) => mark.id === conduitContextMenu.conduitId);
    if (!conduit) {
      setConduitContextMenu(null);
      return;
    }
    const point = conduitContextMenu.point;
    const points = conduit.points || [];
    const atEnd = points.length >= 2 && (
      Math.hypot(points[0].x - point.x, points[0].y - point.y) < 1.6
      || Math.hypot(points[points.length - 1].x - point.x, points[points.length - 1].y - point.y) < 1.6
    );
    const junctionBox = createJunctionBoxMark({
      id: crypto.randomUUID(),
      sheet: conduit.sheet || sheetMeta.page || 1,
      trade,
      point,
      color: "#92400e",
      conduitId: conduit.id,
      connectorCount: atEnd ? 1 : 2,
    });
    const nextConduit = attachJunctionToConduit(conduit, junctionBox);
    const nextMarks = marks.map((mark) => (mark.id === conduit.id ? nextConduit : mark)).concat(junctionBox);
    commitMarks(nextMarks, `4" square metal JB on conduit ${conduit.runNumber || ""} · ${junctionBox.connectorCount} EMT connector${junctionBox.connectorCount === 1 ? "" : "s"}.`);
    setSelectedId(junctionBox.id);
    setConduitContextMenu(null);
    setTool("select");
  }

  function publishLiveQuantities() {
    const csv = quantityLinkCsv(marks, { slips: slipSheets });
    const payload = { kind: "estim8r-quantity", csv, updatedAt: new Date().toISOString() };
    rememberLiveQuantity(payload);
    const channel = new BroadcastChannel(QUANTITY_LINK_CHANNEL);
    channel.postMessage(payload);
    channel.close();
    window.open("/quantity-link", "estim8r-quantity-link");
    setStatus("Live quantities published. The quantity window reads this publish when it opens.");
  }

  async function signQuantityFile() {
    const csv = quantityLinkCsv(marks, { slips: slipSheets });
    const stored = localStorage.getItem("estim8r-signing-jwk");
    let privateKey;
    let publicJwk;
    if (stored) {
      const parsed = JSON.parse(stored);
      publicJwk = parsed.publicJwk;
      privateKey = await crypto.subtle.importKey("jwk", parsed.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
    } else {
      const pair = await createSigningKey();
      publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
      const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
      localStorage.setItem("estim8r-signing-jwk", JSON.stringify({ publicJwk, privateJwk }));
      privateKey = pair.privateKey;
    }
    const signature = await signQuantity(privateKey, csv);
    downloadBlob(new Blob([JSON.stringify({
      algorithm: "ECDSA-P256-SHA256",
      signature,
      publicJwk,
      purpose: "Device signature for this quantity file. Verification uses the included public key.",
    }, null, 2)], { type: "application/json" }), `${(file?.name || "takeoff").replace(/\.[^.]+$/, "")}-quantity-signature.json`);
    setStatus("Quantity file signed with this device key.");
  }

  function downloadWorkbook() {
    const xml = spreadsheetMl("Takeoff", quantityWorkbookRows(marks, calibration, currentAspect()));
    downloadBlob(new Blob([xml], { type: "application/vnd.ms-excel" }), `${(file?.name || "takeoff").replace(/\.[^.]+$/, "")}-quantity-link.xls`);
    setStatus("Excel workbook downloaded.");
  }

  function downloadMaterialsReport() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Bill of materials", 14, 18);
    doc.setFontSize(10);
    let y = 30;
    const lines = reportLines(marks);
    if (!lines.length) {
      doc.text("No bid quantities yet.", 14, y);
    }
    for (const row of lines) {
      const parts = [row.category, row.name, row.count ? `${row.count} EA` : "", row.lengthLf ? `${row.lengthLf.toFixed(1)} LF` : "", row.areaSf ? `${row.areaSf.toFixed(1)} SF` : ""].filter(Boolean);
      doc.text(parts.join("  ·  "), 14, y);
      y += 7;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    }
    downloadBlob(doc.output("blob"), `${(file?.name || "takeoff").replace(/\.[^.]+$/, "")}-bill-of-materials.pdf`);
    setStatus("Bill of materials downloaded.");
  }

  async function readScannedText() {
    const canvas = document.querySelector("[data-testid='takeoff-sheet-viewport'] canvas");
    if (!canvas) {
      setStatus("Open a drawing page before reading scanned text.");
      return;
    }
    setStatus("Reading text on this sheet…");
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const { createWorker } = await import("tesseract.js");
      const result = await recognizeImage(blob, createWorker);
      setStatus(result.ok && result.text ? `Scanned text: ${result.text.slice(0, 240)}` : (result.error || "No text was read on this sheet."));
    } catch (error) {
      setDrawingError(error?.message || "Scanned text could not be read.");
    }
  }

  function cropToSelection() {
    const object = selectedMark || drawingObjects.find((item) => item.id === selectedId);
    const frame = cropToObject({
      object,
      viewWidth: viewportSize.width,
      viewHeight: viewportSize.height,
      sheetWidth: imageSize.width || viewportSize.width || 1,
      sheetHeight: imageSize.height || viewportSize.height || 1,
    });
    if (!frame) {
      setStatus("Select a symbol, line, or room to crop to it.");
      return;
    }
    setZoom(frame.zoom);
    setPan(frame.pan);
    setStatus("Cropped to the selection.");
  }

  function saveRevisionSnapshot() {
    setRevisionBaseline(marks.map((mark) => ({ ...mark })));
    setStatus(`Revision snapshot saved with ${marks.length} takeoff object${marks.length === 1 ? "" : "s"}.`);
  }

  function compareRevision() {
    const report = revisionReport(revisionBaseline, marks);
    setStatus(`Revision compared with the snapshot: ${report.added} added, ${report.removed} removed, ${report.unchanged} unchanged.`);
  }

  function applyFormulaResult(value, waste) {
    if (!selectedMark) return;
    updateMark(selectedMark.id, { formulaResult: value, wastePercent: waste });
  }

  function placeAerialLength(start, end) {
    const mark = aerialLengthMark(start, end, sheetMeta.page);
    if (!mark) {
      setStatus("Aerial length needs two map points.");
      return;
    }
    commitMarks([...marks, mark], `Aerial length ${Number(mark.storedFeet).toFixed(1)} ft saved on sheet ${sheetMeta.page}.`);
    setSelectedId(mark.id);
  }

  function downloadQuantityLink() {
    const csv = quantityLinkCsv(marks, { slips: slipSheets });
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${(file?.name || "takeoff").replace(/\.[^.]+$/, "")}-quantity-link.csv`);
    setStatus("Quantity link CSV downloaded. Open it in Excel. Pages marked bid use no are predictions until you name them.");
  }

  async function downloadQuantityChecksum() {
    const csv = quantityLinkCsv(marks, { slips: slipSheets });
    try {
      const checksum = await quantityLinkChecksum(csv);
      downloadBlob(new Blob([JSON.stringify({ ...checksum, fileName: file?.name || "" }, null, 2)], { type: "application/json" }), `${(file?.name || "takeoff").replace(/\.[^.]+$/, "")}-quantity-link.integrity.json`);
      setStatus("Quantity link checksum saved. This SHA-256 digest checks the CSV. It is not a certificate-backed digital signature.");
    } catch (error) {
      setDrawingError(error?.message || "Could not checksum the quantity link.");
    }
  }

  function downloadStudioSession() {
    const payload = studioPackage({ fileName: file?.name, marks, pageTakeoff, slips: slipSheets, toolChest });
    downloadBlob(new Blob([JSON.stringify(payload)], { type: "application/json" }), `${(file?.name || "takeoff").replace(/\.[^.]+$/, "")}-studio-session.json`);
    setStatus("Takeoff session file downloaded. Another estimator can import it. This is a shared file, not a live multi-user session.");
  }

  async function importStudioSession(event) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    try {
      const incoming = JSON.parse(await picked.text());
      const next = mergeStudioPackage(marks, incoming);
      if (next === marks) {
        setDrawingError("That file is not an Estim8r takeoff session.");
        return;
      }
      commitMarks(next, "Imported takeoff session.");
      if (incoming.pageTakeoff) setPageTakeoff(incoming.pageTakeoff);
      if (Array.isArray(incoming.slips)) setSlipSheets(incoming.slips);
      if (Array.isArray(incoming.toolChest) && incoming.toolChest.length) {
        setToolChest((current) => incoming.toolChest.reduce((chest, item) => addToolChestItem(chest, item), current));
      }
    } catch (error) {
      setDrawingError(error?.message || "Could not read the takeoff session file.");
    }
  }

  function insertSlipSheet() {
    const title = window.prompt("Slip sheet title", "Revision");
    if (!title) return;
    setSlipSheets((current) => addSlipSheet(current, sheetMeta.page, title));
    setStatus(`Slip sheet “${title}” is saved after sheet ${sheetMeta.page}. It travels with the quantity link and the shared session file.`);
  }

  function countSelectedSymbol() {
    const rows = visualSearchCounts(marks, selectedMark);
    if (!rows.length) {
      setStatus("No accepted matches for this symbol yet. Classify it before counting it across pages.");
      return;
    }
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    setStatus(`${selectedMark?.typeCode || selectedMark?.symbolLabel || "Symbol"}: ${total} on ${rows.map((row) => `sheet ${row.sheet} (${row.count})`).join(", ")}.`);
  }

  function openNextBatchDrawing() {
    const [next, ...rest] = batchQueue;
    setBatchQueue(rest);
    if (next) void chooseFile(next);
  }

  async function copyQuantities() {
    const csv = quantitiesToCsv(editedRollup, runs);
    try {
      await navigator.clipboard.writeText(csv);
      setStatus("Counted items copied.");
    } catch {
      window.prompt("Copy quantity CSV", csv);
    }
  }

  if (!file) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-6">
        <div
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; }}
          onDrop={handleDrop}
          className="rounded-lg border border-border bg-card p-6"
        >
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Takeoff</h1>
          <p className="mt-1 text-sm text-muted-foreground">Open a PDF or image. The sheet is ready to pan, zoom, and mark as soon as it loads.</p>
          <label
            htmlFor={DRAWING_INPUT_ID}
            className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-6 py-8 text-center"
          >
            <FileUp className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Drop a drawing here</span>
            <span className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPG, JPEG, or WEBP</span>
            <span className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background">
              <Upload className="h-4 w-4" /> Choose drawing
            </span>
          </label>
          {status ? <div className="mt-3 text-sm text-muted-foreground">{status}</div> : null}
          {loadingDrawing && <div className="mt-2 text-sm font-medium text-foreground">Reading drawing…</div>}
          {drawingError && <div role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{drawingError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background"
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; }}
      onDrop={handleDrop}
    >
      <TakeoffCommandBar
        fileName={file.name}
        detail={[
          isPdf ? `${sheetMeta.pageCount} sheet${sheetMeta.pageCount === 1 ? "" : "s"}` : "Image",
          calibration ? (calibration.scaleLabel ? `scale ${calibration.scaleLabel}` : `${calibration.feet} ft`) : "scale not set",
          aiBusy ? "AI working" : mode === "ai" ? "AI ready" : savedAt ? `saved ${new Date(savedAt).toLocaleTimeString()}` : "not saved",
        ].join(" · ")}
        page={sheetMeta.page}
        pageCount={sheetMeta.pageCount}
        zoom={zoom}
        aiBusy={aiBusy}
        isPdf={isPdf}
        pageTakeoffEnabled={isPageTakeoffEnabled(pageTakeoff, sheetMeta.page)}
        pendingReview={accuracyTotals.pending}
        onPrev={() => selectSheet(sheetMeta.page - 1)}
        onNext={() => selectSheet(sheetMeta.page + 1)}
        onZoomOut={() => setZoom((z) => Math.max(TAKEOFF_MIN_ZOOM, Number((z - 0.25).toFixed(2))))}
        onZoomIn={() => setZoom((z) => Math.min(TAKEOFF_MAX_ZOOM, Number((z + 0.25).toFixed(2))))}
        onFit={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
        onUndo={undo}
        onRedo={redo}
        onAi={() => { setMode("ai"); void runAiTakeoff({ onlyPage: sheetMeta.page }); }}
        onPageTakeoff={(enabled) => {
          setPageTakeoff((current) => setPageTakeoffEnabled(current, sheetMeta.page, enabled));
          setStatus(enabled ? `Takeoff will include sheet ${sheetMeta.page}.` : `Takeoff will skip sheet ${sheetMeta.page}.`);
        }}
        onReview={openAccuracyReview}
        actions={(
          <TakeoffActionsMenu
            aiBusy={aiBusy}
            label="Actions"
            onAiAssist={() => { setMode("ai"); void runAiTakeoff(); }}
            onSave={() => saveTakeoff()}
            onTrueTakeoff={() => { void buildAndSaveTrueElectricalEstimate(); }}
            onTakeoffCsv={() => { void buildAndSaveTrueElectricalEstimate({ download: true }); }}
            onEstimatePath={takeoffEstimatePath(file)}
            onMarkupPath={takeoffMarkupPath(file)}
            onCountedDrawings={() => { void downloadMarkedDeviceDrawings(); }}
            onConduitRoutes={() => { void downloadConduitRouteDrawings(); }}
            onConduitSchedulePdf={downloadConduitCircuitSchedule}
            onConduitScheduleCsv={downloadConduitCircuitCsv}
            onWireMakeupPdf={downloadWireMakeupPdf}
            onWireMakeupCsv={downloadWireMakeupCsv}
            onQuoteExcel={downloadQuoteExcel}
            onQuotePdf={downloadQuotePdf}
            onReplaceId={DRAWING_INPUT_ID}
            onClose={closeDrawing}
            onClear={clearAll}
          />
        )}
      />
      {drawingError && <div role="alert" className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{drawingError}</div>}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[5.5rem_minmax(0,1fr)_22rem] lg:grid-rows-1">
        <TakeoffToolRail
          tool={tool}
          onTool={(key) => {
            setTool(key);
            setDraftPoints([]);
            draftJunctionIdsRef.current = [];
            setMeasureLabel("");
            if (["count", "drop", "conduit", "homerun"].includes(key)) setStudioPanel("symbol");
          }}
        />

        <section className="grid min-h-0 min-w-0 grid-rows-[minmax(20rem,1fr)] overflow-hidden bg-card lg:flex lg:grid-rows-none lg:flex-row">
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
          <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(20rem,1fr)_auto] overflow-hidden lg:flex lg:flex-1 lg:grid-rows-none lg:flex-col">
          <TakeoffMobileCommandBar
            aiBusy={aiBusy}
            zoom={zoom}
            pagesOpen={mobilePanel === "pages"}
            estimatePath={takeoffEstimatePath(file)}
            onAiAssist={() => { setMode("ai"); void runAiTakeoff(); }}
            onTogglePages={() => setMobilePanel((value) => (value === "pages" ? "" : "pages"))}
            onZoomOut={() => setZoom((z) => Math.max(TAKEOFF_MIN_ZOOM, Number((z - 0.25).toFixed(2))))}
            onZoomIn={() => setZoom((z) => Math.min(TAKEOFF_MAX_ZOOM, Number((z + 0.25).toFixed(2))))}
            onFit={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          />
          <div
            ref={viewportRef}
            onPointerDown={onPanPointerDown}
            onWheel={handleDrawingWheel}
            data-testid="takeoff-sheet-viewport"
            className={cn(
              "takeoff-sheet-viewport relative min-h-[20rem] min-w-0 overflow-hidden bg-muted/50 dark:bg-neutral-950 lg:min-h-0 lg:flex-1",
              tool === "pan" && "cursor-grab",
            )}
            style={{ touchAction: "none" }}
          >
            <TakeoffSelectionBar
              selected={selectedId ? selectedMark : null}
              isDevice={Boolean(selectedMark && isDeviceMark(selectedMark) && tool === "select")}
              onColor={(color) => updateMark(selectedMark.id, { color, correction: "color" })}
              onShrink={() => resizeSelectedReview({
                w: (selectedMark.symbolBodyBounds?.w || selectedMark.outline?.w || 0.7) * 0.8,
                h: (selectedMark.symbolBodyBounds?.h || selectedMark.outline?.h || 0.7) * 0.8,
              })}
              onEnlarge={() => resizeSelectedReview({
                w: (selectedMark.symbolBodyBounds?.w || selectedMark.outline?.w || 0.7) * 1.25,
                h: (selectedMark.symbolBodyBounds?.h || selectedMark.outline?.h || 0.7) * 1.25,
              })}
              onCountPages={countSelectedSymbol}
              onDelete={deleteSelected}
            />
            <div className={cn("flex h-full w-full items-center justify-center p-2", comparePage && "items-stretch gap-2")}>
              <div
                ref={(node) => {
                  viewerRef.current = node;
                  panLayerRef.current = node;
                }}
                onClick={(event) => {
                  if (panningRef.current) return;
                  if (suppressEditClickRef.current) {
                    suppressEditClickRef.current = false;
                    return;
                  }
                  onDrawingClick(event);
                }}
                onDoubleClick={finishPath}
                onContextMenu={onViewerContextMenu}
                onPointerDown={onViewerPointerDown}
                onPointerMove={(event) => {
                  if (panningRef.current || aiBusy) return;
                  const point = drawingPoint(event);
                  if (!point) return;
                  setPointerSheet((current) => (current && Math.hypot(current.x - point.x, current.y - point.y) < 0.2 ? current : point));
                  const hovered = selectMarkAtPoint(overlayMarks, point, { markerSize: (mark) => resolvedMarkerSize(mark, penSize) });
                  if (hovered && isDeviceMark(hovered)) {
                    setHoveredGeometryInfo(null);
                    setHoveredDeviceId(hovered.id);
                  } else {
                    // Pointer movement must stay cheap. Do not run the full legend
                    // geometry matcher on every mouse event; that caused Chrome's
                    // "Page unresponsive" dialog on large electrical PDFs.
                    const object = hitDrawingObject(drawingObjects, point, sheetMeta.page);
                    setHoveredGeometryInfo(null);
                    setHoveredDeviceId(object ? `object:${object.objectId || object.id}` : null);
                  }
                  if (!["conduit", "polyline", "linear", "measure", "homerun"].includes(tool)) return;
                  if (tool === "conduit") {
                    const prev = hoverPoint;
                    if (prev && Math.hypot(prev.x - point.x, prev.y - point.y) < 0.35) return;
                  }
                  setHoverPoint(point);
                }}
                onPointerLeave={() => { setHoverPoint(null); setPointerSheet(null); setHoveredDeviceId(null); setHoveredGeometryInfo(null); }}
                className={cn("relative bg-white shadow-xl", tool === "pan" ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair")}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, willChange: tool === "pan" ? "transform" : "auto", touchAction: "none" }}
              >
                {isPdf ? (
                  fileBytes ? (
                    <PdfDrawing
                      fileBytes={fileBytes}
                      fileName={file.name}
                      zoom={zoom}
                      pageNumber={sheetMeta.page}
                      onPageNumber={(page) => setSheetMeta((current) => (current.page === page ? current : { ...current, page }))}
                      viewportWidth={comparePage ? Math.max(160, Math.floor(viewportSize.width / 2)) : viewportSize.width}
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
                {conduitContextMenu ? (
                  <div
                    className="absolute z-40 min-w-44 rounded-lg border border-border bg-background p-1 text-sm shadow-xl"
                    style={{ left: conduitContextMenu.left, top: conduitContextMenu.top }}
                    onClick={(event) => event.stopPropagation()}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <button
                      type="button"
                      onClick={addJunctionBoxFromContext}
                      className="w-full rounded-md px-3 py-2 text-left font-semibold hover:bg-muted"
                    >
                      Add junction box
                    </button>
                  </div>
                ) : null}
                <MarkupOverlay
                  marks={visibleOverlayMarks}
                  draftPoints={draftPreview}
                  draftFeet={["conduit", "polyline", "linear", "homerun"].includes(tool) ? draftFeet : null}
                  selectedId={selectedId}
                  tool={tool}
                  markerSize={penSize}
                  lineSize={penThickness}
                  fontSize={OVERLAY_FONT_SIZE}
                  showConduitLabels={wideLayout}
                  lengthFor={(mark) => markLengthFeet(mark, calibration, aspect)}
                  printedHighlight={printedHighlightGeometry(printedSelection)}
                  hoverHighlight={printedHighlightGeometry(hoveredPrinted && printedSelectionId(hoveredPrinted) !== selectedId ? hoveredPrinted : null)}
                />
                {(() => {
                  const rawSymbol = hoveredGeometryInfo?.match?.entry?.symbol || null;
                  const rawGeometry = hoveredGeometryInfo?.geometry || null;
                  const hovered = visibleOverlayMarks.find((mark) => mark.id === hoveredDeviceId && isDeviceMark(mark))
                    || (String(hoveredDeviceId || "").startsWith("object:")
                      ? drawingObjects.find((item) => `object:${item.objectId || item.id}` === hoveredDeviceId)
                      : null)
                    || (rawGeometry ? {
                      x: rawGeometry.cx, y: rawGeometry.cy,
                      symbol: rawSymbol?.id,
                      symbolLabel: rawSymbol?.label || "Unclassified device",
                      abbr: rawSymbol?.abbr || hoveredGeometryInfo?.match?.entry?.code || "?",
                      typeCode: rawSymbol?.abbr || hoveredGeometryInfo?.match?.entry?.code || "UNKNOWN",
                      category: rawSymbol?.takeoffCategory || rawSymbol?.category || "Unclassified",
                      requiresClassification: !rawSymbol,
                    } : null);
                  if (hovered?.objectKind === "circuit" || hovered?.objectKind === "room") {
                    const x = Math.min(78, Math.max(2, Number(pointerSheet?.x ?? hovered.x) || 0));
                    const y = Math.min(78, Math.max(2, Number(pointerSheet?.y ?? hovered.y) || 0));
                    const title = hovered.objectKind === "room" ? "Room" : "Line";
                    const detail = hovered.objectKind === "room"
                      ? "Click to select this room, then name it before the area is used in the bid."
                      : "Click to select this line, then assign a circuit before the length is used in the bid.";
                    return (
                      <div
                        className="pointer-events-none absolute z-50 max-w-56 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground shadow-md"
                        style={{ left: `${x}%`, top: `${y}%`, transform: "translate(10px, 10px)" }}
                      >
                        <div className="font-semibold leading-tight">{title}</div>
                        <div className="mt-0.5 text-muted-foreground">{detail}</div>
                      </div>
                    );
                  }
                  if (!hovered || !shouldShowSymbolHover(hovered)) return null;
                  const hoverBound = hoverBoundToLegend(hovered, drawingSymbols, {
                    planType: aiPages.find((item) => item.page === sheetMeta.page)?.planType || "",
                  });
                  const hoverLegend = hoverBound.hover;
                  const x = Math.min(78, Math.max(2, Number(pointerSheet?.x ?? hovered.x) || 0));
                  const y = Math.min(78, Math.max(2, Number(pointerSheet?.y ?? hovered.y) || 0));
                  return (
                    <div
                      className="pointer-events-none absolute z-50 max-w-56 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground shadow-md"
                      style={{ left: `${x}%`, top: `${y}%`, transform: "translate(10px, 10px)" }}
                    >
                      <div className="font-semibold leading-tight">{hoverLegend.code || "Symbol"} · {hoverLegend.label}</div>
                      <div className="text-muted-foreground">{hoverLegend.category}</div>
                      {!hoverLegend.verified || hovered.requiresClassification ? <div className="mt-1 text-amber-800 dark:text-amber-300">Review before bid use.</div> : null}
                      {hoverLegend.source ? <div className="mt-1">Legend: {hoverLegend.source}</div> : null}
                      {hoverLegend.page ? <div>Sheet {hoverLegend.page}</div> : null}
                    </div>
                  );
                })()}
                {file && searchManifest && !aiBusy && visibleOverlayMarks.length === 0 && !emptyNoticeDismissed && (
                  <div className="absolute bottom-3 right-3 z-20 max-w-xs rounded-md border border-border bg-card px-3 py-2 shadow-sm">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 text-xs text-muted-foreground">No marks on this sheet.</p>
                      <button
                        type="button"
                        aria-label="Close no takeoff marks notice"
                        onClick={() => setEmptyNoticeDismissed(true)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {comparePage && isPdf && fileBytes ? (
                <div data-testid="compare-sheet" className="flex min-w-0 flex-1 items-center justify-center overflow-hidden border-l border-border bg-neutral-200/50">
                  <PdfDrawing
                    fileBytes={fileBytes}
                    fileName={file.name}
                    zoom={1}
                    pageNumber={Number(comparePage)}
                    viewportWidth={Math.max(160, Math.floor((viewportSize.width || 640) / 2))}
                    viewportHeight={viewportSize.height || 480}
                  />
                </div>
              ) : null}
            </div>
          </div>
          <div className="hidden lg:block">
            <AiSearchManifestPanel manifest={searchManifest} trade={trade} />
            <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{activeTool.label}</span>
              <span className="truncate">{measureLabel || status}</span>
            </div>
          </div>
          <TakeoffMobileDock
            tool={tool}
            activeToolLabel={activeTool.label}
            status={status}
            toolsOpen={mobilePanel === "tools"}
            devicesOpen={mobilePanel === "devices"}
            countsOpen={mobilePanel === "counts"}
            onPan={() => { setTool("pan"); setDraftPoints([]); setMobilePanel(""); }}
            onToggleTools={() => setMobilePanel((value) => (value === "tools" ? "" : "tools"))}
            onToggleDevices={() => setMobilePanel((value) => (value === "devices" ? "" : "devices"))}
            onToggleCounts={() => setMobilePanel((value) => (value === "counts" ? "" : "counts"))}
            moreMenu={(
              <TakeoffActionsMenu
                aiBusy={aiBusy}
                label="More"
                onAiAssist={() => { setMode("ai"); void runAiTakeoff(); }}
                onSave={() => saveTakeoff()}
                onTrueTakeoff={() => { void buildAndSaveTrueElectricalEstimate(); }}
                onTakeoffCsv={() => { void buildAndSaveTrueElectricalEstimate({ download: true }); }}
                onEstimatePath={takeoffEstimatePath(file)}
                onMarkupPath={takeoffMarkupPath(file)}
                onCountedDrawings={() => { void downloadMarkedDeviceDrawings(); }}
                onConduitRoutes={() => { void downloadConduitRouteDrawings(); }}
                onConduitSchedulePdf={downloadConduitCircuitSchedule}
                onConduitScheduleCsv={downloadConduitCircuitCsv}
                onWireMakeupPdf={downloadWireMakeupPdf}
                onWireMakeupCsv={downloadWireMakeupCsv}
                onQuoteExcel={downloadQuoteExcel}
                onQuotePdf={downloadQuotePdf}
                onReplaceId={DRAWING_INPUT_ID}
                onClose={closeDrawing}
                onClear={clearAll}
                className="h-11 w-full text-sm"
              />
            )}
          />
          </div>
        </section>

        <aside className="hidden min-h-0 flex-col border-l border-border bg-card lg:flex">
          <div className="flex shrink-0 border-b border-border" role="tablist" aria-label="Takeoff panel">
            {[["quantities", "Quantities"], ["symbol", "Symbol"], ["output", "Output"]].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={studioPanel === id}
                onClick={() => setStudioPanel(id)}
                className={cn("h-9 flex-1 text-xs font-semibold", studioPanel === id ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
          {studioPanel === "symbol" ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <DevicePicker
                availableSymbols={availableDeviceSymbols}
                trades={TRADES}
                trade={trade}
                onTrade={setTrade}
                marks={marks}
                pageKinds={pageKinds}
                category={category}
                onCategory={(value) => { setCategory(value); setSymbolQuery(""); }}
                symbolId={symbolId}
                onSymbol={setSymbolId}
                query={symbolQuery}
                onQuery={setSymbolQuery}
                onManualMark={() => { setTool("count"); setStatus("Choose a legend symbol, then click the missed printed symbol."); }}
              />
              <TakeoffSizeControl markerSize={penSize} lineSize={penThickness} onMarkerSize={setPenSize} onLineSize={setPenThickness} />
              <label className="block text-xs font-semibold text-muted-foreground">Pen
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-7 w-7 shrink-0 rounded-md border border-border" style={{ backgroundColor: penColor }} aria-hidden />
                  <input type="color" value={penColor} onChange={(event) => setPenColor(event.target.value)} className="h-8 w-full" aria-label="Pen color" />
                </span>
              </label>
              <label className="block text-xs font-semibold text-muted-foreground">Conduit size
                <select value={conduitChoice.id} onChange={(event) => setConduitId(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  {conduitChoices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              {(tool === "conduit" || hardwareTotals.junctionBoxes > 0) && (
                <div className="space-y-2">
                  <button type="button" disabled={tool !== "conduit" || !draftPoints.length} onClick={placeJunctionOnDraft} className="w-full rounded-md border border-border px-2 py-1.5 text-left text-xs font-semibold hover:bg-muted disabled:opacity-40">Add 4&quot; square JB</button>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Junction boxes</span><span className="font-medium text-foreground">{hardwareTotals.junctionBoxes}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>EMT connectors</span><span className="font-medium text-foreground">{hardwareTotals.emtConnectors}</span></div>
                </div>
              )}
              <label className="block text-xs font-semibold text-muted-foreground">Homeruns per conduit
                <input type="number" min="1" max="12" value={maxHomeruns} onChange={(event) => setMaxHomeruns(Math.max(1, Number(event.target.value) || 1))} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
              </label>
              {typeSwatches.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {typeSwatches.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setInspectType((current) => current === item.key.toUpperCase() ? "" : item.key.toUpperCase())}
                      className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold", inspectType === item.key.toUpperCase() ? "border-foreground bg-muted" : "border-border")}
                    >
                      <span className="h-3 w-3 rounded-sm border border-black/20" style={{ backgroundColor: item.color }} aria-hidden />
                      {item.key.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                <button type="button" className="w-full rounded-md border border-border px-2 py-1.5 text-left text-xs font-semibold hover:bg-muted" onClick={() => {
                  const name = window.prompt("Name this tool", activeTool.label);
                  if (!name) return;
                  setToolChest((current) => addToolChestItem(current, { name, tool, color: penColor, symbolId, category, lineSize: penThickness, markerSize: penSize }));
                }}>Save current tool</button>
                {toolChest.map((item) => (
                  <button key={item.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-muted" onClick={() => {
                    setTool(item.tool || "select");
                    if (item.color) setPenColor(item.color);
                    if (item.symbolId) setSymbolId(item.symbolId);
                    if (item.category) setCategory(item.category);
                    if (item.lineSize) setPenThickness(item.lineSize);
                    if (item.markerSize) setPenSize(item.markerSize);
                    setStatus(`${item.name} is the active tool.`);
                  }}>
                    <span className="h-3 w-3 rounded-sm border border-black/20" style={{ backgroundColor: item.color || "#334155" }} />
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {studioPanel === "output" ? (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              <button type="button" onClick={downloadQuantityLink} className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-muted">Quantity link CSV</button>
              <button type="button" onClick={() => { void downloadQuantityChecksum(); }} className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-muted">Quantity link checksum</button>
              <button type="button" onClick={downloadStudioSession} className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-muted">Share takeoff session</button>
              <label className="block cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium hover:bg-muted">
                Import takeoff session
                <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void importStudioSession(event); }} />
              </label>
              <button type="button" onClick={insertSlipSheet} className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-muted">Slip sheet after this page</button>
              {batchQueue.length > 0 && (
                <button type="button" onClick={openNextBatchDrawing} className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold hover:bg-muted">Next drawing ({batchQueue.length} waiting)</button>
              )}
              <ProfessionalToolsPanel
                selected={selectedMark}
                marks={marks}
                drawingObjects={drawingObjects}
                page={sheetMeta.page}
                pageCount={sheetMeta.pageCount}
                slips={slipSheets}
                calibration={calibration}
                aspect={currentAspect()}
                comparePage={comparePage}
                sessionId={sessionId}
                onStatus={setStatus}
                onTool={(next) => { setTool(next); setDraftPoints([]); }}
                onPlaceAssembly={(assembly) => {
                  setPendingAssembly(assembly);
                  setStatus(`${assembly.name} will be placed on the next sheet click.`);
                }}
                onCrop={cropToSelection}
                onCompare={setComparePage}
                onSnapshot={saveRevisionSnapshot}
                onRevision={compareRevision}
                onWorkbook={downloadWorkbook}
                onSign={() => { void signQuantityFile(); }}
                onLiveLink={publishLiveQuantities}
                onSession={setSessionId}
                onOcr={() => { void readScannedText(); }}
                onReport={downloadMaterialsReport}
                onAerialLength={placeAerialLength}
                onFormula={applyFormulaResult}
              />
            </div>
          ) : null}
          {studioPanel === "quantities" ? (
        <TakeoffInspector
          className="min-h-0 flex-1 overflow-y-auto bg-card p-3"
          rollup={rollup}
          totals={editedRollup.totals}
          runs={runs}
          drawingDocs={drawingDocs}
          trade={trade}
          marks={tradeMarks}
          pageKinds={pageKinds}
          selected={selectedMark}
          printed={printedSelection}
          onCountPrinted={countPrintedSelection}
          conduitOptions={conduitChoices}
          scheduleEdits={scheduleEdits}
          onSelectRun={(id) => { setSelectedId(id); setTool("select"); }}
          onUpdateMark={updateMark}
          isolationMode={isolationMode}
          onIsolationMode={setIsolationMode}
          onEditRow={editScheduleRow}
          onRenameRow={renameScheduleRow}
          onSelectSheet={selectSheet}
          onCopy={copyQuantities}
          onDownloadQuoteExcel={downloadQuoteExcel}
          onDownloadQuotePdf={downloadQuotePdf}
          globalMarkerSize={penSize}
          globalLineSize={penThickness}
          trueAnalysis={trueAnalysis}
          trueTakeoffResult={trueTakeoffResult}
          onBuildTrueTakeoff={() => buildAndSaveTrueElectricalEstimate()}
          reconciliation={reconciliation}
          reviewSummary={accuracyTotals}
          coverageNote={sheetCoverage ? describeSheetCoverage(sheetCoverage) : undefined}
        />
          ) : null}
        </aside>
      </div>
      <TakeoffMobileSheet
        open={mobilePanel === "pages"}
        onOpenChange={(open) => setMobilePanel(open ? "pages" : "")}
        title="Sheets"
        description={`${sheetMeta.pageCount} sheet${sheetMeta.pageCount === 1 ? "" : "s"} in this drawing. Pinch and one-finger pan stay on the canvas.`}
      >
        <SheetThumbnailPanel
          layout="sheet"
          fileBytes={fileBytes}
          fileUrl={fileUrl}
          isPdf={isPdf}
          fileName={file.name}
          page={sheetMeta.page}
          pageCount={sheetMeta.pageCount}
          marks={marks}
          open
          onToggle={() => setMobilePanel("")}
          onSelectPage={(page) => { selectSheet(page); setMobilePanel(""); }}
        />
      </TakeoffMobileSheet>
      <TakeoffMobileSheet
        open={mobilePanel === "tools"}
        onOpenChange={(open) => setMobilePanel(open ? "tools" : "")}
        title="Takeoff tools"
        description={activeTool.help}
      >
        <div className="grid grid-cols-2 gap-2">
          {TAKEOFF_TOOLS.map((item) => {
            const Icon = TOOL_ICONS[item.key] || Pencil;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => { setTool(item.key); setDraftPoints([]); setMobilePanel(""); }}
                className={cn(
                  "flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-base font-bold",
                  tool === item.key ? "border-foreground bg-foreground text-background" : "border-border bg-background",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" /><span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
          <TakeoffSizeControl
            markerSize={penSize}
            lineSize={penThickness}
            onMarkerSize={setPenSize}
            onLineSize={setPenThickness}
          />
        </div>
        {typeSwatches.length ? (
          <div className="mt-4">
            <div className="mb-2 text-base font-bold">Type colors</div>
            <div className="flex flex-wrap gap-2">
              {typeSwatches.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setInspectType((current) => current === item.key.toUpperCase() ? "" : item.key.toUpperCase())}
                  className={inspectType === item.key.toUpperCase()
                    ? "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-foreground bg-foreground px-3 text-base font-semibold text-background"
                    : "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-background px-3 text-base font-bold"}
                >
                  <span className="h-5 w-5 rounded-sm border border-black/20" style={{ backgroundColor: item.color }} aria-hidden />
                  {item.key.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </TakeoffMobileSheet>
      <TakeoffMobileSheet
        open={mobilePanel === "devices"}
        onOpenChange={(open) => setMobilePanel(open ? "devices" : "")}
        title="Devices"
        description="Pick a legend symbol, then mark a missed printed symbol."
      >
        <DevicePicker
          compact
          availableSymbols={availableDeviceSymbols}
          trades={TRADES}
          trade={trade}
          onTrade={setTrade}
          marks={marks}
          pageKinds={pageKinds}
          category={category}
          onCategory={(value) => { setCategory(value); setSymbolQuery(""); }}
          symbolId={symbolId}
          onSymbol={setSymbolId}
          query={symbolQuery}
          onQuery={setSymbolQuery}
          onManualMark={() => { setTool("count"); setMobilePanel(""); setStatus("Choose a legend symbol, then tap the missed printed symbol."); }}
        />
      </TakeoffMobileSheet>
      <TakeoffMobileSheet
        open={mobilePanel === "counts"}
        onOpenChange={(open) => setMobilePanel(open ? "counts" : "")}
        title="Counted items"
        description="Items you counted, conduit you traced, and legend sheets."
      >
        <TakeoffInspector
          embedded
          rollup={rollup}
          totals={editedRollup.totals}
          runs={runs}
          drawingDocs={drawingDocs}
          trade={trade}
          marks={tradeMarks}
          pageKinds={pageKinds}
          selected={selectedMark}
          printed={printedSelection}
          onCountPrinted={countPrintedSelection}
          conduitOptions={conduitChoices}
          scheduleEdits={scheduleEdits}
          onSelectRun={(id) => { setSelectedId(id); setTool("select"); setMobilePanel(""); }}
          onUpdateMark={updateMark}
          isolationMode={isolationMode}
          onIsolationMode={setIsolationMode}
          onEditRow={editScheduleRow}
          onRenameRow={renameScheduleRow}
          onSelectSheet={(page) => { selectSheet(page); setMobilePanel(""); }}
          onCopy={copyQuantities}
          onDownloadQuoteExcel={downloadQuoteExcel}
          onDownloadQuotePdf={downloadQuotePdf}
          globalMarkerSize={penSize}
          globalLineSize={penThickness}
          trueAnalysis={trueAnalysis}
          trueTakeoffResult={trueTakeoffResult}
          onBuildTrueTakeoff={() => buildAndSaveTrueElectricalEstimate()}
          reconciliation={reconciliation}
          reviewSummary={accuracyTotals}
          coverageNote={sheetCoverage ? describeSheetCoverage(sheetCoverage) : undefined}
        />
      </TakeoffMobileSheet>
      <AccuracyPopout
        open={reviewOpen && Boolean(selectedReviewItem && (isDeviceMark(selectedReviewItem) || selectedReviewItem.type === "coverage"))}
        onOpenChange={setReviewOpen}
        mark={selectedReviewItem && (isDeviceMark(selectedReviewItem) || selectedReviewItem.type === "coverage") ? selectedReviewItem : null}
        fileBytes={isPdf ? fileBytes : null}
        index={reviewIndex}
        total={sheetReview.length}
        instanceOnly={Boolean(selectedReviewItem && (selectedReviewItem.type === "coverage" || isUncertainDetection(selectedReviewItem)))}
        typeCount={selectedMark ? typeInstanceCount(marks, selectedMark) : 1}
        symbols={reviewSymbols}
        onAccept={() => setReviewStatus("accepted")}
        onReject={() => setReviewStatus("rejected")}
        onPrev={() => stepAccuracyReview(-1)}
        onNext={() => stepAccuracyReview(1)}
        onChangeType={changeReviewType}
        onMove={moveSelectedReview}
        onResize={resizeSelectedReview}
        onAddMissed={addMissedDevice}
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

function OverlayLabel({ label, fill, fontSize = OVERLAY_FONT_SIZE }) {
  return (
    <text
      x={label.x}
      y={label.y}
      fontSize={fontSize}
      fontWeight="800"
      fill={fill}
      stroke="#ffffff"
      strokeWidth={fontSize > 2 ? 0.45 : 0.28}
      paintOrder="stroke"
    >
      {label.text}
    </text>
  );
}

function DeviceFill({ mark, selected, markerSize, focus = false }) {
  const measured = displayDeviceOutline(mark, markerSize, { selected });
  if (!measured || !deviceFillEnabled(mark)) return null;
  const outline = interiorDeviceOutline(measured, Number(mark.fillInset) || 0.86);
  if (!outline) return null;
  const color = readableFillColor(mark.color || "#1e3a8a");
  const opacity = focus ? 0.5 : Math.max(Number(mark.fillOpacity ?? DEVICE_FILL_OPACITY), mark.source === "ai" ? 0.46 : DEVICE_FILL_OPACITY);
  // PlanSwift-style marking: paint only inside the detected symbol body.
  // The original black PDF symbol remains visible on top visually because
  // the measured fill is inset before we draw the colored perimeter.
  const stroke = selected || focus ? "#ea580c" : color;
  const strokeWidth = selected || focus ? DEVICE_FILL_STROKE_PX + 0.35 : (mark.source === "ai" ? 1.15 : 0.75);
  if (outline.kind === "composite" && outline.parts?.length) {
    return (
      <g>
        {outline.parts.map((part, index) => {
          if (part.kind === "path" && part.points?.length >= 3) return <polygon key={index} points={part.points.map((point) => `${point.x},${point.y}`).join(" ")} fill={color} fillOpacity={opacity} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
          if (part.kind === "circle") {
            const r = Number(part.r) || Math.max(part.w || 0, part.h || 0) / 2 || DEVICE_CHIP_R;
            return <circle key={index} cx={part.cx ?? mark.x} cy={part.cy ?? mark.y} r={r} fill={color} fillOpacity={opacity} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
          }
          const w = Number(part.w) || MIN_VISIBLE_FILL;
          const h = Number(part.h) || MIN_VISIBLE_FILL * 0.7;
          return <rect key={index} x={(part.cx ?? mark.x) - w / 2} y={(part.cy ?? mark.y) - h / 2} width={w} height={h} rx={0.06} fill={color} fillOpacity={opacity} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
        })}
      </g>
    );
  }
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
        cx={Number.isFinite(outline.cx) ? outline.cx : mark.x}
        cy={Number.isFinite(outline.cy) ? outline.cy : mark.y}
        r={Number(outline.r) || DEVICE_CHIP_R}
        fill={color}
        fillOpacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  const width = Number(outline.w) || MIN_VISIBLE_FILL;
  const height = Number(outline.h) || MIN_VISIBLE_FILL * 0.7;
  const centerX = Number.isFinite(outline.cx) ? outline.cx : mark.x;
  const centerY = Number.isFinite(outline.cy) ? outline.cy : mark.y;
  return (
    <rect
      x={centerX - width / 2}
      y={centerY - height / 2}
      width={width}
      height={height}
      rx={0.08}
      fill={color}
      fillOpacity={opacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function GeometryStroke({ geometry, stroke, width }) {
  if (!geometry) return null;
  if (geometry.kind === "circle") {
    return <circle cx={geometry.cx} cy={geometry.cy} r={geometry.r} fill="none" stroke={stroke} strokeWidth={width} vectorEffect="non-scaling-stroke" />;
  }
  const points = geometry.points.map((point) => `${point.x},${point.y}`).join(" ");
  if (geometry.points.length >= 3) {
    return <polygon points={points} fill="none" stroke={stroke} strokeWidth={width} vectorEffect="non-scaling-stroke" />;
  }
  return <polyline points={points} fill="none" stroke={stroke} strokeWidth={width} vectorEffect="non-scaling-stroke" />;
}

function MarkupOverlay({ marks, draftPoints, draftFeet, selectedId, tool, lengthFor, markerSize = DEFAULT_MARKER_SIZE, lineSize = DEFAULT_LINE_SIZE, fontSize = OVERLAY_FONT_SIZE, showConduitLabels = true, printedHighlight = null, hoverHighlight = null }) {
  const otherRoutes = marks.filter((m) => m.points?.length && !isCircuitMark(m));
  const devices = marks.filter((m) => isDeviceMark(m));
  const circuits = marks.filter((m) => isCircuitMark(m) && m.points?.length);
  const callouts = layoutOverlayCallouts({
    conduits: circuits.filter((m) => m.tool === "conduit"),
    devices,
    selectedId,
    fontSize,
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
          const onPrint = mark.source === "interactive-geometry" || mark.objectKind === "room";
          return <polygon key={mark.id} points={points} fill={mark.type === "cloud" || onPrint ? "none" : "rgba(37,99,235,0.12)"} stroke={selected ? "#ea580c" : color} strokeWidth={selected ? width + 0.6 : width} strokeDasharray={mark.type === "cloud" ? "1.2 0.8" : undefined} vectorEffect="non-scaling-stroke" />;
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
        const color = mark.color || CIRCUIT_COLOR;
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
                strokeOpacity={1}
                opacity={1}
                strokeWidth={width}
                strokeDasharray={dash}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}
      {circuits.filter((mark) => mark.id === selectedId && mark.tool === "conduit" && mark.points?.length >= 2).flatMap((mark) => {
        const endpoints = [mark.points[0], mark.points[mark.points.length - 1]];
        return endpoints.map((point, index) => (
          <circle
            key={`${mark.id}-endpoint-${index}`}
            cx={point.x}
            cy={point.y}
            r="0.65"
            fill="#ffffff"
            stroke={mark.color || CIRCUIT_COLOR}
            strokeWidth="0.28"
            vectorEffect="non-scaling-stroke"
          />
        ));
      })}
      {draftPoints.length > 1 && <polyline points={draftPoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#f97316" strokeWidth=".45" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />}
      {draftEnd && draftFeet != null && (
        <text x={draftEnd.x} y={Math.max(2, draftEnd.y - 1.2)} fontSize={fontSize} fontWeight="800" fill="#ea580c" stroke="#ffffff" strokeWidth={fontSize > 2 ? 0.45 : 0.28} paintOrder="stroke">{formatFeet(draftFeet)}</text>
      )}
      {devices.filter((mark) => mark.id !== selectedId).map((mark) => {
        const size = resolvedMarkerSize(mark, markerSize);
        const isJb = mark.symbol === "junction-box" || mark.abbr === "JB";
        return (
          <g key={mark.id}>
            {isJb ? (
              <rect
                x={mark.x - size * 0.55}
                y={mark.y - size * 0.55}
                width={size * 1.1}
                height={size * 1.1}
                fill={mark.color || "#92400e"}
                fillOpacity={0.34}
                stroke="#78350f"
                strokeWidth="0.18"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <DeviceFill mark={mark} selected={false} markerSize={size} />
            )}
          </g>
        );
      })}
      {devices.filter((mark) => mark.id === selectedId).map((mark) => {
        const size = resolvedMarkerSize(mark, markerSize);
        const isJb = mark.symbol === "junction-box" || mark.abbr === "JB";
        return (
          <g key={mark.id}>
            {isJb ? (
              <rect
                x={mark.x - size * 0.55}
                y={mark.y - size * 0.55}
                width={size * 1.1}
                height={size * 1.1}
                fill="#92400e"
                fillOpacity={0.5}
                stroke="#ea580c"
                strokeWidth="0.22"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <DeviceFill mark={mark} selected focus markerSize={size} />
            )}
          </g>
        );
      })}
      <GeometryStroke geometry={hoverHighlight} stroke="#0f172a" width="1.6" />
      <GeometryStroke geometry={printedHighlight} stroke="#ea580c" width="2.2" />
      {callouts.conduitLabels.filter((label) => showConduitLabels || label.selected).map((label) => (
        <OverlayLabel key={`conduit-${label.id}`} label={label} fontSize={fontSize} fill={label.selected ? "#0f172a" : "#1e293b"} />
      ))}
      {marks.filter((m) => m.type === "note").map((mark) => (
        <text key={mark.id} x={mark.x} y={mark.y} fontSize={fontSize} fontWeight="800" fill={mark.color || (mark.id === selectedId ? "#ea580c" : "#dc2626")}>{mark.text}</text>
      ))}
      {tool === "scale" && <text x="2" y="6" fontSize={fontSize} fontWeight="800" fill="#b45309">Click a known dimension</text>}
    </svg>
  );
}

function PdfDrawing({ fileBytes, fileName, zoom, pageNumber, onPageNumber, viewportWidth, viewportHeight, onPageInfo, selectedMark }) {
  const canvasRef = useRef(null);
  const focusCanvasRef = useRef(null);
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

        // Keep 8x visual zoom without allocating an 8x full-resolution canvas.
        // Large electrical sheets can otherwise create 100M+ pixel canvases and
        // crash the browser when zooming. Cap the backing store while keeping
        // the CSS display size/pan geometry unchanged.
        const outputScale = pdfBackingScale(
          fitted.width,
          fitted.height,
          window.devicePixelRatio || 1,
          Boolean(window.matchMedia?.("(pointer: coarse)")?.matches),
        );
        const viewport = page.getViewport({ scale: (fitted.width / base.width) * outputScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Unable to allocate a drawing canvas.");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
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

    const renderTimer = window.setTimeout(() => {
      void renderPdf();
    }, 90);
    return () => {
      cancelled = true;
      window.clearTimeout(renderTimer);
      try { renderTask?.cancel(); } catch { /* ignore */ }
    };
  }, [fileBytes, pageNumber, zoom, viewportWidth, viewportHeight]);

  useEffect(() => {
    const source = canvasRef.current;
    const focus = focusCanvasRef.current;
    if (!source || !focus || !selectedMark || (selectedMark.sheet || 1) !== pageNumber || !displaySize.width || !displaySize.height || rendering) return;
    const ctx = focus.getContext("2d");
    const outputScaleX = source.width / displaySize.width;
    const outputScaleY = source.height / displaySize.height;
    const centerX = (Number(selectedMark.x) / 100) * source.width;
    const centerY = (Number(selectedMark.y) / 100) * source.height;
    const sourceCssSize = 42;
    const sw = sourceCssSize * outputScaleX;
    const sh = sourceCssSize * outputScaleY;
    focus.width = 112;
    focus.height = 112;
    ctx.clearRect(0, 0, focus.width, focus.height);
    ctx.clearRect(0, 0, focus.width, focus.height);
    // Lift the actual source pixels from the print. Keep the surrounding context transparent
    // so the selected fixture/symbol itself is what visually comes forward.
    ctx.drawImage(source, centerX - sw / 2, centerY - sh / 2, sw, sh, 0, 0, focus.width, focus.height);
  }, [selectedMark, pageNumber, displaySize, rendering]);

  return (
    <div className="relative bg-white" style={displaySize.width ? { width: displaySize.width, height: displaySize.height } : undefined}>
      {rendering && <div className="absolute inset-x-0 top-2 z-10 mx-auto w-fit rounded-lg bg-background/90 px-3 py-2 text-xs font-semibold shadow">Rendering {fileName}…</div>}
      {error && <div className="absolute inset-x-4 top-16 z-10 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      <canvas ref={canvasRef} className="block bg-white" />
      {selectedMark && (selectedMark.sheet || 1) === pageNumber ? <div className="pointer-events-none absolute z-30" style={{ left: `${selectedMark.x}%`, top: `${selectedMark.y}%`, transform: "translate(-50%, -50%)" }}><div className="rounded-md border-2 border-foreground bg-card p-0.5 shadow-md"><canvas ref={focusCanvasRef} className="block h-16 w-16 bg-white" style={{ imageRendering: "auto" }} /></div></div> : null}
    </div>
  );
}
