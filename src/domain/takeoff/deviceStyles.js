import { isReviewOnlyMark } from "./detectionRecord.js";
import { symbolBodyOutline } from "./legendGeometry.js";
import { isCanDeviceText } from "./symbolDetection.js";
import { circlePaintOutlineFromBody, pointHitsOutline, scaleOutline } from "./vectorSymbols.js";

// Detection color should identify a symbol, not replace the printed symbol
// with a solid block that hides the drawing underneath.
export const DEVICE_FILL_OPACITY = 0.34;
// Fill almost to the printed perimeter so the tint reads as the symbol body
// (PlanSwift-style), while leaving a thin clear ring of black ink outside.
export const DEVICE_INTERIOR_INSET = 0.985;
export const MIN_VISIBLE_FILL = 0.28;
export const MAX_POINT_FILL = 0.55;
export const MAX_FIXTURE_FILL = 1.65;
export const MAX_GENERIC_FILL = 0.95;
export const DEVICE_CHIP_R = 0.16;
export const DEVICE_FILL_STROKE_PX = 1.25;
export const MAX_DISPLAY_POINT_FILL = 0.42;
export const MAX_DISPLAY_FIXTURE_FILL = 0.9;
export const MAX_DISPLAY_GENERIC_FILL = 0.62;
export const MIN_TRUSTED_AI_BODY = 0.06;
export const MAX_TRUSTED_AI_BODY = 2.45;
export const MAX_TRUSTED_FIXTURE_BODY = 3.8;
export const CIRCUIT_COLOR = "#64748b";
export const SELECTED_OUTLINE_SCALE = 1;

export const SCHEDULE_TYPE_COLORS = {
  1: "#1e3a8a",
  "1e": "#2563eb",
  2: "#166534",
  "2e": "#16a34a",
  3: "#991b1b",
  "3e": "#dc2626",
  4: "#7e22ce",
  f: "#d97706",
  os: "#0f766e",
  occ: "#0f766e",
  gfi: "#be185d",
  gfci: "#be185d",
  gfiwp: "#155e75",
  wp: "#854d0e",
  duplex: "#4338ca",
};

const FALLBACK_COLORS = [
  "#0f766e",
  "#4338ca",
  "#be185d",
  "#155e75",
  "#854d0e",
  "#6d28d9",
  "#0369a1",
  "#b45309",
];

/**
 * @param {any} mark
 */
export function isDeviceMark(mark) {
  return mark?.type === "count" || mark?.type === "drop";
}

/**
 * @param {any} mark
 */
export function isCircuitMark(mark) {
  return mark?.tool === "conduit"
    || mark?.tool === "circuit"
    || mark?.type === "homerun"
    || (mark?.type === "route" && mark?.tool !== "polyline");
}

/**
 * @param {any} mark
 * @param {any} trade
 */
export function markBelongsToTrade(mark, trade) {
  if (!mark || !trade) return true;
  // Old saved electrical takeoffs predate the trade field. Preserve those,
  // but never leak a positively identified different trade into the view.
  const markTrade = String(mark.trade || "electrical").toLowerCase();
  return markTrade === String(trade).toLowerCase();
}

/**
 * @param {any} marks
 * @param {any} trade
 */
export function marksForTrade(marks, trade) {
  return (marks || []).filter((mark) => markBelongsToTrade(mark, trade));
}

/**
 * @param {any} marks
 * @param {any} options
 */
export function planOverlayMarks(marks, options = {}) {
  // Review/unknown AI candidates belong in the review queue, never painted on
  // the normal bid drawing. The live interactive sheet still needs pending and
  // accepted review candidates so users can see, select, and correct them.
  const source = marks || [];
  const list = options.interactive
    ? source.filter((mark) => mark?.reviewStatus !== "rejected")
    : source.filter((mark) => !isReviewOnlyMark(mark) && mark?.requiresReview !== true);
  if (options.devicesOnly) return list.filter((mark) => !isCircuitMark(mark));
  if (options.circuitsOnly) return list.filter((mark) => isCircuitMark(mark) || mark?.type === "note");
  if (options.interactive) return list;
  // Device-count sheets stay devices-only. Conduit belongs on conduit/circuit pages
  // or on a takeoff sheet that has no counted devices.
  if (list.some(isDeviceMark)) return list.filter((mark) => !isCircuitMark(mark));
  return list;
}

