import { buildAiMarks } from "./aiTakeoff.js";
import { isReviewOnlyMark, reviewCandidateMark } from "./detectionRecord.js";
import { persistedPlanDeviceCount } from "./symbolDetection.js";
import { paletteForTrade } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const electrical = paletteForTrade("electrical");

const planned = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  maxHomeruns: 3,
  conduit: { id: "emt-3-4", label: '3/4" EMT', size: '3/4"', material: "EMT" },
  pages: [{
    page: 1,
    kind: "drawing",
    sheetId: "E1.01",
    tokens: [
      { text: "ELECTRICAL POWER PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "LP1", x: 9.2, y: 19.6 },
      { text: "GFI", x: 10, y: 20 },
      { text: "GFI", x: 20, y: 20 },
    ],
    paths: [
      { cx: 10.05, cy: 20.02, w: 0.34, h: 0.3, kind: "rect", source: "vector" },
      { cx: 20.04, cy: 20.01, w: 0.33, h: 0.29, kind: "rect", source: "vector" },
    ],
  }],
});

const devices = (planned.marks || []).filter((mark) => mark.type === "count");
const bid = devices.filter((mark) => !isReviewOnlyMark(mark));
assert(bid.length >= 2, `labeled GFI tokens stay counted, got ${bid.length}`);
assert(bid.every((mark) => mark.symbolBodyLocation && Number.isFinite(mark.symbolBodyLocation.x)), "every bid mark records symbolBodyLocation");
assert(bid.every((mark) => mark.x === mark.symbolBodyLocation.x && mark.y === mark.symbolBodyLocation.y), "painted x/y equal symbolBodyLocation");
assert(bid.every((mark) => mark.symbolBodyBounds), "every bid mark records symbolBodyBounds");
assert(bid.some((mark) => mark.labelLocation), "nearby type text is stored as labelLocation");
assert(bid.some((mark) => mark.circuitTagLocation?.text === "LP1"), "circuit tags are associated, not used as the fill origin");
assert(bid.every((mark) => Array.isArray(mark.detectionSources) && mark.detectionSources.length), "detection sources are recorded");
assert(bid.every((mark) => Number.isFinite(mark.combinedConfidence)), "combinedConfidence is present");
assert("requiresReview" in bid[0] && "reviewReason" in bid[0], "review fields are present on counted marks");
assert(persistedPlanDeviceCount(planned.marks, { 1: "drawing" }) === planned.deviceCount, "deviceCount is the persisted bid count");
assert(planned.deviceCount === bid.length, "review-only marks are excluded from deviceCount");

const missingBody = reviewCandidateMark({
  trade: "electrical",
  sheet: 1,
  label: { x: 33, y: 44 },
  reason: "classified-without-symbol-body",
  sources: ["text"],
  scores: { text: 0.55 },
});
assert(missingBody, "a classified token with no recovered body is kept");
assert(isReviewOnlyMark(missingBody), "missing-body candidates stay UNKNOWN/REVIEW instead of being deleted");
assert(missingBody.reviewReason === "classified-without-symbol-body", "missing-body review reason is explicit");
assert(missingBody.symbolBodyLocation.x === 33 && missingBody.symbolBodyLocation.y === 44, "review marker stays at the classified token until a body is found");
assert(persistedPlanDeviceCount([missingBody], { 1: "drawing" }) === 0, "UNKNOWN/REVIEW does not become a bid quantity");

if (!process.exitCode) console.log("detection pipeline field checks passed");
