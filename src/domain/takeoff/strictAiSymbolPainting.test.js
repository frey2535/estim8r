import { deviceOutline, displayDeviceOutline, planOverlayMarks } from "./deviceStyles.js";

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
assert(displayDeviceOutline(aiWithoutGeometry)?.kind === "circle", "accepted AI detection without geometry gets a compact visible locator");
assert(displayDeviceOutline(aiTextOnly)?.kind === "circle", "accepted text-located AI detection gets a compact visible locator");
assert(displayDeviceOutline(review) === null, "review-only AI candidates remain hidden from the plan");

const outline = deviceOutline(aiVector);
assert(outline, "trusted vector AI symbol must paint");
assert(Math.abs(outline.w - 0.18) < 0.0001 && Math.abs(outline.h - 0.16) < 0.0001, "AI symbol geometry must not be enlarged beyond its perimeter");
assert(deviceOutline(manual), "manual marks retain a visible generic marker");

if (!process.exitCode) console.log("strict AI symbol perimeter painting checks passed");
