import { geometrySimilarity } from "./legendGeometry.js";
import { pdfBackingScale } from "./pdfBackingScale.js";
import { isWallOrArchitecturalMark } from "./vectorSymbols.js";
import { TAKEOFF_MAX_ZOOM, TAKEOFF_MIN_ZOOM, sheetPinchZoom, sheetZoomAboutPoint } from "../../lib/sheetViewport.js";

export { isWallOrArchitecturalMark };

export const LARGE_PLAN_BYTES = 28 * 1024 * 1024;
export const PHYSICAL_SYMBOL_RADIUS = 0.28;

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1, n);
}

/**
 * @param {any} page
 */
export function isScannedOrSparsePage(page) {
  if (!page) return false;
  if (page.scanned === true || page.kind === "scan" || page.forceRaster === true) return true;
  const paths = (page.paths || []).length;
  const tokens = (page.tokens || []).length;
  return paths < 8 && tokens < 12;
}

/**
 * @param {any} file
 * @param {any} options
 */
export function drawingProcessingPlan(file = {}, options = {}) {
  const size = Number(file?.size ?? options.byteLength ?? 0) || 0;
  const mime = String(file?.type || options.mime || "").toLowerCase();
  const scanned = options.scanned === true
    || mime.startsWith("image/")
    || options.imageOnlyPdf === true;
  return {
    largePlan: size >= LARGE_PLAN_BYTES,
    scanned,
    includeRaster: scanned || size >= LARGE_PLAN_BYTES,
    yieldEveryPage: true,
    chunkRead: size >= LARGE_PLAN_BYTES,
    rasterReason: scanned ? "scanned-or-image" : size >= LARGE_PLAN_BYTES ? "large-plan" : "",
  };
}

/**
 * @param {any} candidate
 * @param {any} prototype
 * @param {any} options
 */
export function legendGraphicMatch(candidate, prototype, options = {}) {
  if (!candidate || !prototype) return 0;
  const score = Number(geometrySimilarity(candidate, prototype)) || 0;
  const longA = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const longB = Math.max(Number(prototype.w) || 0, Number(prototype.h) || 0);
  const sizeRatio = longA && longB ? Math.max(longA, longB) / Math.min(longA, longB) : 99;
  const sizeOk = sizeRatio <= (Number(options.maxSizeRatio) || 2.15);
  return sizeOk ? score : score * 0.35;
}

/**
 * @param {any} seed
 * @param {any} candidates
 * @param {any} options
 */
export function assembleOverlappingSymbol(seed, candidates = [], options = {}) {
  if (!seed) return null;
  const joinGap = Number(options.joinGap) > 0 ? Number(options.joinGap) : 0.22;
  const maxSpan = Number(options.maxSpan) > 0 ? Number(options.maxSpan) : 2.2;
  const parts = [seed];
  for (const other of candidates || []) {
    if (!other || other === seed || parts.includes(other)) continue;
    const dist = Math.hypot((other.cx || 0) - seed.cx, (other.cy || 0) - seed.cy);
    const gap = dist - ((Math.max(Number(seed.w) || 0, Number(seed.h) || 0) + Math.max(Number(other.w) || 0, Number(other.h) || 0)) / 4);
    if (gap > joinGap) continue;
    const w = Math.max((seed.cx || 0) + (Number(seed.w) || 0) / 2, (other.cx || 0) + (Number(other.w) || 0) / 2)
      - Math.min((seed.cx || 0) - (Number(seed.w) || 0) / 2, (other.cx || 0) - (Number(other.w) || 0) / 2);
    const h = Math.max((seed.cy || 0) + (Number(seed.h) || 0) / 2, (other.cy || 0) + (Number(other.h) || 0) / 2)
      - Math.min((seed.cy || 0) - (Number(seed.h) || 0) / 2, (other.cy || 0) - (Number(other.h) || 0) / 2);
    if (Math.max(w, h) > maxSpan) continue;
    parts.push(other);
  }
  const minX = Math.min(...parts.map((part) => (part.cx || 0) - (Number(part.w) || 0) / 2));
  const maxX = Math.max(...parts.map((part) => (part.cx || 0) + (Number(part.w) || 0) / 2));
  const minY = Math.min(...parts.map((part) => (part.cy || 0) - (Number(part.h) || 0) / 2));
  const maxY = Math.max(...parts.map((part) => (part.cy || 0) + (Number(part.h) || 0) / 2));
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX,
    h: maxY - minY,
    kind: parts.length > 1 ? "composite" : seed.kind || "rect",
    source: seed.source || "vector",
    parts,
  };
}

/**
 * @param {any} candidate
 * @param {any} options
 */
export function rasterCandidateSurvivesNoise(candidate, options = {}) {
  if (!candidate) return false;
  const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const short = Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const minLong = Number(options.minLong) || 0.16;
  const maxLong = Number(options.maxLong) || 3.4;
  const minShort = Number(options.minShort) || 0.06;
  if (long < minLong || long > maxLong || short < minShort) return false;
  if (long / (short || 0.01) > 8) return false;
  return true;
}

/**
 * @param {Record<string, any>} visual
 */
export function classifyAiEvidence({ visual = 0, legend = 0, context = 0 } = {}) {
  const v = clamp01(visual);
  const l = clamp01(legend);
  const c = clamp01(context);
  const combined = v * 0.42 + l * 0.38 + c * 0.20;
  const sources = [v >= 0.72, l >= 0.72, c >= 0.55].filter(Boolean).length;
  let decision = "reject";
  if (combined >= 0.82 && sources >= 2) decision = "accept";
  else if (combined >= 0.40 && sources >= 1) decision = "review";
  return { decision, combined, sources, visual: v, legend: l, context: c };
}

