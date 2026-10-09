import assert from "node:assert/strict";
import { classifyAdjacentAnnotation, resolveAdjacentAnnotations } from "./adjacentAnnotations.js";
for (const tag of ["L1", "L5A", "X1", "F1", "EF-1"]) {
  assert.equal(classifyAdjacentAnnotation(tag).kind, "equipment", tag);
}
for (const number of ["25", "17", "19", "21", "23", "1", "5"]) {
  assert.equal(classifyAdjacentAnnotation(number).kind, "circuit", number);
}
assert.deepEqual(classifyAdjacentAnnotation("LP-17").circuits, ["17"]);
assert.equal(classifyAdjacentAnnotation("TRAINING ROOM").kind, "unresolved");
const resolved = resolveAdjacentAnnotations([
  { text: "EF-1", distance: 2 },
  { text: "25", distance: 3 },
  { text: "TRAINING ROOM", distance: 8 },
]);
assert.equal(resolved.equipmentId, "EF-1");
assert.deepEqual(resolved.circuitNumbers, ["25"]);
assert.deepEqual(resolved.unresolved, ["TRAINING ROOM"]);
console.log("adjacent annotation tests passed");
