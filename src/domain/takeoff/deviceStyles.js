import { isReviewOnlyMark } from "./detectionRecord.js";
import { symbolBodyOutline } from "./legendGeometry.js";
import { isCanDeviceText } from "./symbolDetection.js";
import { pointHitsOutline, scaleOutline } from "./vectorSymbols.js";

// Detection color should identify a symbol, not replace the printed symbol
// with a solid block that hides the drawing underneath.
export const DEVICE_FILL_OPACITY = 0.34;
export const DEVICE_INTERIOR_INSET = 0.86;
export const MIN_VISIBLE_FILL = 0.28;
export const MAX_POINT_FILL = 0.55;
export const MAX_FIXTURE_FILL = 1.65;
export const MAX_GENERIC_FILL = 0.95;
export const DEVICE_CHIP_R = 0.16;
export const DEVICE_FILL_STROKE_PX = 1.25;
export const MAX_DISPLAY_POINT_FILL = 0.42;
export const MAX_DISPLAY_FIXTURE_FILL = 0.9;
export const MAX_DISPLAY_GENERIC_FILL = 0.62;
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

export function isDeviceMark(mark) {
  return mark?.type === "count" || mark?.type === "drop";
}

export function isCircuitMark(mark) {
  return mark?.tool === "conduit"
    || mark?.tool === "circuit"
    || mark?.type === "homerun"
    || (mark?.type === "route" && mark?.tool !== "polyline");
}

export function markBelongsToTrade(mark, trade) {
  if (!mark || !trade) return true;
  // Old saved electrical takeoffs predate the trade field. Preserve those,
  // but never leak a positively identified different trade into the view.
  const markTrade = String(mark.trade || "electrical").toLowerCase();
  return markTrade === String(trade).toLowerCase();
}

export function marksForTrade(marks, trade) {
  return (marks || []).filter((mark) => markBelongsToTrade(mark, trade));
}

export function planOverlayMarks(marks, options = {}) {
  // Review/unknown AI candidates belong in the review queue, never painted on
  // the normal bid drawing.
  const list = (marks || []).filter((mark) => !isReviewOnlyMark(mark));
  if (options.devicesOnly) return list.filter((mark) => !isCircuitMark(mark));
  if (options.circuitsOnly) return list.filter((mark) => isCircuitMark(mark) || mark?.type === "note");
  // Device-count sheets stay devices-only. Conduit belongs on conduit/circuit pages
  // or on a takeoff sheet that has no counted devices.
  if (list.some(isDeviceMark)) return list.filter((mark) => !isCircuitMark(mark));
  return list;
}