/**
 * @param {any} outline
 * @param {any} tokens
 */
export function outlineExcludesAdjacentAnnotation(outline, tokens = []) {
  if (!outline) return null;
  const cx = Number(outline.cx ?? outline.x) || 0;
  const cy = Number(outline.cy ?? outline.y) || 0;
  const w = Number(outline.w) || 0;
  const h = Number(outline.h) || 0;
  const number = (tokens || []).find((token) => {
    const text = String(token?.text || "").trim();
    if (!/^\d{1,3}[A-Z]?$/.test(text)) return false;
    const dx = Math.abs((Number(token.x) || 0) - cx);
    const dy = Math.abs((Number(token.y) || 0) - cy);
    return dx <= w / 2 + 0.55 && dy <= h / 2 + 0.55 && (dx > w / 2 * 0.35 || dy > h / 2 * 0.35);
  });
  if (!number) return outline;
  const nx = Number(number.x) || 0;
  const ny = Number(number.y) || 0;
  if (Math.hypot(nx - cx, ny - cy) < 0.12) return outline;
  return {
    ...outline,
    cx,
    cy,
    w,
    h,
    excludedAnnotation: { x: nx, y: ny, text: String(number.text) },
  };
}

/**
 * @param {any} mark
 */
export function evidenceScore(mark) {
  return Math.max(
    Number(mark?.combinedConfidence) || 0,
    Number(mark?.visualMatchScore) || 0,
    Number(mark?.legendMatchScore) || 0,
    Number(mark?.vectorMatchScore) || 0,
    mark?.reviewStatus === "accepted" ? 0.8 : 0,
  );
}

function labelAttachmentScore(mark) {
  if (mark?.labelLocation) return 2;
  if (mark?.matchedFrom === "legend" || mark?.matchedFrom === "drawing") return 1;
  return 0;
}

/**
 * @param {any} marks
 * @param {any} radius
 */
export function dedupePhysicalSymbols(marks = [], radius = PHYSICAL_SYMBOL_RADIUS) {
  const kept = [];
  for (const mark of marks || []) {
    if (!mark || (mark.type !== "count" && mark.type !== "drop")) {
      kept.push(mark);
      continue;
    }
    const index = kept.findIndex((other) => {
      if (!other || (other.type !== "count" && other.type !== "drop")) return false;
      if (other.sheet !== mark.sheet) return false;
      const sameId = (other.symbol && mark.symbol && other.symbol === mark.symbol)
        || (other.typeCode && mark.typeCode && String(other.typeCode).toUpperCase() === String(mark.typeCode).toUpperCase());
      if (!sameId) return false;
      return Math.hypot((other.x || 0) - (mark.x || 0), (other.y || 0) - (mark.y || 0)) < radius;
    });
    if (index < 0) {
      kept.push(mark);
      continue;
    }
    const incoming = evidenceScore(mark) + labelAttachmentScore(mark) * 0.05;
    const existing = evidenceScore(kept[index]) + labelAttachmentScore(kept[index]) * 0.05;
    if (incoming > existing) kept[index] = mark;
  }
  return kept;
}

/**
 * @param {Record<string, any>} width
 */
export function takeoffPerformanceBudget({
  width = 2592,
  height = 1944,
  pathCount = 0,
  zoom = 1,
  memoryMb = 0,
  coarsePointer = false,
} = {}) {
  const renderScale = pdfBackingScale(width, height, coarsePointer ? 2 : 2, coarsePointer);
  const rasterBudget = coarsePointer ? 2_200_000 : 4_500_000;
  const rasterScale = Math.min(1.35, Math.sqrt(rasterBudget / (width * height)));
  const renderPixels = width * renderScale * height * renderScale;
  const rasterPixels = width * rasterScale * height * rasterScale;
  const pathOk = pathCount <= 25_000;
  const zoomOk = zoom >= TAKEOFF_MIN_ZOOM && zoom <= TAKEOFF_MAX_ZOOM;
  const memOk = memoryMb <= 180;
  const pixelOk = renderPixels <= (coarsePointer ? 6_000_000 : 16_000_000) + 1
    && rasterPixels <= (coarsePointer ? 2_200_000 : 4_500_000) + 1;
  return {
    ok: pathOk && zoomOk && memOk && pixelOk,
    pathOk,
    zoomOk,
    memOk,
    pixelOk,
    renderScale,
    rasterScale,
  };
}

/**
 * @param {any} start
 */
export function stressZoomPan(start = { zoom: 1, pan: { x: 0, y: 0 } }) {
  const viewportRect = { left: 0, top: 0, width: 1200, height: 800 };
  let state = { ...start, pan: { ...start.pan } };
  const hops = [
    { nextZoom: sheetPinchZoom(state.zoom, 80, 160, TAKEOFF_MIN_ZOOM, TAKEOFF_MAX_ZOOM), focus: { x: 400, y: 300 } },
    { nextZoom: sheetPinchZoom(state.zoom, 160, 40, TAKEOFF_MIN_ZOOM, TAKEOFF_MAX_ZOOM), focus: { x: 900, y: 500 } },
    { nextZoom: 3.5, focus: { x: 200, y: 200 } },
  ];
  for (const hop of hops) {
    state = sheetZoomAboutPoint({
      zoom: state.zoom,
      nextZoom: hop.nextZoom,
      pan: state.pan,
      focusClient: hop.focus,
      viewportRect,
    });
  }
  const finite = Number.isFinite(state.zoom) && Number.isFinite(state.pan.x) && Number.isFinite(state.pan.y);
  return { ...state, ok: finite && state.zoom >= TAKEOFF_MIN_ZOOM && state.zoom <= TAKEOFF_MAX_ZOOM };
}
