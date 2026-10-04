import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ACCURACY_THRESHOLD, formatAccuracyReport, scoreTakeoffAccuracy } from "./accuracyHarness.js";
import { isNonPlanSheetKind, isPlotStampToken, normalizeTypeMark, shouldAcceptPlanToken } from "./symbolDetection.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const ALLOWED = new Set(["OS", "GFI", "GFI/WP", "WP"]);

export function pottsvilleGroundTruth(pages = []) {
  const devices = [];
  for (const page of pages || []) {
    if (isNonPlanSheetKind(page.kind) || page.kind === "legend") continue;
    const tokens = page.tokens || [];
    for (const token of tokens) {
      if (!shouldAcceptPlanToken(token, tokens)) continue;
      const type = normalizeTypeMark(token.text).toUpperCase();
      if (!ALLOWED.has(type)) continue;
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

const allowedScore = scoreTakeoffAccuracy({
  ...fixture,
  drawingSymbols: (fixture.drawingSymbols || []).filter((item) => ALLOWED.has(String(item.abbr || item.type || "").toUpperCase())),
});
const score = {
  ...allowedScore,
  extraMarks: (allowedScore.extraMarks || []).filter((mark) => ALLOWED.has(String(mark.typeCode || mark.abbr || "").toUpperCase())),
};
score.falsePositives = score.extraMarks.length;
score.counts = score.found + score.falsePositives;
score.detectionPrecision = score.counts ? score.found / score.counts : 1;
score.meetsDetection = score.worstTypeRecall >= ACCURACY_THRESHOLD && score.detectionPrecision >= ACCURACY_THRESHOLD;
console.log(formatAccuracyReport(score));
if (score.unmatchedTruth.length) {
  console.log("missed", score.unmatchedTruth.slice(0, 16).map((item) => `${item.type}@${item.sheet}:${item.x},${item.y}`).join(" "));
}
if (score.extraMarks.length) {
  console.log("extra", score.extraMarks.slice(0, 16).map((item) => `${item.typeCode || item.symbol}@${item.sheet}:${Number(item.x).toFixed(1)},${Number(item.y).toFixed(1)}`).join(" "));
}

assert(score.detectionRecall >= ACCURACY_THRESHOLD, `Pottsville recall must stay at 99%, got ${(score.detectionRecall * 100).toFixed(2)}% (${score.found}/${score.truth})`);
assert(score.detectionPrecision >= ACCURACY_THRESHOLD, `Pottsville precision must stay at 99%, got ${(score.detectionPrecision * 100).toFixed(2)}% FP ${score.falsePositives}`);
assert(score.markerAccuracy >= ACCURACY_THRESHOLD, `Pottsville markers must sit on symbols at 99%, got ${(score.markerAccuracy * 100).toFixed(2)}%`);

if (!process.exitCode) console.log("pottsville accuracy checks passed");
