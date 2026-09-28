import { rollupTakeoff } from "./quantities.js";
import { createJunctionBoxMark } from "./junctionHardware.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const marks = [
  {
    id: "c1",
    type: "route",
    tool: "conduit",
    category: "Raceway",
    symbolLabel: '3/4" EMT',
    points: [{ x: 0, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 40 }],
    storedFeet: 40,
    lengthEdited: true,
    junctionBoxIds: ["jb1"],
  },
  createJunctionBoxMark({
    id: "jb1",
    point: { x: 50, y: 10 },
    connectorCount: 2,
  }),
  { id: "d1", type: "count", category: "Lighting", symbolLabel: "2x4", symbol: "2x4", x: 12, y: 12 },
];

const rollup = rollupTakeoff(marks, null, 1);
assert(rollup.junctionBoxes === 1, "rollup exposes JB total");
assert(rollup.emtConnectors === 2, "rollup exposes connector total");
assert(rollup.rows.some((row) => /junction box/i.test(row.symbol) && row.count === 1), "JB appears once as a total");
assert(rollup.rows.some((row) => /EMT connector/i.test(row.symbol) && row.count === 2), "connectors appear as a total");
assert(!rollup.rows.some((row) => row.symbol === "JB" && row.count === 1 && !/square/.test(row.symbol)), "no duplicate raw JB device row");
assert(rollup.rows.some((row) => row.symbolLabel === "2x4" || row.symbol === "2x4"), "fixture counts still roll up");

if (!process.exitCode) console.log("quantity hardware checks passed");
