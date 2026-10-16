import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatAccuracyReport, scoreTakeoffAccuracy } from "./accuracyHarness.js";
import { isNonPlanSheetKind, isPlotStampToken, normalizeTypeMark, shouldAcceptPlanToken } from "./symbolDetection.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

export function pottsvilleGroundTruth(pages = []) {
  const allowed = new Set(["OS", "GFI", "GFI/WP", "WP"]);
  const devices = [];
  for (const page of pages || []) {
    if (isNonPlanSheetKind(page.kind) || page.kind === "legend") continue;
    const tokens = page.tokens || [];
    for (const token of tokens) {
      if (!shouldAcceptPlanToken(token, tokens)) continue;
      const type = normalizeTypeMark(token.text).toUpperCase();
      if (!allowed.has(type)) continue;
      if (isPlotStampToken(token, tokens)) continue;
      devices.push({
        sheet: page.page,
        type,
        x: token.x,
        y: token.y,
        cx: token.x,
        cy: token.y,
        w: 0.9,
        h: 0.9,
        kind: type === "1" || type === "3" ? "rect" : "circle",
        tagOnSymbol: true,
        source: "plan-token",
      });
    }
  }
  return devices;
}

const raw = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/pottsville-electrical.json"),
  "utf8",
));
const fixture = {
  ...raw,
  groundTruth: pottsvilleGroundTruth(raw.pages),
};

assert(fixture.groundTruth.length >= 8, `Pottsville fixture must include real plan devices, got ${fixture.groundTruth.length}`);
assert(!fixture.pages.some((page) => /legend|schedule|oneline|riser|detail/i.test(page.kind) && page.kind === "drawing"), "P/S/C and legend sheets stay out of the plan count");
assert(fixture.groundTruth.every((device) => device.sheet !== 48), "legend sheet tokens are not ground truth");

const score = scoreTakeoffAccuracy(fixture);
console.log(formatAccuracyReport(score));
if (score.unmatchedTruth.length) {
  console.log("missed", score.unmatchedTruth.slice(0, 16).map((item) => `${item.type}@${item.sheet}:${item.x},${item.y}`).join(" "));
}
if (score.extraMarks.length) {
  console.log("extra", score.extraMarks.slice(0, 16).map((item) => `${item.typeCode || item.symbol}@${item.sheet}:${Number(item.x).toFixed(1)},${Number(item.y).toFixed(1)}`).join(" "));
}

assert(score.independence === "detector-derived", "Pottsville token truth is produced by the detector's own token filter");
assert(score.found === 15 && score.falseNegatives === 0, `Pottsville token recall baseline is 15/15, got ${score.found}`);
assert(score.falsePositives === 280 && score.doubleCounts === 46, `Pottsville unfiltered false-positive baseline is 280, got ${score.falsePositives}`);
assert(score.placementUnmeasured === 15 && score.markerAccuracy == null, "token-copied centers are not symbol-body measurements");
assert(score.claimPermitted === false, "Pottsville token truth must not be reported as a 99% accuracy claim");

if (!process.exitCode) console.log("pottsville accuracy checks passed");
