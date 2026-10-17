import { isDeviceMark } from "./deviceStyles.js";
import { looksLikeHexNoteGlyph } from "./legendGeometry.js";
import { isJunkGeometry, pointHitsOutline } from "./vectorSymbols.js";

const MAX_CIRCUITS = 800;
const MAX_ROOMS = 120;
const KIND_RANK = {
  "recognized-device": 0,
  "unclassified-vector": 1,
  circuit: 2,
  room: 3,
};

function fixed(value) { return Number(value || 0).toFixed(3); }

function span(path) {
  const w = Number(path?.w) || 0;
  const h = Number(path?.h) || 0;
  return {
    w,
    h,
    long: Math.max(w, h),
    short: Math.min(w, h),
    area: Math.max(0, w * h),
    cx: Number(path?.cx) || 0,
    cy: Number(path?.cy) || 0,
  };
}

export function classifySheetPath(path) {
  if (!path) return null;
  const { w, h, long, short, area } = span(path);
  if (long < 0.12 || long > 96) return null;
  if (w > 88 && h > 88) return null;
  const aspect = long / Math.max(short, 0.001);
  if (long <= 2.4 && short >= 0.1 && aspect <= 4.5 && area <= 6) return "symbol";
  if (long >= 4 && short >= 3 && aspect <= 3.2 && area >= 18 && area <= 4200 && long < 78 && short < 70) return "room";
  if (long >= 1.6 && short <= 0.55 && aspect >= 5 && long < 90) return "circuit";
  return null;
}

function outlineFor(path) {
  return path.outline || {
    kind: path.kind,
    source: "vector",
    w: path.w,
    h: path.h,
    r: path.r,
    cx: path.cx,
    cy: path.cy,
    points: path.points || [],
  };
}

export function linePointsForPath(path) {
  const source = path?.points?.length >= 2 ? path.points : path?.outline?.points;
  if (source?.length >= 2) return source.map((point) => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 }));
  const { w, h, cx, cy } = span(path);
  if (w >= h) return [{ x: cx - w / 2, y: cy }, { x: cx + w / 2, y: cy }];
  return [{ x: cx, y: cy - h / 2 }, { x: cx, y: cy + h / 2 }];
}

export function roomPointsForPath(path) {
  const source = path?.points?.length >= 3 ? path.points : path?.outline?.points;
  if (source?.length >= 3) return source.map((point) => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 }));
  const { w, h, cx, cy } = span(path);
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function pointNearLine(item, point, threshold = 0.7) {
  const points = item?.points?.length >= 2 ? item.points : linePointsForPath(item);
  if (!points || points.length < 2) return false;
  for (let index = 1; index < points.length; index += 1) {
    if (distanceToSegment(point, points[index - 1], points[index]) <= threshold) return true;
  }
  return false;
}

function objectArea(item) {
  const w = Number(item?.outline?.w || item?.w) || 0;
  const h = Number(item?.outline?.h || item?.h) || 0;
  return w * h;
}

function objectContainsPoint(item, point) {
  if (!item || !point) return false;
  if (item.objectKind === "circuit") return pointNearLine(item, point, 0.7);
  return pointHitsOutline(item.outline, { x: item.x, y: item.y }, point, item.objectKind === "room" ? 0.15 : 0.5);
}

