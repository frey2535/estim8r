import { orthogonalizePolyline, previewOrthogonalSegment, snapOrthogonalPoint } from "./ortho.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const snapped = snapOrthogonalPoint({ x: 10, y: 10 }, { x: 40, y: 18 });
assert(snapped.x === 40 && snapped.y === 10, "longer horizontal wins");
const vertical = snapOrthogonalPoint({ x: 10, y: 10 }, { x: 12, y: 40 });
assert(vertical.x === 10 && vertical.y === 40, "longer vertical wins");

const path = orthogonalizePolyline([
  { x: 0, y: 0 },
  { x: 20, y: 5 },
  { x: 22, y: 30 },
]);
assert(path[1].y === 0 && path[2].x === 20, "polyline corners stay on 90°");

const preview = previewOrthogonalSegment([{ x: 0, y: 0 }], { x: 12, y: 9 });
assert(preview[1].x === 12 && preview[1].y === 0, "draft preview snaps to ortho");

if (!process.exitCode) console.log("ortho checks passed");
