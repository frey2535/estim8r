import {
  clusterDeviceCallouts,
  compactConduitLabel,
  layoutOverlayCallouts,
  polylineAnchor,
} from "./overlayLayout.js";
import { DEFAULT_MARKER_SIZE, normalizeSavedLineSize, normalizeSavedMarkerSize } from "./sizes.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(DEFAULT_MARKER_SIZE <= 0.7, `default markers stay small, got ${DEFAULT_MARKER_SIZE}`);
assert(normalizeSavedMarkerSize(1.6) === DEFAULT_MARKER_SIZE, "legacy 1.6 marker size migrates down");
assert(normalizeSavedMarkerSize(0.8) === 0.8, "an intentional smaller size is kept");
assert(normalizeSavedLineSize(2) < 2, "legacy default line size migrates down");

assert(compactConduitLabel({ runNumber: 12, homerunCount: 3, conduitSize: '3/4"' }) === "R12·3", "idle conduit label is compact");
assert(
  compactConduitLabel({ runNumber: 12, homerunCount: 3, conduitSize: '3/4"' }, { selected: true, lengthText: "78.9 LF" })
    === 'R12 · 3 HR · 3/4" · 78.9 LF',
  "selected conduit label can show detail",
);
assert(compactConduitLabel({ runNumber: 2, parallelRuns: 4 }) === "R2×4", "parallel runs stay short");

const mid = polylineAnchor([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 50, y: 10 }]);
assert(mid.x === 30 && mid.y === 10, "conduit label anchors at mid-span, not the panel");

const clustered = clusterDeviceCallouts([
  { id: "a", abbr: "1x4", x: 10, y: 10 },
  { id: "b", abbr: "1x4", x: 11, y: 10.4 },
  { id: "c", abbr: "1x4", x: 10.6, y: 11 },
  { id: "d", abbr: "GFI", x: 40, y: 40 },
]);
assert(clustered.length === 2, "nearby same-type devices share one callout");
assert(clustered.some((item) => item.text === "1x4 ×3"), "cluster shows count instead of three labels");

const piled = layoutOverlayCallouts({
  conduits: Array.from({ length: 8 }, (_, index) => ({
    id: `c${index}`,
    runNumber: index + 1,
    homerunCount: 3,
    conduitSize: '3/4"',
    points: [{ x: 12 + index, y: 20 }, { x: 70, y: 18 }],
  })),
  devices: Array.from({ length: 12 }, (_, index) => ({
    id: `d${index}`,
    abbr: "1x4",
    x: 20 + (index % 4) * 0.6,
    y: 40 + Math.floor(index / 4) * 0.6,
  })),
});
assert(piled.conduitLabels.every((label) => !/LF/.test(label.text)), "idle conduit labels omit LF");
assert(piled.conduitLabels.every((label) => label.text.length <= 8), "idle conduit labels stay short");
assert(piled.deviceLabels.length === 0, "device markers have no type-code text");
const boxes = [...piled.conduitLabels];
let overlap = false;
for (let i = 0; i < boxes.length; i += 1) {
  for (let j = i + 1; j < boxes.length; j += 1) {
    const a = boxes[i];
    const b = boxes[j];
    if (a.x < b.x + b.w && a.x + a.w > b.x && a.y - a.h < b.y && a.y > b.y - b.h) overlap = true;
  }
}
assert(!overlap, "placed callouts do not sit on top of each other");

if (!process.exitCode) console.log("overlay layout checks passed");