export function buildDrawingObjectLayer({ pages = [], detectedMarks = [], trade = "electrical" } = {}) {
  const objects = (detectedMarks || []).filter(isDeviceMark).map((mark) => ({
    ...mark,
    objectId: mark.objectId || `drawing-object:${mark.id}`,
    sourceMarkId: mark.id,
    objectKind: "recognized-device",
    selectable: true,
    editable: true,
  }));
  for (const page of pages || []) {
    const sheet = page.page || 1;
    const known = objects.filter((item) => (item.sheet || 1) === sheet);
    const circuits = [];
    const rooms = [];
    const seenLines = new Set();
    const pagePaths = [...(page.paths || []), ...(page.sheetGeometry || [])];
    for (let index = 0; index < pagePaths.length; index += 1) {
      const path = pagePaths[index];
      const kind = classifySheetPath(path);
      const { long, area, cx, cy } = span(path);
      if (kind === "circuit") {
        const key = `${Math.round(cx)}:${Math.round(cy)}:${Math.round(long)}`;
        if (seenLines.has(key)) continue;
        seenLines.add(key);
        const objectId = ["drawing-line", sheet, index, fixed(cx), fixed(cy)].join(":");
        const points = linePointsForPath(path);
        circuits.push({
          id: objectId,
          objectId,
          objectKind: "circuit",
          prediction: true,
          trade,
          sheet,
          type: "route",
          tool: "circuit",
          category: "Raceway",
          symbolLabel: "Line",
          abbr: "",
          x: cx,
          y: cy,
          w: path.w,
          h: path.h,
          points,
          outline: { ...outlineFor(path), points },
          selectable: true,
          editable: true,
          lengthRank: long,
        });
        continue;
      }
      if (kind === "room") {
        const objectId = ["drawing-room", sheet, index, fixed(cx), fixed(cy)].join(":");
        const points = roomPointsForPath(path);
        rooms.push({
          id: objectId,
          objectId,
          objectKind: "room",
          prediction: true,
          trade,
          sheet,
          type: "area",
          tool: "area",
          category: "Rooms",
          symbolLabel: "Unnamed room",
          roomName: "",
          abbr: "",
          x: cx,
          y: cy,
          w: path.w,
          h: path.h,
          points,
          outline: { ...outlineFor(path), kind: outlineFor(path).kind || "path", points },
          selectable: true,
          editable: true,
          areaRank: area,
        });
        continue;
      }
      if (kind !== "symbol") continue;
      if (isJunkGeometry(path) || looksLikeHexNoteGlyph(path)) continue;
      const short = Math.min(Number(path.w) || 0, Number(path.h) || 0);
      if (long > 2.3 || short < 0.1 || long / Math.max(short, 0.001) > 4.5) continue;
      if (known.some((item) => Math.hypot((item.x || 0) - cx, (item.y || 0) - cy) <= Math.max(0.42, long * 0.65))) continue;
      const objectId = ["drawing-vector", sheet, index, fixed(cx), fixed(cy)].join(":");
      objects.push({
        id: objectId, objectId, objectKind: "unclassified-vector", trade, sheet,
        type: "count", tool: "count", category: "Unclassified", symbol: "unclassified-device",
        symbolLabel: "Unclassified device", abbr: "?", x: cx, y: cy,
        outline: outlineFor(path),
        selectable: true, editable: true, requiresClassification: true, prediction: true,
      });
    }
    circuits.sort((a, b) => b.lengthRank - a.lengthRank);
    rooms.sort((a, b) => b.areaRank - a.areaRank);
    objects.push(...circuits.slice(0, MAX_CIRCUITS), ...rooms.slice(0, MAX_ROOMS));
  }
  return objects;
}

export function hitDrawingObject(objects = [], point, sheet = 1) {
  if (!point) return null;
  const hits = (objects || []).filter((item) => (
    (item.sheet || 1) === sheet
    && item.selectable !== false
    && objectContainsPoint(item, point)
  ));
  hits.sort((a, b) => (KIND_RANK[a.objectKind] ?? 4) - (KIND_RANK[b.objectKind] ?? 4) || objectArea(a) - objectArea(b));
  return hits[0] || null;
}

export function enclosingRoom(objects = [], point, sheet = 1) {
  if (!point) return null;
  const rooms = (objects || []).filter((item) => (
    item.objectKind === "room"
    && (item.sheet || 1) === sheet
    && objectContainsPoint(item, point)
  ));
  rooms.sort((a, b) => objectArea(a) - objectArea(b));
  return rooms[0] || null;
}

export function materializeDrawingObject(object, existingMarks = []) {
  if (!object) return null;
  const linked = (existingMarks || []).find((mark) =>
    mark.objectId === object.objectId || mark.sourceObjectId === object.objectId || mark.id === object.sourceMarkId
  );
  if (linked) return { mark: linked, existing: true };
  const prediction = object.objectKind === "circuit" || object.objectKind === "room" || object.requiresClassification === true;
  return {
    existing: false,
    mark: {
      ...object,
      id: object.sourceMarkId || `mark:${object.objectId}`,
      sourceObjectId: object.objectId,
      source: object.objectKind === "recognized-device" ? "drawing-object" : "interactive-geometry",
      reviewStatus: object.requiresClassification ? "needs-classification" : (object.reviewStatus || "accepted"),
      detectSource: object.detectSource || "original-pdf",
      fillOpacity: object.fillOpacity ?? (object.objectKind === "room" ? 0.12 : 0.32),
      prediction,
      bidUse: prediction ? false : object.bidUse,
      typeCode: object.requiresClassification ? "UNKNOWN" : object.typeCode,
    },
  };
}
