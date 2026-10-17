import { scoreTakeoffAccuracy, formatAccuracyReport } from "./accuracyHarness.js";
import { LABEL_AUTHORITY } from "./labeledTruth.js";

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
assert(unmeasured.labelAuthority === LABEL_AUTHORITY.NONE, "empty fixture has no label authority");
assert(unmeasured.meetsDetection === false, "empty ground truth must not pass detection");
assert(unmeasured.meetsMarkers === false, "empty ground truth must not pass marker placement");
assert(unmeasured.canClaimThreshold === false, "empty ground truth cannot claim 99%");
assert(formatAccuracyReport(unmeasured).includes("MISSING"), "report must flag absent ground truth");

const missed = scoreTakeoffAccuracy({
  pages: [],
  drawingSymbols: [],
  groundTruth: [{ sheet: 1, type: "GFI", x: 25, y: 25, cx: 25, cy: 25 }],
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

assert(unmeasured.overallMarkingAccuracy === 0, "missing truth cannot report perfect overall marking");
assert(missed.overallMarkingAccuracy === 0, "missed device counts as an unmarked reference");
assert(stub.overallMarkingAccuracy <= stub.detectionRecall, "overall marking cannot exceed detection recall");
assert(!missed.meetsMarkers, "a missed device cannot pass the marking acceptance gate");
