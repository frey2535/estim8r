export const DEVICE_FILL_OPACITY = 0.32;
export const CIRCUIT_COLOR = "#64748b";

export const SCHEDULE_TYPE_COLORS = {
  1: "#1e3a8a",
  "1e": "#60a5fa",
  2: "#166534",
  "2e": "#86efac",
  3: "#991b1b",
  "3e": "#fca5a5",
  4: "#7e22ce",
  f: "#d97706",
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
    map.set(key, scheduleTypeColor(key) || FALLBACK_COLORS[fallback % FALLBACK_COLORS.length]);
    if (!scheduleTypeColor(key)) fallback += 1;
  }
  return map;
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
    const color = sheetMaps.get(mark.sheet || 1)?.get(key) || scheduleTypeColor(key) || FALLBACK_COLORS[0];
    return { ...mark, color, layer: "device", fillOpacity: DEVICE_FILL_OPACITY };
  });
}

export function deviceOutline(mark, markerSize = 0.55) {
  const scale = Math.max(0.4, Number(markerSize) || 0.55) / 0.55;
  const blob = `${mark?.symbol || ""} ${mark?.symbolLabel || ""} ${mark?.abbr || ""} ${mark?.typeCode || ""}`.toLowerCase();
  const size = blob.match(/(\d)\s*[x×]\s*(\d)/);
  if (size) {
    const a = Number(size[1]);
    const b = Number(size[2]);
    const long = Math.max(a, b);
    const short = Math.min(a, b);
    return { kind: "rect", w: 0.42 * long * scale, h: 0.38 * short * scale };
  }
  if (/recept|gfci|gfi|duplex|outlet|\br\b|quad/.test(blob)) {
    return { kind: "circle", r: 0.38 * scale };
  }
  if (/downlight|can light|pendant|high bay|low bay|occup|sensor|switch/.test(blob)) {
    return { kind: "circle", r: 0.4 * scale };
  }
  return { kind: "rect", w: 0.95 * scale, h: 0.55 * scale };
}

export function hitTestDeviceFill(mark, point, markerSize = 0.55) {
  if (!mark || !point) return false;
  const outline = deviceOutline(mark, markerSize);
  if (outline.kind === "circle") {
    return Math.hypot(point.x - mark.x, point.y - mark.y) <= outline.r + 0.15;
  }
  return Math.abs(point.x - mark.x) <= outline.w / 2 + 0.12
    && Math.abs(point.y - mark.y) <= outline.h / 2 + 0.12;
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
