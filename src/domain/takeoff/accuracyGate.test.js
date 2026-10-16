import { scoreTakeoffAccuracy, formatAccuracyReport } from "./accuracyHarness.js";
import { LABEL_AUTHORITY } from "./labeledTruth.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const device = { sheet: 1, type: "WP", x: 21.7, y: 20.05, cx: 20, cy: 20, w: 0.6, h: 0.7, source: "manual" };
const onBody = { type: "count", sheet: 1, typeCode: "WP", x: 20.05, y: 20.02 };
const onTag = { type: "count", sheet: 1, typeCode: "WP", x: 21.7, y: 20.05 };
const wrongType = { type: "count", sheet: 1, typeCode: "GFI", x: 20.02, y: 20.01 };
const wall = { type: "count", sheet: 1, typeCode: "WP", x: 48, y: 40 };
const review = { type: "count", sheet: 1, typeCode: "UNKNOWN", symbol: "unknown", layer: "review", x: 10, y: 10 };

const unmeasured = scoreTakeoffAccuracy({ pages: [], drawingSymbols: [], groundTruth: [] });
assert(unmeasured.truth === 0, "empty fixture contains no labeled devices");
assert(unmeasured.labelAuthority === LABEL_AUTHORITY.NONE, "empty fixture has no label authority");
assert(unmeasured.meetsDetection === false, "empty ground truth must not pass detection");
assert(unmeasured.meetsMarkers === false, "empty ground truth must not pass marker placement");
assert(unmeasured.canClaimThreshold === false, "empty ground truth cannot claim 99%");
assert(formatAccuracyReport(unmeasured).includes("MISSING"), "report must flag absent ground truth");
assert(formatAccuracyReport(unmeasured).includes("unmeasured"), "report must say unmeasured instead of 100%");

const missed = scoreDetections({
  marks: [],
  groundTruth: [{ sheet: 1, type: "GFI", x: 25, y: 25, cx: 25, cy: 25, source: "manual" }],
  independence: "manual",
});
assert(missed.falseNegatives === 1, "a labeled device with no mark is a false negative");
assert(missed.detectionRecall === 0, "missed symbol recall is 0, not unmeasured");
assert(missed.detectionPrecision == null, "no bid marks leave precision unmeasured instead of 100%");
assert(missed.meetsDetection === false, "a miss cannot pass the detection gate");

const split = scoreDetections({
  marks: [wrongType, wall, review],
  groundTruth: [device],
  unresolvedMarks: [review],
  independence: "manual",
});
assert(split.found === 1, "a mark on the symbol counts as found even when the type is wrong");
assert(split.falseNegatives === 0, "wrong type is not also a missed symbol");
assert(split.classificationAccuracy === 0, "wrong legend type fails classification");
assert(split.falsePositives === 1, "the wall mark is a false positive");
assert(split.unresolvedCount === 1, "review marks stay unresolved");
assert(split.counts === 2, "review marks do not enter the bid count");
assert(split.claimPermitted === false, "wrong type, a false positive, and open review block a claim");

const textMark = scoreDetections({
  marks: [onTag],
  groundTruth: [device],
  independence: "manual",
});
assert(textMark.found === 1 && textMark.classificationAccuracy === 1, "tag-adjacent mark still locates and classifies the device");
assert(textMark.failedMarkers.length === 1, "a highlight on the type text is not on the symbol body");
assert(textMark.markerAccuracy === 0, "misplaced highlight fails placement");
assert(textMark.meetsMarkers === false, "text placement cannot pass the marker gate");

const bodyMark = scoreDetections({
  marks: [onBody],
  groundTruth: [device],
  independence: "manual",
  coverageComplete: true,
});
assert(missed.truth === 1, "labeled fixture retains ground truth");
assert(missed.falseNegatives === missed.truth - missed.found, "false negatives reflect missed devices");
assert(missed.canClaimThreshold === false, "a one-device incomplete label cannot claim 99%");
assert(!missed.meetsDetection, "passing detection requires independently labeled drawings");

const stub = scoreTakeoffAccuracy({
  labelAuthority: LABEL_AUTHORITY.SYNTHETIC,
  drawingSymbols: [{ id: "legend:wp", abbr: "WP", label: "Weatherproof receptacle", takeoffCategory: "Receptacles" }],
  pages: [{
    page: 1,
    kind: "drawing",
    sheetId: "E110",
    tokens: [{ text: "WP", x: 20.35, y: 20.12 }, { text: "POWER", x: 80, y: 90 }, { text: "PLANS", x: 88, y: 90 }],
    paths: [{ cx: 20, cy: 20, w: 0.55, h: 0.7, kind: "rect", source: "vector" }],
  }],
  groundTruth: [{ sheet: 1, type: "WP", x: 20.35, y: 20.12, cx: 20, cy: 20, w: 0.55, h: 0.7 }],
});
assert(stub.labelAuthority === LABEL_AUTHORITY.SYNTHETIC, "explicit synthetic fixture stays synthetic");
assert(stub.canClaimThreshold === false, "synthetic 1/1 cannot claim 99% even if recall is 1");

if (!process.exitCode) console.log("accuracy gate regression checks passed");
