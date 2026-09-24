import { isDeviceMark } from "./deviceStyles.js";
import { isJunkGeometry, pointHitsOutline } from "./vectorSymbols.js";

function fixed(value) { return Number(value || 0).toFixed(3); }

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
    for (let index = 0; index < (page.paths || []).length; index += 1) {
      const path = page.paths[index];
      if (isJunkGeometry(path)) continue;
      const long = Math.max(Number(path.w) || 0, Number(path.h) || 0);
      const short = Math.min(Number(path.w) || 0, Number(path.h) || 0);
      if (long > 2.3 || short < 0.1 || long / Math.max(short, 0.001) > 4.5) continue;
      if (known.some((item) => Math.hypot((item.x || 0) - path.cx, (item.y || 0) - path.cy) <= Math.max(0.42, long * 0.65))) continue;
      const objectId = ["drawing-vector", sheet, index, fixed(path.cx), fixed(path.cy)].join(":");
      objects.push({
        id: objectId, objectId, objectKind: "unclassified-vector", trade, sheet,
        type: "count", tool: "count", category: "Unclassified", symbol: "unclassified-device",
        symbolLabel: "Unclassified device", abbr: "?", x: path.cx, y: path.cy,
        outline: path.outline || { kind: path.kind, source: "vector", w: path.w, h: path.h, r: path.r, points: path.points || [] },
        selectable: true, editable: true, requiresClassification: true,
      });
    }
  }
  return objects;
}

export function hitDrawingObject(objects = [], point, sheet = 1) {
  return [...(objects || [])].reverse().find((item) =>
    (item.sheet || 1) === sheet && item.selectable !== false &&
    pointHitsOutline(item.outline, { x: item.x, y: item.y }, point, 0.5)
  ) || null;
}

export function materializeDrawingObject(object, existingMarks = []) {
  if (!object) return null;
  const linked = (existingMarks || []).find((mark) =>
    mark.objectId === object.objectId || mark.sourceObjectId === object.objectId || mark.id === object.sourceMarkId
  );
  if (linked) return { mark: linked, existing: true };
  return {
    existing: false,
    mark: {
      ...object,
      id: object.sourceMarkId || `mark:${object.objectId}`,
      sourceObjectId: object.objectId,
      source: object.objectKind === "recognized-device" ? "drawing-object" : "vector-geometry",
      reviewStatus: object.requiresClassification ? "needs-classification" : (object.reviewStatus || "accepted"),
      detectSource: object.detectSource || "original-pdf",
      fillOpacity: object.fillOpacity ?? 0.32,
    },
  };
}
