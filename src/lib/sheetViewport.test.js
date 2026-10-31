import { sheetWheelIntent } from "./sheetViewport.js";
import {
  isSheetPanDrag,
  pinchMidpoint,
  pointerDistance,
  sheetPanOffset,
  sheetPinchViewport,
  sheetPinchZoom,
  sheetZoomAboutPoint,
} from "./sheetViewport.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

function assertClose(actual, expected, message) {
  assert(Math.abs(actual - expected) < 0.01, `${message} (got ${actual}, expected ${expected})`);
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
assert(sheetPinchZoom(1, 100, 800, 0.25, 8) === 8, "takeoff pinch clamps to 8");
assert(sheetPinchZoom(1, 100, 10, 0.25, 8) === 0.25, "takeoff pinch clamps to 0.25");

assert(pinchMidpoint({ x: 10, y: 20 }, { x: 30, y: 40 }).x === 20, "pinch midpoint x");
assert(pinchMidpoint({ x: 10, y: 20 }, { x: 30, y: 40 }).y === 30, "pinch midpoint y");

const aboutCenter = sheetZoomAboutPoint({
  zoom: 1,
  nextZoom: 2,
  pan: { x: 0, y: 0 },
  focusClient: { x: 200, y: 150 },
  viewportRect: { left: 0, top: 0, width: 400, height: 300 },
});
assert(aboutCenter.zoom === 2, "zoom-about-point reports next zoom");
assert(aboutCenter.pan.x === 0 && aboutCenter.pan.y === 0, "zooming at viewport center keeps pan");

const aboutRight = sheetZoomAboutPoint({
  zoom: 1,
  nextZoom: 2,
  pan: { x: 0, y: 0 },
  focusClient: { x: 300, y: 150 },
  viewportRect: { left: 0, top: 0, width: 400, height: 300 },
});
assertClose(aboutRight.pan.x, -100, "zooming at a right-side point shifts pan left");
assertClose(aboutRight.pan.y, 0, "horizontal pinch does not invent a y pan");

const pinchOut = sheetPinchViewport({
  startZoom: 1,
  startDistance: 100,
  startPan: { x: 0, y: 0 },
  startMid: { x: 200, y: 150 },
  currentDistance: 200,
  currentMid: { x: 200, y: 150 },
  viewportRect: { left: 0, top: 0, width: 400, height: 300 },
});
assert(pinchOut.zoom === 2, "spread doubles takeoff zoom");
assert(pinchOut.pan.x === 0 && pinchOut.pan.y === 0, "spread about center keeps the midpoint");

const pinchMove = sheetPinchViewport({
  startZoom: 1,
  startDistance: 100,
  startPan: { x: 0, y: 0 },
  startMid: { x: 200, y: 150 },
  currentDistance: 100,
  currentMid: { x: 230, y: 170 },
  viewportRect: { left: 0, top: 0, width: 400, height: 300 },
});
assert(pinchMove.zoom === 1, "two-finger slide without spread keeps zoom");
assertClose(pinchMove.pan.x, 30, "pinch midpoint travel pans x");
assertClose(pinchMove.pan.y, 20, "pinch midpoint travel pans y");

if (!process.exitCode) console.log("sheetViewport ok");

const wheel = sheetWheelIntent({ deltaY: -120, deltaMode: 0 });
if (wheel.kind !== "zoom" || wheel.smooth) throw new Error("Mouse wheel must zoom discretely");
const trackpad = sheetWheelIntent({ deltaX: 8, deltaY: 16, deltaMode: 0 });
if (trackpad.kind !== "pan" || trackpad.x !== 8 || trackpad.y !== 16) throw new Error("Mac two-finger scroll must pan");
const pinch = sheetWheelIntent({ deltaY: -5, ctrlKey: true });
if (pinch.kind !== "zoom" || !pinch.smooth) throw new Error("Mac pinch must zoom smoothly");