/**
 * @param {any} mark
 */
export function deviceTypeKey(mark) {
  const raw = String(mark?.typeCode || mark?.abbr || mark?.symbol || "")
    .trim()
    .replace(/^type\s+/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return raw;
}

/**
 * @param {any} key
 */
export function scheduleTypeColor(key) {
  const compact = String(key || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (SCHEDULE_TYPE_COLORS[compact]) return SCHEDULE_TYPE_COLORS[compact];
  if (/^f\d*[a-z]?$/.test(compact)) return SCHEDULE_TYPE_COLORS.f;
  return "";
}

/**
 * @param {any} keys
 */
export function colorMapForDeviceTypes(keys) {
  const map = new Map();
  let fallback = 0;
  for (const key of keys) {
    if (!key || map.has(key)) continue;
    map.set(key, readableFillColor(scheduleTypeColor(key) || FALLBACK_COLORS[fallback % FALLBACK_COLORS.length]));
    if (!scheduleTypeColor(key)) fallback += 1;
  }
  return map;
}

/**
 * @param {any} color
 * @param {any} fallback
 */
export function readableFillColor(color, fallback = FALLBACK_COLORS[0]) {
  const hex = String(color || "").trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return fallback;
  let raw = match[1];
  if (raw.length === 3) raw = raw.split("").map((part) => part + part).join("");
  const n = parseInt(raw, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.88) return fallback;
  if (lum >= 0.72) {
    const mix = 0.62;
    const toHex = (value) => Math.max(0, Math.min(255, Math.round(value * mix))).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return `#${raw.toLowerCase()}`;
}

/**
 * @param {any} marks
 */
export function applyDeviceTypeColors(marks) {
  const list = marks || [];
  const bySheet = new Map();
  for (const mark of list) {
    if (!isDeviceMark(mark) || isReviewOnlyMark(mark)) continue;
    const sheet = mark.sheet || 1;
    if (!bySheet.has(sheet)) bySheet.set(sheet, []);
    bySheet.get(sheet).push(deviceTypeKey(mark));
  }
  const sheetMaps = new Map();
  for (const [sheet, keys] of bySheet.entries()) {
    sheetMaps.set(sheet, colorMapForDeviceTypes(keys));
  }
  return list.map((mark) => {
    if (isCircuitMark(mark)) return { ...mark, color: CIRCUIT_COLOR, layer: "circuit" };
    if (!isDeviceMark(mark)) return mark;
    if (isReviewOnlyMark(mark)) {
      return { ...mark, color: mark.color || "#94a3b8", layer: "review", fillOpacity: DEVICE_FILL_OPACITY };
    }
    const key = deviceTypeKey(mark);
    const color = readableFillColor(
      sheetMaps.get(mark.sheet || 1)?.get(key) || scheduleTypeColor(key) || FALLBACK_COLORS[0],
    );
    return { ...mark, color, layer: "device", fillOpacity: DEVICE_FILL_OPACITY };
  });
}

/**
 * @param {any} marks
 */
export function sheetTypeColorSwatches(marks) {
  const seen = new Map();
  for (const mark of marks || []) {
    if (!isDeviceMark(mark) || isReviewOnlyMark(mark)) continue;
    const key = deviceTypeKey(mark) || "device";
    const color = readableFillColor(mark.color || scheduleTypeColor(key) || FALLBACK_COLORS[0]);
    const current = seen.get(key) || { key, color, count: 0 };
    current.count += 1;
    current.color = color;
    seen.set(key, current);
  }
  return [...seen.values()];
}

/**
 * @param {any} outline
 */
export function outlineExtent(outline) {
  if (!outline) return 0;
  if (outline.kind === "circle") return (Number(outline.r) || 0) * 2;
  if (outline.kind === "composite" && outline.parts?.length) {
    const partMax = Math.max(0, ...outline.parts.map((part) => outlineExtent(part)));
    return Math.max(Number(outline.w) || 0, Number(outline.h) || 0, partMax);
  }
  if (outline.kind === "path" && outline.points?.length >= 2) {
    const xs = outline.points.map((point) => Number(point.x) || 0);
    const ys = outline.points.map((point) => Number(point.y) || 0);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }
  return Math.max(Number(outline.w) || 0, Number(outline.h) || 0);
}

function outlineCenter(outline, origin) {
  if (outline?.kind === "path" && outline.points?.length) {
    const xs = outline.points.map((point) => Number(point.x) || 0);
    const ys = outline.points.map((point) => Number(point.y) || 0);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
  return {
    x: Number(outline?.cx ?? origin?.x),
    y: Number(outline?.cy ?? origin?.y),
  };
}

/**
 * Paint origin for a mark: prefer the measured outline center, then the
 * recorded symbol body, then the mark anchor. Never prefer a printed type
 * tag that sits beside the glyph when body geometry is known.
 * @param {any} mark
 * @param {any} outline
 */
export function paintOrigin(mark, outline = null) {
  const fromOutline = outline ? outlineCenter(outline, null) : null;
  if (fromOutline && Number.isFinite(fromOutline.x) && Number.isFinite(fromOutline.y)) {
    return fromOutline;
  }
  return {
    x: Number(mark?.symbolBodyLocation?.x ?? mark?.x) || 0,
    y: Number(mark?.symbolBodyLocation?.y ?? mark?.y) || 0,
  };
}

function withPaintCenter(outline, origin) {
  if (!outline || !origin) return outline;
  if (Number.isFinite(Number(outline.cx)) && Number.isFinite(Number(outline.cy))) return outline;
  return { ...outline, cx: origin.x, cy: origin.y };
}

function looksLikeAxisAlignedRectPoints(points, outline) {
  const list = (points || []).length === 5 ? points.slice(0, 4) : (points || []);
  if (list.length !== 4) return false;
  const xs = list.map((point) => Number(point.x) || 0);
  const ys = list.map((point) => Number(point.y) || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const tol = 0.03;
  const onCorners = list.every((point) => (
    (Math.abs((Number(point.x) || 0) - minX) <= tol || Math.abs((Number(point.x) || 0) - maxX) <= tol)
    && (Math.abs((Number(point.y) || 0) - minY) <= tol || Math.abs((Number(point.y) || 0) - maxY) <= tol)
  ));
  if (!onCorners) return false;
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 0.04 || h < 0.04) return false;
  if (Number(outline?.w) > 0 && Math.abs(w - Number(outline.w)) > 0.1) return false;
  if (Number(outline?.h) > 0 && Math.abs(h - Number(outline.h)) > 0.1) return false;
  return true;
}

/**
 * Prefer the extracted perimeter: real path/polygon when the CAD points are
 * non-rectangular, circle only for circular geometry, and rect for true
 * rectangular bodies. Never keep an AABB "rect" kind when the stored points
 * describe a non-rectangular symbol body.
 * @param {any} outline
 */
export function preferNativeSymbolGeometry(outline) {
  if (!outline) return null;
  if (outline.kind === "composite" && outline.parts?.length) {
    return {
      ...outline,
      parts: outline.parts.map((part) => preferNativeSymbolGeometry(part)).filter(Boolean),
    };
  }
  if (outline.kind === "circle" || outline.kind === "ellipse") return outline;
  const points = outline.points || [];
  if (points.length >= 3 && outline.kind !== "path") {
    if (outline.kind === "rect" && looksLikeAxisAlignedRectPoints(points, outline)) {
      return outline;
    }
    return { ...outline, kind: "path" };
  }
  return outline;
}

function isOnSheet(x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100;
}

/**
 * @param {any} mark
 */
export function deviceFillBlob(mark) {
  return `${mark?.symbol || ""} ${mark?.symbolLabel || ""} ${mark?.abbr || ""} ${mark?.typeCode || ""}`.toLowerCase();
}

/**
 * @param {any} mark
 */
export function isPointDevice(mark) {
  const blob = deviceFillBlob(mark);
  return isCanDeviceText(blob)
    || /downlight|pendant|occup|sensor|switch|\bos\b|recept|gfci|gfi|duplex|outlet|\br\b|quad/.test(blob);
}

/**
 * @param {any} mark
 */
export function isFixtureDevice(mark) {
  const blob = deviceFillBlob(mark);
  return /2\s*[x×]\s*4|1\s*[x×]\s*4|2\s*[x×]\s*2|troffer|fixture/.test(blob);
}

/**
 * @param {any} mark
 */
export function maxFillExtent(mark) {
  if (isFixtureDevice(mark)) return MAX_FIXTURE_FILL;
  if (isPointDevice(mark)) return MAX_POINT_FILL;
  return MAX_GENERIC_FILL;
}

/**
 * Upper bound for measured AI paint. Point devices (cans/OS/GFI) keep their
 * extracted perimeter up to ~1.05 so the tint fills the printed symbol; larger
 * scraps still shrink. Fixtures keep the troffer cap.
 * @param {any} mark
 */
export function aiPaintExtentCap(mark) {
  if (isFixtureDevice(mark)) return MAX_FIXTURE_FILL;
  if (isPointDevice(mark)) return 1.05;
  return MAX_GENERIC_FILL;
}

/**
 * @param {any} outline
 * @param {any} origin
 * @param {any} maxExtent
 */
export function isUsablePaintOutline(outline, origin, maxExtent = MAX_GENERIC_FILL) {
  if (!outline) return false;
  if (outline.kind === "path" && (outline.points || []).length < 3) return false;
  if (outline.kind === "composite" && !(outline.parts || []).length) return false;
  const extent = outlineExtent(outline);
  if (extent < 0.14 || extent > maxExtent) return false;
  const center = outlineCenter(outline, origin);
  if (!isOnSheet(center.x, center.y)) return false;
  if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
    if (Math.hypot(center.x - origin.x, center.y - origin.y) > 0.95) return false;
  }
  return true;
}

/**
 * @param {any} mark
 */
export function trustedAiBodyMax(mark) {
  if (isFixtureDevice(mark)) return MAX_TRUSTED_FIXTURE_BODY;
  if (isPointDevice(mark)) return MAX_TRUSTED_AI_BODY;
  return 2.8;
}

/**
 * @param {any} outline
 * @param {any} origin
 * @param {any} mark
 */
export function isTrustedAiBodyOutline(outline, origin, mark) {
  if (!outline) return false;
  if (outline.kind === "path" && (outline.points || []).length < 3) return false;
  if (outline.kind === "composite" && !(outline.parts || []).length) return false;
  const extent = outlineExtent(outline);
  if (extent < MIN_TRUSTED_AI_BODY || extent > trustedAiBodyMax(mark)) return false;
  const center = outlineCenter(outline, origin);
  if (!isOnSheet(center.x, center.y)) return false;
  if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
    if (Math.hypot(center.x - origin.x, center.y - origin.y) > 0.95) return false;
  }
  return true;
}

function coreDeviceOutline(outline, origin, mark) {
  if (!outline || outline.kind !== "composite" || !(outline.parts || []).length) return null;
  const ranked = [...outline.parts]
    .map((part) => ({ part, extent: outlineExtent(part) }))
    .filter((item) => item.extent >= 0.12 && item.extent <= trustedAiBodyMax(mark))
    .sort((a, b) => b.extent - a.extent);
  const best = ranked[0]?.part;
  if (!best) return null;
  const cx = Number(best.cx ?? outline.cx ?? origin?.x);
  const cy = Number(best.cy ?? outline.cy ?? origin?.y);
  return {
    ...best,
    cx,
    cy,
    source: best.source || outline.source || "vector",
  };
}

function genericDeviceOutline(mark, markerSize = 0.55) {
  const scale = Math.min(1.15, Math.max(0.7, Number(markerSize) || 0.55) / 0.55);
  const blob = deviceFillBlob(mark);
  const aiPointRadius = mark?.source === "ai" ? 0.46 * scale : DEVICE_CHIP_R * scale;
  if (isCanDeviceText(blob) || /downlight|pendant|high bay|low bay|occup|sensor|switch|\bos\b/.test(blob)) {
    return { kind: "circle", r: aiPointRadius };
  }
  if (/recept|gfci|gfi|duplex|outlet|\br\b|quad/.test(blob)) {
    return { kind: "circle", r: mark?.source === "ai" ? 0.46 * scale : 0.18 * scale };
  }
  const size = blob.match(/(\d)\s*[x×]\s*(\d)/);
  if (size) {
    const a = Number(size[1]);
    const b = Number(size[2]);
    const long = Math.max(a, b);
    const short = Math.min(a, b);
    return {
      kind: "rect",
      w: Math.min(MAX_FIXTURE_FILL, 0.28 * long * scale),
      h: Math.min(MAX_FIXTURE_FILL * 0.7, 0.24 * short * scale),
    };
  }
  return { kind: "circle", r: DEVICE_CHIP_R * scale };
}

function paintTokensForMark(mark) {
  const tag = mark?.circuitTagLocation;
  if (!tag || !Number.isFinite(Number(tag.x)) || !Number.isFinite(Number(tag.y))) return [];
  const body = mark?.symbolBodyLocation;
  if (body && Math.hypot(Number(body.x) - Number(tag.x), Number(body.y) - Number(tag.y)) <= 0.2) return [];
  return [{ text: String(tag.text || "5"), x: Number(tag.x), y: Number(tag.y) }];
}

function outlineOnPrintedTag(outline, mark) {
  const tokens = paintTokensForMark(mark);
  if (!tokens.length) return false;
  const center = outlineCenter(outline, { x: mark?.x, y: mark?.y });
  return tokens.some((token) => (
    Math.hypot(center.x - token.x, center.y - token.y) <= 0.22
    && outlineExtent(outline) <= 0.42
  ));
}

/**
 * Keep circle percent extents for ellipse rendering. Never collapse w/h to a
 * single radius — that creates universal ovals on landscape sheets.
 * @param {any} outline
 */
export function normalizeCirclePaintExtents(outline) {
  if (!outline || (outline.kind !== "circle" && outline.kind !== "ellipse")) return outline;
  const w = Number(outline.w);
  const h = Number(outline.h);
  const r = Number(outline.r);
  if (w > 0 && h > 0) {
    return { ...outline, kind: "circle", w, h, r: r > 0 ? r : Math.max(w, h) / 2 };
  }
  if (r > 0) return { ...outline, kind: "circle", r, w: r * 2, h: r * 2 };
  return outline;
}

/**
 * Radii for SVG ellipse fills in page-percent space. Prefer measured w/h so a
 * PDF circle stays circular on screen under preserveAspectRatio="none".
 * @param {any} outline
 */
export function ellipseRadiiFromOutline(outline) {
  const w = Number(outline?.w);
  const h = Number(outline?.h);
  const r = Number(outline?.r);
  if (w > 0 && h > 0) return { rx: w / 2, ry: h / 2 };
  if (r > 0) return { rx: r, ry: r };
  return { rx: DEVICE_CHIP_R, ry: DEVICE_CHIP_R };
}

/**
 * @param {any} mark
 * @param {any} outline
 */
function perimeterForMark(mark, outline) {
  if (!outline) return null;
  if (outline.kind === "circle" || outline.kind === "ellipse") {
    return normalizeCirclePaintExtents(outline);
  }
  // Rectangular fixtures keep rect/path fills. Point/can devices may promote
  // only when the measured body itself looks circular — never a forced oval.
  if (!isPointDevice(mark) && !isCanDeviceText(deviceFillBlob(mark))) return outline;
  if (outline.kind === "rect" || outline.kind === "path" || outline.kind === "composite") {
    const promoted = circlePaintOutlineFromBody({
      ...outline,
      cx: outline.cx ?? mark?.symbolBodyLocation?.x ?? mark?.x,
      cy: outline.cy ?? mark?.symbolBodyLocation?.y ?? mark?.y,
      source: outline.source || mark?.outlineSource,
    }, null);
    return promoted ? normalizeCirclePaintExtents(promoted) : outline;
  }
  return outline;
}

export function deviceOutline(mark, markerSize = 0.55, _options = {}) {
  const rawCleaned = mark?.outline
    ? symbolBodyOutline({ ...mark.outline, outline: mark.outline, cx: mark.outline.cx ?? mark.x, cy: mark.outline.cy ?? mark.y }, paintTokensForMark(mark))
    : null;
  const cleaned = preferNativeSymbolGeometry(rawCleaned);
  const origin = {
    x: Number(cleaned?.cx ?? mark?.symbolBodyLocation?.x ?? mark?.x) || 0,
    y: Number(cleaned?.cy ?? mark?.symbolBodyLocation?.y ?? mark?.y) || 0,
  };
  const maxExtent = maxFillExtent(mark);
  const source = String(cleaned?.source || mark?.outline?.source || mark?.outlineSource || "").toLowerCase();
  const trustedAiSource = source === "vector" || source === "raster" || source === "mixed";
  const usable = cleaned && isUsablePaintOutline(cleaned, origin, maxExtent) && !outlineOnPrintedTag(cleaned, mark);

  // Text-only placements (outlineSource=text) never invent a paint body — the
  // printed tag is the locator, not a fabricated circle/rect fill.
  if (source === "text" || (!cleaned && String(mark?.outlineSource || "").toLowerCase() === "text")) {
    return null;
  }

  if (mark?.source === "ai") {
    // AI may paint only a measured vector/raster/mixed perimeter. Never invent
    // a chip for text-only or missing geometry (strictAiSymbolPainting).
    if (!trustedAiSource || !mark?.outline) return null;
    // Keep the measured perimeter up to aiPaintExtentCap. Shrinking cans to
    // MAX_POINT_FILL left tiny chips inside the printed symbol.
    // Native vector/raster perimeter is authoritative once it passes the trusted\n    // symbol-body bounds. Do not shrink every valid fixture into a small chip.\n    const aiCap = trustedAiBodyMax(mark);
    const core = isTrustedAiBodyOutline(cleaned, origin, mark)
      ? cleaned
      : preferNativeSymbolGeometry(coreDeviceOutline(cleaned, origin, mark));
    if (core && !outlineOnPrintedTag(core, mark) && isTrustedAiBodyOutline(core, origin, mark)) {
      const painted = perimeterForMark(mark, core);
      const extent = outlineExtent(painted);
      return extent > aiCap ? scaleOutline(painted, aiCap / extent, origin) : scaleOutline(painted, 1, origin);
    }
    if (usable) {
      const painted = perimeterForMark(mark, cleaned);
      const extent = outlineExtent(painted);
      return extent > aiCap ? scaleOutline(painted, aiCap / extent, origin) : scaleOutline(painted, 1, origin);
    }
    return null;
  }

  if (usable) {
    const painted = scaleOutline(cleaned, 1, origin);
    const extent = outlineExtent(painted);
    if (isPointDevice(mark) && extent > 0 && extent < MIN_VISIBLE_FILL) {
      return scaleOutline(painted, MIN_VISIBLE_FILL / extent, origin);
    }
    return painted;
  }

  // Generic shapes are reserved for intentional manual marks only.
  return genericDeviceOutline(mark, markerSize);
}

/**
 * @param {any} mark
 * @param {any} markerSize
 * @param {any} options
 */
export function displayDeviceOutline(mark, markerSize = 0.55, options = {}) {
  const outline = deviceOutline(mark, markerSize, options);
  if (!outline) {
    // Never invent a generic chip for AI — uncertain boundaries stay unpainted
    // and go to review. Hit-testing uses a separate locator radius.
    return null;
  }
  const extent = outlineExtent(outline);
  const origin = paintOrigin(mark, outline);
  const centered = withPaintCenter(outline, origin);
  if (!extent) return centered;
  // Measured AI geometry must stay at or under the detected perimeter. Inflating
  // tiny glyphs past the CAD ink was painting purple/green fills outside cans.
  if (mark?.source === "ai") {
    const aiMax = trustedAiBodyMax(mark);
    if (extent <= aiMax) return centered;
    return withPaintCenter(scaleOutline(centered, aiMax / extent, origin), origin);
  }
  const displayMax = isFixtureDevice(mark)
    ? MAX_DISPLAY_FIXTURE_FILL
    : isPointDevice(mark) ? MAX_DISPLAY_POINT_FILL : MAX_DISPLAY_GENERIC_FILL;
  if (extent < MIN_VISIBLE_FILL) return withPaintCenter(scaleOutline(centered, MIN_VISIBLE_FILL / extent, origin), origin);
  if (extent <= displayMax) return centered;
  return withPaintCenter(scaleOutline(centered, displayMax / extent, origin), origin);
}

/**
 * Interior tint used on the live plan. Always inset from the measured body so
 * color sits inside the black symbol boundary, never on or past the ink.
 * @param {any} mark
 * @param {any} markerSize
 * @param {any} options
 */
export function paintDeviceOutline(mark, markerSize = 0.55, options = {}) {
  const measured = displayDeviceOutline(mark, markerSize, options);
  if (!measured) return null;
  const inset = Number(mark?.fillInset);
  const factor = Number.isFinite(inset) && inset > 0
    ? inset
    : (mark?.source === "ai" ? DEVICE_INTERIOR_INSET : Math.max(DEVICE_INTERIOR_INSET, 0.86));
  return interiorDeviceOutline(measured, factor);
}

/**
 * True when an AI device has no trustworthy paint perimeter and must be
 * reviewed rather than filled with a fabricated chip.
 * @param {any} mark
 */
export function markHasUncertainPaintBoundary(mark) {
  if (!isDeviceMark(mark) || mark?.source !== "ai") return false;
  return !paintDeviceOutline(mark);
}

function pointerDistance(mark, point) {
  const x = Number(mark?.symbolBodyLocation?.x ?? mark?.x) || 0;
  const y = Number(mark?.symbolBodyLocation?.y ?? mark?.y) || 0;
  return Math.hypot((point?.x || 0) - x, (point?.y || 0) - y);
}

function routePointerDistance(mark, point) {
  const points = mark?.points || [];
  if (points.length < 2) return pointerDistance(mark, point);
  let best = Infinity;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)));
  }
  return best;
}

