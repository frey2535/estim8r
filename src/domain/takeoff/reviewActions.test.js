import {
  changeReviewDeviceType,
  createManualDeviceMark,
  moveReviewMark,
  projectPrototypesFromCorrections,
  resizeReviewBounds,
} from "./reviewActions.js";
import { attachProjectPrototypes } from "./legendGeometry.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const unknown = {
  id: "u1",
  type: "count",
  sheet: 52,
  x: 40,
  y: 50,
  typeCode: "UNKNOWN",
  symbol: "unknown",
  layer: "review",
  outlineSource: "vector",
  outline: { kind: "rect", source: "vector", w: 0.62, h: 0.74 },
  reviewStatus: "pending",
};

const typed = changeReviewDeviceType([unknown], unknown, {
  id: "downlight",
  label: "Type 2 downlight",
  abbr: "2",
  takeoffCategory: "Lighting",
});
assert(typed[0].typeCode === "2" && typed[0].reviewStatus === "accepted", "changing type accepts the mark as that device");
assert(typed[0].correction === "type" && typed[0].layer === "device", "type correction leaves the review layer");

const moved = moveReviewMark(typed, typed[0], { x: 41.2, y: 50.4 });
assert(Math.abs(moved[0].x - 41.2) < 0.01 && moved[0].symbolBodyLocation.x === 41.2, "move updates symbol body location");

const resized = resizeReviewBounds(moved, moved[0], { w: 0.7, h: 0.8 });
assert(resized[0].outline.w === 0.7 && resized[0].symbolBodyBounds.w === 0.7, "resize corrects symbol bounds");
assert(resized[0].correction === "bounds", "bounds correction is recorded");

const added = createManualDeviceMark({
  sheet: 52,
  symbol: { id: "downlight", label: "Type 2 downlight", abbr: "2", takeoffCategory: "Lighting" },
  x: 58.74,
  y: 81.86,
});
assert(added.source === "manual" && added.reviewStatus === "accepted" && added.typeCode === "2", "manual add is an accepted plan device");

const protos = projectPrototypesFromCorrections([...resized, added]);
assert(protos.some((item) => item.code === "2" && item.prototype.w >= 0.6), "safe corrections become project prototypes");
assert(!projectPrototypesFromCorrections([{ ...unknown, outlineSource: "text", correction: "type" }]).length, "text chips are not prototypes");

const dictionary = attachProjectPrototypes({
  entries: [{ code: "2", symbol: { id: "downlight", label: "Type 2" }, prototype: { w: 0.6, h: 0.72, kind: "rect" } }],
}, protos);
assert(dictionary.entries[0].prototypes.length >= 1, "project prototypes attach to the existing type entry");

if (!process.exitCode) console.log("review action checks passed");
