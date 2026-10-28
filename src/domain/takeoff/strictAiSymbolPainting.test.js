import { deviceOutline, displayDeviceOutline, outlineExtent, paintDeviceOutline, planOverlayMarks } from "./deviceStyles.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const review = {
  id: "review",
  source: "ai",
  type: "count",
  layer: "review",
  symbol: "unknown",
  typeCode: "UNKNOWN",
  x: 15,
  y: 15,
};

const aiWithoutGeometry = {
  id: "ai-no-geometry",
  source: "ai",
  type: "count",
  symbol: "duplex",
  typeCode: "R",
  x: 20,
  y: 20,
};

const aiTextOnly = {
  id: "ai-text",
  source: "ai",
  type: "count",
  symbol: "duplex",
  typeCode: "R",
  x: 25,
  y: 25,
  outlineSource: "text",
  outline: { source: "text", kind: "rect", cx: 25, cy: 25, w: 0.4, h: 0.3 },
};

const aiVector = {
  id: "ai-vector",
  source: "ai",
  type: "count",
  symbol: "duplex",
  typeCode: "R",
  x: 30,
  y: 30,
  symbolBodyLocation: { x: 30, y: 30 },
  outlineSource: "vector",
  outline: { source: "vector", kind: "rect", cx: 30, cy: 30, w: 0.18, h: 0.16 },
};

const manual = {
  id: "manual",
  source: "manual",
  type: "count",
  symbol: "duplex",
  typeCode: "R",
  x: 40,
  y: 40,
};

assert(!planOverlayMarks([review, aiVector]).some((mark) => mark.id === "review"), "review candidates must not paint on normal plan");
assert(deviceOutline(aiWithoutGeometry) === null, "AI without symbol-body geometry must not paint a fallback mark");
assert(deviceOutline(aiTextOnly) === null, "text-only AI detection must not paint a fallback mark");
assert(displayDeviceOutline(aiWithoutGeometry) === null, "accepted AI detection without geometry must not invent a locator on a number");
assert(displayDeviceOutline(aiTextOnly) === null, "text-located AI detection must not paint the outside number");
assert(displayDeviceOutline(review) === null, "review-only AI candidates remain hidden from the plan");

const outline = deviceOutline(aiVector);
assert(outline, "trusted vector AI symbol must paint");
assert(Math.abs(outline.w - 0.18) < 0.0001 && Math.abs(outline.h - 0.16) < 0.0001, "AI symbol geometry must not be enlarged beyond its perimeter");
assert(deviceOutline(manual), "manual marks retain a visible generic marker");

const oversizedWp = {
  id: "ai-wp",
  source: "ai",
  type: "count",
  symbol: "wp-gfci",
  typeCode: "WP",
  symbolLabel: "Weatherproof receptacle",
  x: 32,
  y: 32,
  symbolBodyLocation: { x: 32, y: 32 },
  outlineSource: "vector",
  outline: { source: "vector", kind: "rect", cx: 32, cy: 32, w: 0.72, h: 0.68 },
};
const paintedWp = displayDeviceOutline(oversizedWp);
assert(paintedWp, "a slightly oversized receptacle body still gets an in-symbol fill");
assert(outlineExtent(paintedWp) >= 0.64 && outlineExtent(paintedWp) <= 0.72 + 1e-9, "measured receptacle perimeter is kept, not shrunk to a chip");
const interiorWp = paintDeviceOutline(oversizedWp);
assert(interiorWp && outlineExtent(interiorWp) < outlineExtent(paintedWp), "receptacle tint stays inside the measured perimeter");

const tinyWp = {
  ...oversizedWp,
  id: "ai-wp-tiny",
  outline: { source: "vector", kind: "rect", cx: 32, cy: 32, w: 0.12, h: 0.11 },
};
const paintedTiny = displayDeviceOutline(tinyWp);
assert(paintedTiny, "a tiny CAD glyph still gets a visible in-symbol fill");
assert(outlineExtent(paintedTiny) <= 0.12 + 1e-9, "tiny AI glyph fills are not inflated past the measured perimeter");

const roomSized = {
  ...oversizedWp,
  id: "ai-room",
  outline: { source: "vector", kind: "rect", cx: 32, cy: 32, w: 8.4, h: 6.2 },
};
assert(deviceOutline(roomSized) === null, "room-sized junk is not painted as a device");

const canBody = {
  id: "ai-can",
  source: "ai",
  type: "count",
  symbol: "downlight",
  typeCode: "4",
  abbr: "4",
  symbolLabel: "Type 4 recessed downlight",
  x: 40.2,
  y: 22.1,
  symbolBodyLocation: { x: 40.0, y: 22.0 },
  outlineSource: "vector",
  outline: { source: "vector", kind: "circle", cx: 40.0, cy: 22.0, r: 0.36, w: 0.72, h: 0.72 },
};
const measuredCan = displayDeviceOutline(canBody);
const paintedCan = paintDeviceOutline(canBody);
assert(measuredCan && Math.abs((measuredCan.cx || 0) - 40) < 1e-9, "can fill centers on the symbol body, not the type tag");
assert(paintedCan && outlineExtent(paintedCan) < outlineExtent(measuredCan), "interior tint is smaller than the measured can perimeter");
assert(outlineExtent(paintedCan) <= 0.72 * 0.92 + 1e-9, "painted can tint stays inside the black circle");
assert(outlineExtent(paintedCan) >= 0.72 * 0.85, "painted can tint still fills most of the symbol interior");

const trofferBody = {
  id: "ai-1",
  source: "ai",
  type: "count",
  symbol: "2x4",
  typeCode: "1",
  abbr: "1",
  symbolLabel: "2x4 recessed troffer",
  x: 55,
  y: 30,
  symbolBodyLocation: { x: 55, y: 30 },
  outlineSource: "vector",
  outline: { source: "vector", kind: "rect", cx: 55, cy: 30, w: 1.1, h: 0.55 },
};
const measuredTroffer = displayDeviceOutline(trofferBody);
const paintedTroffer = paintDeviceOutline(trofferBody);
assert(paintedTroffer && outlineExtent(paintedTroffer) < outlineExtent(measuredTroffer), "troffer tint stays inside the fixture frame");

if (!process.exitCode) console.log("strict AI symbol perimeter painting checks passed");