export function deviceTypeKey(mark) {
  const raw = String(mark?.typeCode || mark?.abbr || mark?.symbol || "")
    .trim()
    .replace(/^type\s+/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return raw;
}

export function scheduleTypeColor(key) {
  const compact = String(key || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (SCHEDULE_TYPE_COLORS[compact]) return SCHEDULE_TYPE_COLORS[compact];
  if (/^f\d*[a-z]?$/.test(compact)) return SCHEDULE_TYPE_COLORS.f;
  return "";
}

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

function isOnSheet(x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100;
}

export function deviceFillBlob(mark) {
  return `${mark?.symbol || ""} ${mark?.symbolLabel || ""} ${mark?.abbr || ""} ${mark?.typeCode || ""}`.toLowerCase();
}

export function isPointDevice(mark) {
  const blob = deviceFillBlob(mark);
  return isCanDeviceText(blob)
    || /downlight|pendant|occup|sensor|switch|\bos\b|recept|gfci|gfi|duplex|outlet|\br\b|quad/.test(blob);
}

export function isFixtureDevice(mark) {
  const blob = deviceFillBlob(mark);
  return /2\s*[x×]\s*4|1\s*[x×]\s*4|2\s*[x×]\s*2|troffer|fixture/.test(blob);
}

export function maxFillExtent(mark) {
  if (isFixtureDevice(mark)) return MAX_FIXTURE_FILL;
  if (isPointDevice(mark)) return MAX_POINT_FILL;
  return MAX_GENERIC_FILL;
}

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

function genericDeviceOutline(mark, markerSize = 0.55) {
  const scale = Math.min(1.15, Math.max(0.7, Number(markerSize) || 0.55) / 0.55);
  const blob = deviceFillBlob(mark);
  if (isCanDeviceText(blob) || /downlight|pendant|high bay|low bay|occup|sensor|switch|\bos\b/.test(blob)) {
    return { kind: "circle", r: DEVICE_CHIP_R * scale };
  }
  if (/recept|gfci|gfi|duplex|outlet|\br\b|quad/.test(blob)) {
    return { kind: "circle", r: 0.18 * scale };
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

export function deviceOutline(mark, markerSize = 0.55, _options = {}) {
  const cleaned = mark?.outline
    ? symbolBodyOutline({ ...mark.outline, outline: mark.outline, cx: mark.outline.cx ?? mark.x, cy: mark.outline.cy ?? mark.y }, paintTokensForMark(mark))
    : null;
  const origin = {
    x: Number(cleaned?.cx ?? mark?.symbolBodyLocation?.x ?? mark?.x) || 0,
    y: Number(cleaned?.cy ?? mark?.symbolBodyLocation?.y ?? mark?.y) || 0,
  };
  const maxExtent = maxFillExtent(mark);
  const source = String(cleaned?.source || mark?.outline?.source || mark?.outlineSource || "").toLowerCase();
  const trustedAiSource = source === "vector" || source === "raster" || source === "mixed";
  const usable = cleaned && isUsablePaintOutline(cleaned, origin, maxExtent) && !outlineOnPrintedTag(cleaned, mark);

  if (mark?.source === "ai") {
    // AI may paint only the measured symbol body, never a circuit/type number.
    if (!trustedAiSource || !usable) return null;
    return scaleOutline(cleaned, 1, origin);
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

export function displayDeviceOutline(mark, markerSize = 0.55, options = {}) {
  const outline = deviceOutline(mark, markerSize, options);
  if (!outline) {
    // Never paint an invented dot for an AI detection. If the actual printed
    // symbol body cannot be recovered, keep the item for review instead of
    // coloring a nearby type/circuit number.
    return null;
  }
  const displayMax = isFixtureDevice(mark)
    ? MAX_DISPLAY_FIXTURE_FILL
    : isPointDevice(mark) ? MAX_DISPLAY_POINT_FILL : MAX_DISPLAY_GENERIC_FILL;
  const extent = outlineExtent(outline);
  const origin = {
    x: Number(mark?.symbolBodyLocation?.x ?? mark?.x) || 0,
    y: Number(mark?.symbolBodyLocation?.y ?? mark?.y) || 0,
  };
  if (!extent) return outline;
  if (extent < MIN_VISIBLE_FILL) return scaleOutline(outline, MIN_VISIBLE_FILL / extent, origin);
  if (extent <= displayMax) return outline;
  return scaleOutline(outline, displayMax / extent, origin);
}

export function hitTestDeviceFill(mark, point, markerSize = 0.55) {
  if (!mark || !point) return false;
  const outline = displayDeviceOutline(mark, markerSize);
  if (!outline) return false;
  return pointHitsOutline(outline, { x: mark.x, y: mark.y }, point, 0.55);
}

export function selectMarkAtPoint(marks, point, options = {}) {
  const aspect = options.aspect || 1;
  const markerSize = options.markerSize || 0.55;
  const hitRoute = options.hitRoute;
  const list = marks || [];
  const device = [...list].reverse().find((mark) => isDeviceMark(mark) && hitTestDeviceFill(mark, point, markerSize));
  if (device) return device;
  if (!hitRoute) return null;
  return [...list].reverse().find((mark) => !isDeviceMark(mark) && hitRoute(mark, point, aspect));
}

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
  if (outline.kind === "circle") {
    return { ...outline, r: Math.max(0.02, (Number(outline.r) || Math.max(Number(outline.w) || 0, Number(outline.h) || 0) / 2) * f) };
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

export function deviceFillEnabled(mark) {
  return mark?.fillEnabled !== false && mark?.fillMode !== "off";
}