/**
 * @param {any} mark
 * @param {any} point
 * @param {any} markerSize
 */
export function hitTestDeviceFill(mark, point, markerSize = 0.55) {
  if (!mark || !point) return false;
  const outline = displayDeviceOutline(mark, markerSize);
  if (outline) {
    const tolerance = mark?.source === "ai"
      ? Math.max(0.45, (Number(markerSize) || 0.55) * 0.7)
      : 0.28;
    return pointHitsOutline(outline, { x: mark.symbolBodyLocation?.x ?? mark.x, y: mark.symbolBodyLocation?.y ?? mark.y }, point, tolerance);
  }
  // Text-located / uncertain AI stays selectable near the printed tag without
  // painting a fabricated body over the sheet.
  if (mark?.source === "ai" && isDeviceMark(mark)) {
    const radius = Math.max(0.35, (Number(markerSize) || 0.55) * 0.55);
    const x = Number(mark?.x) || 0;
    const y = Number(mark?.y) || 0;
    return Math.hypot((Number(point.x) || 0) - x, (Number(point.y) || 0) - y) <= radius;
  }
  return false;
}

/**
 * @param {any} marks
 * @param {any} point
 * @param {any} options
 */
export function selectMarkAtPoint(marks, point, options = {}) {
  const aspect = options.aspect || 1;
  const markerSizeFor = typeof options.markerSize === "function"
    ? options.markerSize
    : () => (options.markerSize || 0.55);
  const hitRoute = options.hitRoute;
  const list = marks || [];
  const devices = list.filter((mark) => isDeviceMark(mark) && hitTestDeviceFill(mark, point, markerSizeFor(mark)));
  if (devices.length) {
    devices.sort((a, b) => pointerDistance(a, point) - pointerDistance(b, point));
    return devices[0];
  }
  if (!hitRoute) return null;
  const routes = list.filter((mark) => !isDeviceMark(mark) && hitRoute(mark, point, aspect));
  if (!routes.length) return null;
  routes.sort((a, b) => routePointerDistance(a, point) - routePointerDistance(b, point));
  return routes[0];
}

