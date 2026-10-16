import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ACCURACY_THRESHOLD, formatAccuracyReport, scoreTakeoffAccuracy } from "./accuracyHarness.js";
import { LABEL_AUTHORITY } from "./labeledTruth.js";
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

const score = scoreTakeoffAccuracy({
  ...fixture,
  labelAuthority: LABEL_AUTHORITY.INDEPENDENT,
});
console.log(formatAccuracyReport(score));
if (score.unmatchedTruth.length) {
  console.log("missed", score.unmatchedTruth.slice(0, 12).map((item) => `${item.type}@${item.sheet}:${item.x},${item.y}`).join(" "));
}
if (score.extraMarks.length) {
  console.log("extra", score.extraMarks.slice(0, 12).map((item) => `${item.typeCode || item.symbol}@${item.sheet}:${item.x.toFixed?.(1) || item.x},${item.y.toFixed?.(1) || item.y}`).join(" "));
}

assert(score.labelAuthority === LABEL_AUTHORITY.INDEPENDENT, "Soccer Pavilion is the independently labeled commercial set");
assert(score.truth === 129, `Soccer labeled quantity stays 129, got ${score.truth}`);
assert(score.found === 129, `Phase 2 Soccer recall is 129/129, got ${score.found}`);
assert(score.falsePositives === 0, `Phase 2 Soccer extras must stay 0, got ${score.falsePositives}`);
assert(score.worstTypeRecall === 1, `Phase 2 worst-type recall is 100%, got ${(score.worstTypeRecall * 100).toFixed(2)}%`);
assert(score.detectionPrecision === 1, `Phase 2 precision is 100%, got ${(score.detectionPrecision * 100).toFixed(2)}%`);
assert(score.classificationAccuracy === 1, `Phase 2 classification is 100%, got ${(score.classificationAccuracy * 100).toFixed(2)}%`);
assert(score.markerAccuracy > 0.9 && score.markerAccuracy < ACCURACY_THRESHOLD, `Phase 2 marker lock is 91.47% and still below 99%, got ${(score.markerAccuracy * 100).toFixed(2)}%`);
assert(score.canClaimThreshold === false, "Soccer marker placement below 99% cannot claim the threshold");
assert(score.meetsDetection === false, "Soccer does not pass the professional detection gate until markers are 99%");

const pageKinds = Object.fromEntries(fixture.pages.map((page) => [page.page, page.kind]));
const marks = score.extraMarks; // unused, keep dropdown check on a fresh run
const electrical = scoreTakeoffAccuracy(fixture);
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

if (!process.exitCode) console.log("soccer pavilion phase 2 baseline recorded");
