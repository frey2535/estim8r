import assert from "node:assert/strict";
import { applySavedLineOrder, moveEstimateLine } from "./lineOrder.js";
import { buildEstimateSupplyQuote } from "./estimateSupplyQuote.js";
import { writeEstimate, openEstimateSession, startNewEstimate } from "./estimateStore.js";

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: (key) => { store.delete(key); },
};

const lines = [
  { id: "emt", description: '1/2" EMT', quantity: 10 },
  { id: "pvc", description: '3/4" PVC', quantity: 1 },
  { id: "lights", description: "Roadside lights", quantity: 2 },
];

assert.deepEqual(moveEstimateLine(lines, 0, 2).map((row) => row.id), ["pvc", "lights", "emt"]);
assert.deepEqual(moveEstimateLine(lines, 2, 0).map((row) => row.id), ["lights", "emt", "pvc"]);
assert.deepEqual(moveEstimateLine(lines, 0, 0).map((row) => row.id), ["emt", "pvc", "lights"]);
assert.deepEqual(moveEstimateLine(lines, -1, 1).map((row) => row.id), ["emt", "pvc", "lights"]);
assert.notEqual(moveEstimateLine(lines, 1, 0), lines);

const quote = buildEstimateSupplyQuote({
  lines: moveEstimateLine(lines, 0, 2).map((row) => ({ ...row, itemType: "Material" })),
});
assert.deepEqual(quote.rows.map((row) => row.description), ['3/4" PVC', "Roadside lights", '1/2" EMT']);

assert.deepEqual(
  applySavedLineOrder(
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    ["c", "a"],
  ).map((row) => row.id),
  ["c", "a", "b"],
);

startNewEstimate();
const reordered = moveEstimateLine(lines, 0, 2);
writeEstimate({
  fileName: "standalone:reorder-demo",
  fileSize: 0,
  header: { projectName: "Reorder demo" },
  lines: reordered,
});
const standalone = openEstimateSession({ fileName: "standalone:reorder-demo", fileSize: 0 });
assert.deepEqual(standalone.lines.map((row) => row.id), ["pvc", "lights", "emt"], "standalone save keeps the moved order");

writeEstimate({
  fileName: "takeoff.pdf",
  fileSize: 12,
  header: { projectName: "Takeoff job" },
  lines: reordered,
});
const takeoff = openEstimateSession({ fileName: "takeoff.pdf", fileSize: 12 });
assert.deepEqual(takeoff.lines.map((row) => row.id), ["pvc", "lights", "emt"], "takeoff-generated save keeps the moved order");

console.log("line order tests passed");
