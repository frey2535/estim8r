import { describeReconciliation, reconcilePlanToSchedule, scheduleItemsFromPages } from "./countReconciliation.js";
import { persistedPlanDeviceCount } from "./symbolDetection.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const pages = [
  {
    page: 2,
    kind: "drawing",
    tokens: [
      { text: "ELECTRICAL POWER PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "R", x: 20, y: 30 },
    ],
  },
  {
    page: 8,
    kind: "legend",
    tokens: [
      { text: "ELECTRICAL LEGEND", x: 20, y: 12 },
      { text: "E0.01", x: 92, y: 94 },
      { text: "TYPE", x: 8, y: 18 },
      { text: "QTY", x: 48, y: 18 },
      { text: "R", x: 8, y: 22 },
      { text: "DUPLEX", x: 14, y: 22 },
      { text: "RECEPTACLE", x: 24, y: 22 },
      { text: "24", x: 48, y: 22 },
      { text: "1E", x: 8, y: 26 },
      { text: "2x4", x: 14, y: 26 },
      { text: "EMERGENCY", x: 20, y: 26 },
      { text: "7", x: 48, y: 26 },
    ],
  },
];

const items = scheduleItemsFromPages(pages, "electrical");
assert(items.find((item) => item.abbr === "R")?.scheduleQty === 24, "legend qty 24 is read as a schedule check");
assert(items.find((item) => item.abbr === "1E")?.scheduleQty === 7, "legend qty 7 is read for type 1E");

const marks = [
  { type: "count", sheet: 2, typeCode: "R", abbr: "R", trade: "electrical" },
  { type: "count", sheet: 2, typeCode: "1E", abbr: "1E", trade: "electrical" },
  { type: "count", sheet: 8, typeCode: "R", abbr: "R", source: "legend", trade: "electrical" },
];
const pageKinds = { 2: "drawing", 8: "legend" };
const result = reconcilePlanToSchedule({ marks, pages, pageKinds, trade: "electrical" });
assert(result.persistedCount === 2, `persisted count is the plan, got ${result.persistedCount}`);
assert(persistedPlanDeviceCount(marks, pageKinds) === 2, "legend-row marks are not persisted");
assert(result.rows.find((row) => row.type === "R")?.planCount === 1, "R plan count is 1");
assert(result.rows.find((row) => row.type === "R")?.scheduleQty === 24, "R schedule qty stays 24 for review");
assert(result.rows.find((row) => row.type === "R")?.status === "short", "legend total is a discrepancy, not the takeoff");
assert(result.discrepancyCount >= 1, "the estimator sees the short count");
assert(!/24 plan/.test(describeReconciliation(result)), "copy does not treat 24 as the takeoff");
assert(/plan count/i.test(describeReconciliation(result)), "copy says the plan count is kept");

const junkLegend = {
  page: 48,
  kind: "legend",
  sheetId: "E001",
  tokens: [
    { text: "ELECTRICAL", x: 20, y: 8 },
    { text: "LEGEND", x: 32, y: 8 },
    { text: "QUANTITIES", x: 8, y: 14 },
    { text: "SHOWN", x: 22, y: 14 },
    { text: "ARE", x: 30, y: 14 },
    { text: "APPROXIMATE", x: 36, y: 14 },
    { text: "NO", x: 8, y: 18 },
    { text: "QUANTITIES", x: 14, y: 18 },
    { text: "1", x: 48, y: 18 },
    { text: "ALL", x: 8, y: 22 },
    { text: "FIXTURES", x: 14, y: 22 },
    { text: "4", x: 48, y: 22 },
    { text: "10,434 SF", x: 8, y: 26 },
    { text: "FIRST", x: 22, y: 26 },
    { text: "FLOOR", x: 30, y: 26 },
    { text: "4", x: 48, y: 26 },
    { text: "W4-2", x: 8, y: 30 },
    { text: "WALL", x: 16, y: 30 },
    { text: "TYPE", x: 22, y: 30 },
    { text: "9", x: 48, y: 30 },
    { text: "FX-10", x: 8, y: 34 },
    { text: "FIRE", x: 16, y: 34 },
    { text: "EXTINGUISHER", x: 22, y: 34 },
    { text: "2", x: 48, y: 34 },
    { text: "DS", x: 8, y: 38 },
    { text: "DOWNSPOUT", x: 14, y: 38 },
    { text: "9", x: 48, y: 38 },
    { text: "TYPE", x: 8, y: 44 },
    { text: "QTY", x: 48, y: 44 },
    { text: "1", x: 8, y: 48 },
    { text: "2x4", x: 14, y: 48 },
    { text: "TROFFER", x: 22, y: 48 },
    { text: "11", x: 48, y: 48 },
  ],
};
const powerPlan = {
  page: 50,
  kind: "other",
  sheetId: "E110",
  title: "E110 POWER & SYSTEMS PLANS",
  tokens: [
    { text: "E110", x: 90, y: 92 },
    { text: "POWER", x: 80, y: 90 },
    { text: "&", x: 86, y: 90 },
    { text: "SYSTEMS", x: 88, y: 90 },
    { text: "PLANS", x: 94, y: 90 },
  ],
};
const junkItems = scheduleItemsFromPages([junkLegend], "electrical");
assert(!junkItems.some((item) => /ALL|NO|QUANTITIES|W4-2|FX-10|DS|10,434/i.test(String(item.abbr || item.type))), "legend notes are not fixture types");
assert(junkItems.find((item) => item.abbr === "1")?.scheduleQty === 11, "real fixture type 1 qty stays a check");

