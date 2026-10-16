import { assembleTrofferNearTag, looksLikeTrofferShard, tagOnSymbolGeometry } from "./vectorSymbols.js";
import { dedupePhysicalSymbols } from "./takeoffQuality.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const shards = [
  { cx: 20.05, cy: 20.02, w: 0.18, h: 0.16, kind: "rect" },
  { cx: 20.28, cy: 20.00, w: 0.2, h: 0.15, kind: "rect" },
  { cx: 20.50, cy: 20.04, w: 0.19, h: 0.16, kind: "rect" },
];
assert(shards.every(looksLikeTrofferShard), "compact troffer fragments are shards, not walls");
const clustered = assembleTrofferNearTag({ text: "'1'", x: 20.2, y: 20.02 }, shards);
assert(clustered && clustered.source === "vector" && clustered.w >= 0.4, `quoted type 1 clusters nearby shards, got ${JSON.stringify(clustered)}`);

const tagBody = tagOnSymbolGeometry({ text: "GFI", x: 12, y: 18 }, { shapeHint: "circle" });
assert(tagBody?.cx === 12 && tagBody?.cy === 18 && tagBody.source === "text", "printed GFI without a vector body sits on the tag");

const labeled = {
  type: "count",
  sheet: 50,
  x: 10,
  y: 10,
  typeCode: "1E",
  labelLocation: { x: 10, y: 10 },
  matchedFrom: "drawing",
  combinedConfidence: 0.7,
};
const clone = {
  type: "count",
  sheet: 50,
  x: 10.1,
  y: 10.05,
  typeCode: "1E",
  matchedFrom: "legend-recovery",
  combinedConfidence: 0.7,
};
const kept = dedupePhysicalSymbols([clone, labeled]);
assert(kept.length === 1 && kept[0].labelLocation, "same-type clones keep the printed-tag mark");

if (!process.exitCode) console.log("phase 2 detection helpers recorded");
