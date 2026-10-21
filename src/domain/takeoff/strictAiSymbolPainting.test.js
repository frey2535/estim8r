import {
  MAX_FIXTURE_FILL,
  MAX_GENERIC_FILL,
  MAX_POINT_FILL,
  deviceOutline,
  displayDeviceOutline,
  outlineExtent,
  planOverlayMarks,
} from "./deviceStyles.js";

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
// Bid/extent callers must tolerate null paint outlines for text-located AI
// (e110PowerAccuracy maxExtent) without fabricating a vector perimeter.
assert(
  aiTextOnly.outlineSource === "text" && deviceOutline(aiTextOnly) === null,
  "text-located bid marks stay countable without a fabricated deviceOutline",
);

const outline = deviceOutline(aiVector);
assert(outline, "trusted vector AI symbol must paint");
assert(Math.abs(outline.w - 0.18) < 0.0001 && Math.abs(outline.h - 0.16) < 0.0001, "AI symbol geometry must not be enlarged beyond its perimeter");
assert(deviceOutline(manual), "manual marks retain a visible generic marker");

// Extracted recessed-can bodies are typically ~0.6–1.1 across — larger than
// MAX_POINT_FILL — but must still paint as the measured circle, clamped.
const aiCanOverCap = {
  id: "ai-can-over-cap",
  source: "ai",
  type: "count",
  symbol: "downlight",
  symbolLabel: "Type 2 6\" LED can downlight",
  typeCode: "2",
  x: 29.95,
  y: 40.55,
  symbolBodyLocation: { x: 29.95, y: 40.55 },
  outlineSource: "vector",
  outline: { source: "vector", kind: "circle", r: 0.55, w: 1.1, h: 1.1, points: [] },
};
const canPaint = deviceOutline(aiCanOverCap);
assert(canPaint?.kind === "circle", "extracted can over the paint cap still paints as a circle");
assert(outlineExtent(canPaint) <= MAX_POINT_FILL + 0.001, "over-cap extracted can is clamped to the point fill cap");
assert((canPaint?.r || 0) < 0.55, "clamped can radius is below the raw extracted radius");
assert(deviceOutline({
  ...aiCanOverCap,
  outline: { source: "vector", kind: "circle", r: 6, w: 12, h: 12, points: [] },
}) === null, "room-sized AI outlines still do not paint");

// Vector 2x4 troffers are drawn ~2.1 across — over MAX_FIXTURE_FILL — but must
// still paint as the measured rectangle, clamped to the Beam fixture cap.
const aiTrofferOverCap = {
  id: "ai-troffer-over-cap",
  source: "ai",
  type: "count",
  symbol: "2x4",
  symbolLabel: "Type 1E 2x4 emergency",
  typeCode: "1E",
  x: 21.05,
  y: 36.525,
  symbolBodyLocation: { x: 21.05, y: 36.525 },
  outlineSource: "vector",
  outline: {
    source: "vector",
    kind: "rect",
    w: 2.1,
    h: 1.05,
    points: [
      { x: 20, y: 36 },
      { x: 22.1, y: 36 },
      { x: 22.1, y: 37.05 },
      { x: 20, y: 37.05 },
    ],
  },
};
const trofferPaint = deviceOutline(aiTrofferOverCap);
assert(trofferPaint?.kind === "rect", "extracted troffer over the paint cap still paints as a rectangle");
assert(outlineExtent(trofferPaint) <= MAX_FIXTURE_FILL + 0.001, "over-cap extracted troffer is clamped to the fixture fill cap");
assert((trofferPaint?.w || 0) < 2.1 && (trofferPaint?.w || 0) / (trofferPaint?.h || 1) > 1.5, "clamped troffer keeps its rectangular aspect, not a circle");
assert(deviceOutline({
  ...aiTrofferOverCap,
  outline: { source: "vector", kind: "rect", w: 12, h: 8, points: [] },
}) === null, "room-sized AI fixture outlines still do not paint");

// WP cover plate (~0.39×0.50) must paint; micro scrap claimed as vector must not.
const aiWpCover = {
  id: "ai-wp-cover",
  source: "ai",
  type: "count",
  symbol: "wp",
  symbolLabel: "Weatherproof receptacle",
  typeCode: "WP",
  x: 27.251,
  y: 83.631,
  symbolBodyLocation: { x: 27.251, y: 83.631 },
  outlineSource: "vector",
  outline: { source: "vector", kind: "rect", w: 0.391, h: 0.503, points: [] },
};
assert(deviceOutline(aiWpCover)?.kind === "rect", "WP cover plate vector paints");
assert(outlineExtent(deviceOutline(aiWpCover)) <= MAX_GENERIC_FILL, "WP cover stays under the generic paint cap");
const aiWpMicro = {
  ...aiWpCover,
  id: "ai-wp-micro",
  x: 27.075,
  y: 83.207,
  symbolBodyLocation: { x: 27.075, y: 83.207 },
  outline: { source: "vector", kind: "rect", w: 0.09, h: 0.126, points: [] },
};
assert(deviceOutline(aiWpMicro) === null, "unpaintable WP micro-vector does not paint a fabricated outline");

if (!process.exitCode) console.log("strict AI symbol perimeter painting checks passed");
