import {
  attachJunctionToConduit,
  connectorsForJunctionBox,
  createJunctionBoxMark,
  junctionHardwareRows,
  junctionHardwareTotals,
} from "./junctionHardware.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const box = createJunctionBoxMark({
  id: "jb1",
  point: { x: 50, y: 20 },
  connectorCount: 0,
});
const run = {
  id: "c1",
  tool: "conduit",
  type: "route",
  points: [{ x: 10, y: 20 }, { x: 50, y: 20 }, { x: 70, y: 20 }],
  junctionBoxIds: ["jb1"],
};
assert(connectorsForJunctionBox(box, [run, box]) === 2, "through box needs two EMT connectors");

const endBox = createJunctionBoxMark({
  id: "jb2",
  point: { x: 90, y: 40 },
  connectorCount: 0,
});
const endRun = attachJunctionToConduit({
  id: "c2",
  tool: "conduit",
  type: "route",
  points: [{ x: 10, y: 40 }, { x: 90, y: 40 }],
}, endBox);
assert(connectorsForJunctionBox(endBox, [endRun, endBox]) === 1, "end box needs one connector");

const forced = createJunctionBoxMark({ id: "jb3", point: { x: 1, y: 1 }, connectorCount: 3 });
assert(connectorsForJunctionBox(forced, []) === 3, "explicit connector count wins");

const totals = junctionHardwareTotals([box, endBox, run, endRun]);
assert(totals.junctionBoxes === 2, "counts junction boxes");
assert(totals.emtConnectors === 3, "sums connectors across boxes");

const rows = junctionHardwareRows([box, endBox, run, endRun]);
assert(rows.rows.length === 2, "schedule shows JB and connector totals only");
assert(rows.rows.some((row) => /junction box/i.test(row.symbol) && row.count === 2), "JB total row");
assert(rows.rows.some((row) => /EMT connector/i.test(row.symbol) && row.count === 3), "connector total row");

if (!process.exitCode) console.log("junction hardware checks passed");
