import { isCanDeviceText } from "./symbolDetection.js";
import { pointHitsOutline, scaleOutline } from "./vectorSymbols.js";

export const DEVICE_FILL_OPACITY = 0.55;
export const MIN_VISIBLE_FILL = 0.7;
export const DEVICE_FILL_STROKE_PX = 2;
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

export function planOverlayMarks(marks, options = {}) {
  const list = marks || [];
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
    if (!isDeviceMark(mark)) continue;
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
    if (!isDeviceMark(mark)) continue;
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

export function isUsablePaintOutline(outline, origin) {
  if (!outline) return false;
  if (outline.kind === "path" && (outline.points || []).length < 3) return false;
  if (outline.kind === "composite" && !(outline.parts || []).length) return false;
  const extent = outlineExtent(outline);
  if (extent < 0.22) return false;
  const center = outlineCenter(outline, origin);
  if (!isOnSheet(center.x, center.y)) return false;
  if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
    if (Math.hypot(center.x - origin.x, center.y - origin.y) > 8) return false;
  }
  return true;
}

function enlargeOutline(outline, origin, minExtent) {
  const extent = outlineExtent(outline);
  if (!outline || extent >= minExtent) return outline;
  const factor = extent > 0.02 ? minExtent / extent : minExtent / 0.02;
  return scaleOutline(outline, factor, origin);
}

function genericDeviceOutline(mark, markerSize = 0.55) {
  const scale = Math.max(0.4, Number(markerSize) || 0.55) / 0.55;
  const minR = MIN_VISIBLE_FILL / 2;
  const blob = `${mark?.symbol || ""} ${mark?.symbolLabel || ""} ${mark?.abbr || ""} ${mark?.typeCode || ""}`;
  if (isCanDeviceText(blob) || /downlight|pendant|high bay|low bay|occup|sensor|switch|\bos\b/.test(blob.toLowerCase())) {
    return { kind: "circle", r: Math.max(minR, 0.36 * scale) };
  }
  if (/recept|gfci|gfi|duplex|outlet|\br\b|quad/.test(blob.toLowerCase())) {
    return { kind: "circle", r: Math.max(minR, 0.36 * scale) };
  }
  const size = blob.toLowerCase().match(/(\d)\s*[x×]\s*(\d)/);
  if (size) {
    const a = Number(size[1]);
    const b = Number(size[2]);
    const long = Math.max(a, b);
    const short = Math.min(a, b);
    return {
      kind: "rect",
      w: Math.max(MIN_VISIBLE_FILL, 0.32 * long * scale),
      h: Math.max(MIN_VISIBLE_FILL * 0.7, 0.28 * short * scale),
    };
  }
  return {
    kind: "rect",
    w: Math.max(MIN_VISIBLE_FILL, 0.62 * scale),
    h: Math.max(MIN_VISIBLE_FILL * 0.7, 0.36 * scale),
  };
}

export function deviceOutline(mark, markerSize = 0.55, _options = {}) {
  const origin = { x: Number(mark?.x) || 0, y: Number(mark?.y) || 0 };
  if (mark?.outline && (["vector", "raster", "mixed", "text"].includes(mark.outline.source) || mark.outline.kind === "composite")) {
    if (isUsablePaintOutline(mark.outline, origin)) {
      const painted = enlargeOutline(scaleOutline(mark.outline, 1, origin), origin, MIN_VISIBLE_FILL);
      if (painted && outlineExtent(painted) >= MIN_VISIBLE_FILL - 0.01) return painted;
    }
  }
  return genericDeviceOutline(mark, markerSize);
}

export function hitTestDeviceFill(mark, point, markerSize = 0.55) {
  if (!mark || !point) return false;
  const outline = deviceOutline(mark, markerSize);
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
