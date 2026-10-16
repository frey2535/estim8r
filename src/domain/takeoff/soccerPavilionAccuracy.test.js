import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatAccuracyReport, scoreTakeoffAccuracy } from "./accuracyHarness.js";
import { classifyPageText } from "./drawing-docs.js";
import { isNonPlanSheetKind, normalizeTypeMark, shouldAcceptPlanToken } from "./symbolDetection.js";
import { symbolsOnDrawingForTrade } from "./trades.js";
import { layoutOverlayCallouts } from "./overlayLayout.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const fixture = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/soccer-pavilion-electrical.json"),
  "utf8",
));

assert(normalizeTypeMark("'1E'") === "1E", "Revit quoted type 1E strips to 1E");
assert(normalizeTypeMark("'2'") === "2", "Revit quoted type 2 strips to 2");
assert(shouldAcceptPlanToken({ text: "'1E'", x: 25.5, y: 18.1 }), "quoted 1E on the lighting plan is a device");
assert(!shouldAcceptPlanToken({ text: "1", x: 65.6, y: 12.2 }, [
  { text: "1", x: 65.6, y: 12.2 },
  { text: "2", x: 65.6, y: 22.3 },
  { text: "3", x: 65.6, y: 32.5 },
]), "right-side grid numerals are not type 1 fixtures");
assert(classifyPageText("ELECTRICAL RISER DIAGRAM PANEL H1") === "oneline", "riser sheets are not plan sheets");
assert(classifyPageText("ELECTRICAL SITE PLAN DETAILS SECTION TWO CONDUIT") === "detail", "detail sheets are not counted");
assert(isNonPlanSheetKind("oneline") && isNonPlanSheetKind("detail"), "one-line and detail kinds stay off the plan count");

const score = scoreTakeoffAccuracy(fixture);
console.log(formatAccuracyReport(score));
if (score.unmatchedTruth.length) {
  console.log("missed", score.unmatchedTruth.slice(0, 12).map((item) => `${item.type}@${item.sheet}:${item.x},${item.y}`).join(" "));
}
if (score.extraMarks.length) {
  console.log("extra", score.extraMarks.slice(0, 12).map((item) => `${item.typeCode || item.symbol}@${item.sheet}:${item.x.toFixed?.(1) || item.x},${item.y.toFixed?.(1) || item.y}`).join(" "));
}

assert(score.independence === "drawing-callout", "Soccer ground truth comes from printed type callouts, not a manual audit");
assert(score.truth === 129, `Soccer callout set stays 129 labeled devices, got ${score.truth}`);
assert(score.found === 36 && score.falseNegatives === 93, `Soccer symbol recall baseline is 36/129, got ${score.found}`);
assert(score.classified === 19, `Soccer exact classification baseline is 19, got ${score.classified}`);
assert(score.falsePositives === 9 && score.doubleCounts === 9, `Soccer false-positive baseline is 9 including 9 double-counts, got ${score.falsePositives}`);
assert(score.placementMeasured === 11 && score.failedMarkers.length === 1, "only 11 Soccer labels separate the symbol body from the type text");
assert(score.unresolvedCount === 240, `Soccer unresolved review baseline is 240, got ${score.unresolvedCount}`);
assert(score.worstTypeRecall === 0, "at least one Soccer type is entirely missed");
assert(score.claimPermitted === false, "Soccer callout labels must not be reported as a 99% accuracy claim");

const pageKinds = Object.fromEntries(fixture.pages.map((page) => [page.page, page.kind]));
const electrical = score;
const dropdown = symbolsOnDrawingForTrade("electrical", [
  ...Array.from({ length: electrical.found }, (_, index) => ({
    id: `m${index}`,
    type: "count",
    sheet: 50,
    trade: "electrical",
    symbol: "2x4",
    symbolLabel: "Type 1",
    abbr: "1",
    category: "Lighting",
  })),
], { pageKinds });
assert(dropdown.every((item) => item.trade === "electrical"), "dropdown stays on the selected trade");
assert(layoutOverlayCallouts({ devices: [{ x: 20, y: 20, symbol: "2x4", typeCode: "1E" }] }).deviceLabels.length === 0, "markers still have no type-code text");
assert(!fixture.pages.some((page) => page.kind === "drawing" && page.discipline !== "electrical" && page.discipline !== "architectural"), "fixture stays on real electrical sheets plus one non-electrical control sheet");

if (!process.exitCode) console.log("soccer pavilion accuracy checks passed");
