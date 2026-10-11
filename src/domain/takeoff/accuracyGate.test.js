import { scoreTakeoffAccuracy, formatAccuracyReport } from "./accuracyHarness.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const unmeasured = scoreTakeoffAccuracy({
  pages: [],
  drawingSymbols: [],
  groundTruth: [],
});
assert(unmeasured.truth === 0, "empty fixture contains no labeled devices");
assert(unmeasured.meetsDetection === false, "empty ground truth must not pass detection");
assert(unmeasured.meetsMarkers === false, "empty ground truth must not pass marker placement");
assert(formatAccuracyReport(unmeasured).includes("MISSING"), "report must flag absent ground truth");

const missed = scoreTakeoffAccuracy({
  pages: [],
  drawingSymbols: [],
  groundTruth: [{ sheet: 1, type: "GFI", x: 25, y: 25, cx: 25, cy: 25 }],
});
assert(missed.truth === 1, "labeled fixture retains ground truth");
assert(missed.falseNegatives === missed.truth - missed.found, "false negatives reflect missed devices");
assert(!missed.meetsDetection || (missed.detectionRecall >= 0.99 && missed.detectionPrecision >= 0.99), "passing detection requires measured recall and precision");

if (!process.exitCode) console.log("accuracy gate regression checks passed");
