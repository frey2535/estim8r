import { isSheetPanDrag, pointerDistance, sheetPanOffset, sheetPinchZoom } from "./sheetViewport.js";

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

if (!process.exitCode) console.log("sheetViewport ok");
