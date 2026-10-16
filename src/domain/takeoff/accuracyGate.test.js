import {
  classifyGroundTruth,
  formatAccuracyReport,
  markerOnSymbolBody,
  scoreDetections,
  scoreTakeoffAccuracy,
} from "./accuracyHarness.js";

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
assert(unmeasured.independence === "absent", "empty fixture is not labeled");
assert(unmeasured.detectionRecall == null, "empty ground truth must not report 100% recall");
assert(unmeasured.detectionPrecision == null, "empty detections must not report 100% precision");
assert(unmeasured.markerAccuracy == null, "empty matches must not report 100% placement");
assert(unmeasured.meetsDetection === false, "empty ground truth must not pass detection");
assert(unmeasured.meetsMarkers === false, "empty ground truth must not pass marker placement");
assert(unmeasured.claimPermitted === false, "empty fixture cannot permit an accuracy claim");
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
assert(bodyMark.meetsDetection === true, "manual labels with exact location, type, and no extras pass detection");
assert(bodyMark.meetsMarkers === true, "manual labels with the marker inside the symbol body pass placement");
assert(bodyMark.claimPermitted === true, "a fully measured manual case with no open review can permit a claim");
assert(markerOnSymbolBody(onBody, device), "body marker is inside the labeled symbol");
assert(!markerOnSymbolBody(onTag, device), "tag marker is outside the labeled symbol");

const doubled = scoreDetections({
  marks: [onBody, { ...onBody, x: 20.1, y: 20.08 }],
  groundTruth: [device],
  independence: "manual",
});
assert(doubled.found === 1 && doubled.doubleCounts === 1, "a second mark on the same symbol is one double-count");
assert(doubled.falsePositives === 1, "double-counts are not a second quantity");
assert(doubled.detectionPrecision === 0.5, "precision uses every bid mark, including the duplicate");

const callout = scoreDetections({
  marks: [onBody],
  groundTruth: [{ ...device, source: "quoted-type" }],
  independence: "drawing-callout",
  coverageComplete: true,
});
assert(callout.detectionRecall === 1 && callout.meetsDetection === false, "drawing callouts can score recall but cannot pass the claim gate");
assert(callout.claimPermitted === false, "callout-derived labels are not an independent 99% claim");

const derived = scoreDetections({
  marks: [{ type: "count", sheet: 1, typeCode: "OS", x: 10, y: 10 }],
  groundTruth: [{ sheet: 1, type: "OS", x: 10, y: 10, cx: 10, cy: 10, w: 0.9, h: 0.9, source: "plan-token", tagOnSymbol: true }],
  independence: "detector-derived",
  coverageComplete: true,
});
assert(derived.placementUnmeasured === 1, "token-copied body coordinates are not a placement measurement");
assert(derived.markerAccuracy == null, "unmeasured placement is not reported as 100%");
assert(derived.claimPermitted === false, "detector-derived labels cannot permit an accuracy claim");

assert(classifyGroundTruth({ groundTruth: [] }) === "absent", "no rows are absent");
assert(classifyGroundTruth({ groundTruth: [{ source: "plan-token" }] }) === "detector-derived", "plan-token rows are detector-derived");
assert(classifyGroundTruth({ groundTruth: [{ source: "quoted-type" }] }) === "drawing-callout", "quoted type rows are drawing callouts");
assert(classifyGroundTruth({ groundTruthIndependence: "manual", groundTruth: [{ source: "quoted-type" }] }) === "manual", "an explicit manual label wins");

if (!process.exitCode) console.log("accuracy gate regression checks passed");
