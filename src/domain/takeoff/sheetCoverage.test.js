import { describeSheetCoverage, isApplicablePlanSheet, mergeReviewQueue, neighborQueueId, pagesCoverage, planSheetCoverage } from "./sheetCoverage.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const cover = { page: 1, kind: "cover", title: "COVER SHEET", tokens: [{ text: "COVER", x: 20, y: 20 }] };
const legend = { page: 48, kind: "legend", title: "ELECTRICAL LEGEND AND SCHEDULES", tokens: [{ text: "ELECTRICAL LEGEND", x: 20, y: 20 }] };
const plan = {
  page: 52,
  kind: "drawing",
  title: "LIGHTING FLOOR PLAN",
  tokens: [{ text: "LIGHTING FLOOR PLAN", x: 80, y: 88 }, { text: "E210", x: 90, y: 94 }],
};

assert(!isApplicablePlanSheet(cover), "cover is not an applicable plan sheet");
assert(!isApplicablePlanSheet(legend), "legend/schedule is not a plan sheet");
assert(isApplicablePlanSheet(plan, { trade: "electrical" }), "E210 lighting plan is applicable");

const empty = planSheetCoverage(plan, []);
assert(empty.complete === false, "an empty plan sheet is not complete just because nothing was detected");
assert(empty.reason === "unscanned-regions" || empty.reason === "empty-unconfirmed", "empty plan stays unresolved");
assert(empty.unscannedCount === 12, `all 12 interior regions start unresolved, got ${empty.unscannedCount}`);
assert(/not complete/i.test(describeSheetCoverage(empty)), "copy says the sheet is not complete");

const marked = planSheetCoverage(plan, [
  { type: "count", sheet: 52, x: 17, y: 40, typeCode: "2" },
  { type: "count", sheet: 52, x: 40, y: 55, typeCode: "2" },
]);
assert(marked.scannedCount >= 1 && marked.complete === false, "partial detections do not complete the sheet");
assert(marked.unresolvedRegions.every((region) => region.typeCode === "UNSCANNED"), "unresolved cells become review regions");

const full = planSheetCoverage(plan, coverageFill(52));
assert(full.complete === true && full.unscannedCount === 0, "a fully analyzed plan can complete");

const pages = pagesCoverage([cover, legend, plan], []);
assert(pages.sheets.find((sheet) => sheet.sheet === 1)?.complete === true, "non-plan cover is not left incomplete");
assert(pages.incomplete >= 1, "applicable empty plans stay incomplete");

const merged = mergeReviewQueue([{ id: "u1", typeCode: "UNKNOWN" }], empty, 52);
assert(merged.some((item) => item.id === "u1"), "device review items stay in the queue");
assert(merged.filter((item) => item.type === "coverage").length === 12, "unscanned regions join the review queue");
assert(neighborQueueId(merged, "u1", 1) === merged[1].id, "review navigation walks coverage after devices");

if (!process.exitCode) console.log("sheet coverage checks passed");

function coverageFill(sheet) {
  return [
    { type: "count", sheet, x: 15, y: 22 },
    { type: "count", sheet, x: 30, y: 22 },
    { type: "count", sheet, x: 50, y: 22 },
    { type: "count", sheet, x: 70, y: 22 },
    { type: "count", sheet, x: 15, y: 48 },
    { type: "count", sheet, x: 30, y: 48 },
    { type: "count", sheet, x: 50, y: 48 },
    { type: "count", sheet, x: 70, y: 48 },
    { type: "count", sheet, x: 15, y: 74 },
    { type: "count", sheet, x: 30, y: 74 },
    { type: "count", sheet, x: 50, y: 74 },
    { type: "count", sheet, x: 70, y: 74 },
  ];
}
