import { applyDeviceTypeColors, deviceOutline } from "./deviceStyles.js";
import {
  attachDetectionRecord,
  bidDeviceMarks,
  isReviewOnlyMark,
  nearbyCircuitTag,
  reviewCandidateMark,
} from "./detectionRecord.js";
import { persistedPlanDeviceCount } from "./symbolDetection.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const body = attachDetectionRecord({
  type: "count",
  sheet: 50,
  x: 10,
  y: 12,
  symbol: "duplex",
  typeCode: "R",
  abbr: "R",
  outline: { kind: "rect", source: "vector", w: 0.32, h: 0.28 },
  outlineSource: "vector",
  matchedFrom: "legend-geometry",
  confidence: "high",
}, {
  geometry: { cx: 22.4, cy: 31.1, w: 0.32, h: 0.28, kind: "rect", source: "vector", outline: { kind: "rect", source: "vector", w: 0.32, h: 0.28 } },
  labelLocation: { x: 22.1, y: 31.4 },
  circuitTagLocation: { x: 20.8, y: 30.9, text: "LP1" },
  detectionSources: ["legend-geometry", "vector"],
  visualMatchScore: 0.94,
  vectorMatchScore: 0.94,
  legendMatchScore: 0.91,
  textContextScore: 0.7,
});

assert(body.symbolBodyLocation.x === 22.4 && body.symbolBodyLocation.y === 31.1, "marker origin is the symbol body, not the incoming x/y");
assert(body.x === 22.4 && body.y === 31.1, "x/y follow symbolBodyLocation");
assert(body.symbolBodyBounds.w === 0.32 && body.symbolBodyBounds.h === 0.28, "symbolBodyBounds come from extracted geometry");
assert(body.labelLocation.x === 22.1 && body.circuitTagLocation.text === "LP1", "label and circuit tag stay separate from the body");
assert(body.detectionSources.includes("vector") && body.detectionSources.includes("legend-geometry"), "detection sources are recorded");
assert(body.combinedConfidence >= 0.94, "combined confidence uses the strongest detector");
assert(body.requiresReview === false, "high-confidence vector+legend body is not review-only");

const textOnly = attachDetectionRecord({
  type: "count",
  sheet: 50,
  x: 40,
  y: 40,
  symbol: "gfci",
  typeCode: "GFI",
  outlineSource: "text",
  matchedFrom: "drawing",
  confidence: "medium",
}, {
  labelLocation: { x: 40, y: 40 },
  detectionSources: ["drawing", "text"],
  textContextScore: 0.7,
});
assert(textOnly.requiresReview === true, "text-only placement stays visible and flagged for review");
assert(textOnly.reviewReason === "text-only-body", "text-only body is explained");
assert(!isReviewOnlyMark(textOnly), "a classified text-on-symbol device is still a bid count");

const review = reviewCandidateMark({
  trade: "electrical",
  sheet: 50,
  geometry: { cx: 15, cy: 18, w: 0.3, h: 0.3, kind: "rect", source: "vector", outline: { kind: "rect", source: "vector", w: 0.3, h: 0.3 } },
  reason: "low-confidence-visual",
  sources: ["legend-geometry"],
  scores: { visual: 0.76, legend: 0.76, vector: 0.76 },
});
assert(isReviewOnlyMark(review), "mid-confidence visual stays UNKNOWN/REVIEW instead of being deleted");
assert(review.type === "count" && review.typeCode === "UNKNOWN", "review candidate remains a visible mark");
assert(review.symbolBodyLocation.x === 15 && review.layer === "review", "review marker still sits on the candidate body");
assert(persistedPlanDeviceCount([body, textOnly, review], { 50: "drawing" }) === 2, "review-only marks do not inflate persisted bid counts");
assert(bidDeviceMarks([body, textOnly, review]).length === 2, "bidDeviceMarks excludes UNKNOWN/REVIEW");

const painted = applyDeviceTypeColors([review, body]);
assert(painted.find((mark) => mark.typeCode === "UNKNOWN")?.layer === "review", "coloring does not promote review marks to bid devices");
assert(deviceOutline(body).kind === "rect", "device fill uses the recorded symbol body");

const circuit = nearbyCircuitTag({ text: "GFI", x: 10, y: 20 }, [
  { text: "LP3", x: 10.4, y: 20.2 },
  { text: "ROOM", x: 11, y: 20 },
]);
assert(circuit?.text === "LP3", "nearby circuit tags are associated, not used as the marker origin");

if (!process.exitCode) console.log("detection record checks passed");
