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

if (!process.exitCode) console.log("count reconciliation checks passed");