/**
 * @param {any} points
 * @param {any} pad
 */
export function shortenCircuitPath(points, pad = 0.55) {
  const list = points || [];
  if (list.length < 2) return list;
  return list.map((point, index) => {
    if (index === list.length - 1) return point;
    const next = list[index + 1];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const len = Math.hypot(dx, dy) || 1;
    const pull = Math.min(pad, len * 0.35);
    return { x: point.x + (dx / len) * pull, y: point.y + (dy / len) * pull };
  });
}


/**
 * @param {any} outline
 * @param {any} factor
 */
export function interiorDeviceOutline(outline, factor = DEVICE_INTERIOR_INSET) {
  if (!outline) return null;
  const f = Math.max(0.45, Math.min(1, Number(factor) || DEVICE_INTERIOR_INSET));
  if (outline.kind === "composite" && outline.parts?.length) {
    const areas = outline.parts.map((part) => {
      const w = Number(part.w) || (Number(part.r) || 0) * 2;
      const h = Number(part.h) || (Number(part.r) || 0) * 2;
      return Math.max(0, w * h);
    });
    const maxArea = Math.max(...areas, 0);
    const bodyParts = outline.parts.filter((part, index) => {
      if (!maxArea) return true;
      const area = areas[index];
      const w = Number(part.w) || (Number(part.r) || 0) * 2;
      const h = Number(part.h) || (Number(part.r) || 0) * 2;
      const aspect = Math.max(w, h) / Math.max(0.001, Math.min(w, h));
      // Keep the enclosing body and other substantial regions, but do not
      // paint thin internal slashes/hatches/cross-lines over the black symbol.
      return area >= maxArea * 0.42 && aspect <= 4.2;
    });
    return {
      ...outline,
      parts: (bodyParts.length ? bodyParts : [outline.parts[areas.indexOf(maxArea)]])
        .map((part) => interiorDeviceOutline(part, f))
        .filter(Boolean),
    };
  }
  if (outline.kind === "circle" || outline.kind === "ellipse") {
    const r0 = Number(outline.r) || Math.max(Number(outline.w) || 0, Number(outline.h) || 0) / 2;
    const w0 = Number(outline.w) > 0 ? Number(outline.w) : r0 * 2;
    const h0 = Number(outline.h) > 0 ? Number(outline.h) : r0 * 2;
    return {
      ...outline,
      kind: "circle",
      r: Math.max(0.02, r0 * f),
      w: Math.max(0.04, w0 * f),
      h: Math.max(0.04, h0 * f),
    };
  }
  if (outline.kind === "path" && outline.points?.length >= 3) {
    const cx = Number.isFinite(outline.cx)
      ? outline.cx
      : outline.points.reduce((sum, point) => sum + (Number(point.x) || 0), 0) / outline.points.length;
    const cy = Number.isFinite(outline.cy)
      ? outline.cy
      : outline.points.reduce((sum, point) => sum + (Number(point.y) || 0), 0) / outline.points.length;
    return {
      ...outline,
      points: outline.points.map((point) => ({
        x: cx + ((Number(point.x) || 0) - cx) * f,
        y: cy + ((Number(point.y) || 0) - cy) * f,
      })),
    };
  }
  return {
    ...outline,
    w: Math.max(0.02, (Number(outline.w) || 0) * f),
    h: Math.max(0.02, (Number(outline.h) || 0) * f),
  };
}

/**
 * @param {any} mark
 */
export function deviceFillEnabled(mark) {
  return mark?.fillEnabled !== false && mark?.fillMode !== "off";
}