const architectural = {
  page: 18,
  kind: "drawing",
  sheetId: "A111",
  title: "A111 FIRST FLOOR PLAN",
  tokens: [
    { text: "A111", x: 90, y: 92 },
    { text: "FIRST", x: 80, y: 90 },
    { text: "FLOOR", x: 86, y: 90 },
    { text: "PLAN", x: 92, y: 90 },
  ],
};
const pottsvilleReview = reconcilePlanToSchedule({
  marks: [
    { type: "count", sheet: 50, category: "Receptacles", symbol: "duplex", symbolLabel: "Duplex receptacle", symbolBodyLocation: { x: 20, y: 30 } },
    { type: "count", sheet: 50, category: "Receptacles", symbol: "duplex", symbolLabel: "Duplex receptacle", typeCode: "R", abbr: "R", symbolBodyLocation: { x: 24, y: 32 } },
    { type: "count", sheet: 50, layer: "review", symbol: "unknown", typeCode: "UNKNOWN", category: "Receptacles", symbolBodyLocation: { x: 28, y: 34 } },
    { type: "count", sheet: 18, category: "Receptacles", symbol: "duplex", abbr: "R" },
  ],
  scheduleItems: [
    { type: "ALL", abbr: "ALL", scheduleQty: 4, label: "ALL FIXTURES" },
    { type: "10,434 SF", abbr: "10,434 SF", scheduleQty: 4, label: "FIRST FLOOR" },
    { type: "W4-2", abbr: "W4-2", scheduleQty: 9, label: "WALL TYPE" },
    { type: "FX-10", abbr: "FX-10", scheduleQty: 2, label: "FIRE EXTINGUISHER" },
    { type: "DS", abbr: "DS", scheduleQty: 9, label: "DOWNSPOUT" },
    { type: "NO", abbr: "NO", scheduleQty: 1, label: "QUANTITIES" },
    { type: "QUANTITIES", abbr: "QUANTITIES", scheduleQty: 7, label: "SHOWN ARE" },
    { type: "1", abbr: "1", scheduleQty: 11, label: "2x4 TROFFER" },
  ],
  pages: [junkLegend, powerPlan, architectural],
  pageKinds: { 18: "drawing", 48: "legend", 50: "other" },
  trade: "electrical",
});
const junkTypes = pottsvilleReview.rows.filter((row) => /ALL|NO|QUANTITIES|W4-2|FX-10|^DS$|10,434|SF/i.test(row.type));
assert(junkTypes.length === 0, `junk schedule types stay out of the table, got ${junkTypes.map((row) => row.type).join(",")}`);
assert(!pottsvilleReview.rows.some((row) => row.status === "short" && /ALL|SF|W4|FX|DS|NO|QUANTIT/i.test(row.type)), "junk rows are not flagged short");
assert(pottsvilleReview.rows.find((row) => row.type === "R")?.planCount === 3, `sheet 50 receptacles are the plan count, got ${pottsvilleReview.rows.find((row) => row.type === "R")?.planCount}`);
assert(pottsvilleReview.rows.find((row) => row.type === "1")?.scheduleQty === 11, "printed type 1 qty remains a check");
assert(pottsvilleReview.rows.find((row) => row.type === "1")?.planCount === 0, "missing lighting type stays 0 on the plan");
assert(pottsvilleReview.rows.find((row) => row.type === "1")?.status === "short", "real missing fixture type can still show short");

const abbrevReview = reconcilePlanToSchedule({
  marks: [
    { type: "count", sheet: 50, x: 82, y: 40, typeCode: "AC", abbr: "AC", category: "Low Voltage" },
    { type: "count", sheet: 50, x: 83, y: 42, typeCode: "FFE", abbr: "FFE" },
    { type: "count", sheet: 50, x: 84, y: 44, typeCode: "ELEC", abbr: "ELEC" },
    { type: "count", sheet: 50, x: 81, y: 30, typeCode: "R", abbr: "R", category: "Receptacles", symbolLabel: "RECEPTACLES ≤ 10KVA PHASE A LOAD" },
    { type: "count", sheet: 50, x: 22, y: 40, typeCode: "R", abbr: "R", category: "Receptacles", symbol: "duplex", symbolBodyLocation: { x: 22, y: 40 } },
  ],
  scheduleItems: [
    { type: "AC", abbr: "AC", scheduleQty: 4, label: "ALTERNATING CURRENT" },
    { type: "FFE", abbr: "FFE", scheduleQty: 20, label: "FIXTURES FURNITURE EQUIPMENT" },
    { type: "ELEC", abbr: "ELEC", scheduleQty: 7, label: "ELECTRICAL" },
  ],
  pages: [powerPlan],
  pageKinds: { 50: "drawing" },
  trade: "electrical",
});
assert(!abbrevReview.rows.some((row) => /^(AC|FFE|ELEC)$/.test(row.type)), "abbreviation-list words are not fixture types");
assert(abbrevReview.rows.find((row) => row.type === "R")?.planCount === 1, "schedule-header Type R in the notes band is not a receptacle count");

if (!process.exitCode) console.log("count reconciliation checks passed");
