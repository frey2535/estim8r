import {
  isSheetPanDrag,
  normalizePageRotation,
  pagePercentFromClient,
  panAfterZoomAtCursor,
  pointerDistance,
  rotatePagePercent,
  sheetPanOffset,
  sheetPinchZoom,
  unrotatePagePercent,
} from "./sheetViewport.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(sheetPanOffset({ x: 10, y: 4 }, { x: 20, y: 20 }, { x: 50, y: 5 }).x === 40, "pan x follows pointer delta");
assert(sheetPanOffset({ x: 10, y: 4 }, { x: 20, y: 20 }, { x: 50, y: 5 }).y === -11, "pan y follows pointer delta");
assert(!isSheetPanDrag({ x: 0, y: 0 }, { x: 3, y: 3 }), "small jitter stays a click");
assert(isSheetPanDrag({ x: 0, y: 0 }, { x: 6, y: 0 }), "desktop drag past 5px is a pan");
assert(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 }) === 5, "pinch distance is hypot");
assert(sheetPinchZoom(1, 100, 200) === 2, "pinch out doubles zoom");
assert(sheetPinchZoom(2, 200, 100) === 1, "pinch in halves zoom");
assert(sheetPinchZoom(1, 100, 800) === 4, "pinch zoom clamps to 4");
assert(sheetPinchZoom(1, 100, 10) === 0.5, "pinch zoom clamps to 0.5");
assert(sheetPinchZoom(1.25, 0, 40) === 1.25, "zero start distance keeps zoom");

assert(normalizePageRotation(90) === 90, "90 stays 90");
assert(normalizePageRotation(-90) === 270, "negative rotation wraps");
assert(normalizePageRotation(45) === 90, "near-90 snaps to 90");
assert(normalizePageRotation(405) === 90, "405 wraps to 45 then snaps to 90");
assert(normalizePageRotation(0) === 0, "0 stays 0");

const origin = { x: 25, y: 10 };
assert(rotatePagePercent(origin, 0).x === 25 && rotatePagePercent(origin, 0).y === 10, "0° keeps page percent");
assert(Math.abs(rotatePagePercent(origin, 90).x - 10) < 1e-9, "90° maps y→x");
assert(Math.abs(rotatePagePercent(origin, 90).y - 75) < 1e-9, "90° maps x→100-x");
assert(Math.abs(unrotatePagePercent(rotatePagePercent(origin, 90), 90).x - 25) < 1e-9, "unrotate undoes 90°");
assert(Math.abs(unrotatePagePercent(rotatePagePercent(origin, 180), 180).y - 10) < 1e-9, "unrotate undoes 180°");
assert(Math.abs(unrotatePagePercent(rotatePagePercent(origin, 270), 270).x - 25) < 1e-9, "unrotate undoes 270°");

const rect = { left: 100, top: 50, width: 200, height: 100 };
const mid = pagePercentFromClient({ x: 200, y: 100 }, rect, 0);
assert(mid && Math.abs(mid.x - 50) < 1e-9 && Math.abs(mid.y - 50) < 1e-9, "client mid maps to 50,50 page percent");
const zoomedRect = { left: 50, top: 0, width: 400, height: 200 };
const midZoomed = pagePercentFromClient({ x: 250, y: 100 }, zoomedRect, 0);
assert(midZoomed && Math.abs(midZoomed.x - 50) < 1e-9 && Math.abs(midZoomed.y - 50) < 1e-9, "zoomed sheet rect still maps mid to 50,50");
const pannedRect = { left: 140, top: 70, width: 200, height: 100 };
const midPanned = pagePercentFromClient({ x: 240, y: 120 }, pannedRect, 0);
assert(midPanned && Math.abs(midPanned.x - 50) < 1e-9 && Math.abs(midPanned.y - 50) < 1e-9, "panned sheet rect still maps mid to 50,50");
const rotated = pagePercentFromClient({ x: 200, y: 100 }, rect, 90);
assert(rotated && Math.abs(rotated.x - 50) < 1e-9 && Math.abs(rotated.y - 50) < 1e-9, "mid stays mid under 90° remap");

const compensated = panAfterZoomAtCursor({
  pan: { x: 10, y: -5 },
  zoom: 1,
  nextZoom: 2,
  cursorFromViewportCenter: { x: 40, y: 20 },
});
assert(Math.abs(compensated.x - (10 + (40 - 10) * (1 - 2))) < 1e-9, "zoom pan x keeps cursor subject");
assert(Math.abs(compensated.y - (-5 + (20 - -5) * (1 - 2))) < 1e-9, "zoom pan y keeps cursor subject");

// Unresolved prerequisite (do not fabricate): no independent PDF-page rotation
// ground-truth fixture exists under src/domain/takeoff/fixtures/. Unit math above
// covers synthetic 0/90/180/270 remaps only.
console.log("UNRESOLVED_PREREQUISITE: no labeled rotation/calibration GT fixture for real PDF pages");

if (!process.exitCode) console.log("sheetViewport ok");
