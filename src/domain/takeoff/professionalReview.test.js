import {
  applyReviewCommand,
  filterMarksByInspect,
  hoverBoundToLegend,
  inspectTypes,
  marksOfType,
  revisionCompare,
} from "./professionalReview.js";
import { legendHoverData } from "./legendHover.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const gfi = { id: "g1", type: "count", sheet: 51, x: 12, y: 18, typeCode: "GFI", abbr: "GFI", symbol: "gfci", symbolLabel: "GFCI receptacle", category: "Receptacles", reviewStatus: "pending" };
const gfi2 = { id: "g2", type: "count", sheet: 51, x: 14, y: 20, typeCode: "GFI", abbr: "GFI", symbol: "gfci", symbolLabel: "GFCI receptacle", category: "Receptacles", reviewStatus: "pending" };
const os = { id: "o1", type: "count", sheet: 50, x: 22, y: 30, typeCode: "OS", abbr: "OS", symbol: "occ", symbolLabel: "Occupancy sensor", category: "Switches", reviewStatus: "pending" };
const unknown = { id: "u1", type: "count", sheet: 50, x: 40, y: 40, typeCode: "UNKNOWN", symbol: "unknown", layer: "review", reviewStatus: "pending" };

const marks = [gfi, gfi2, os, unknown];
assert(marksOfType(marks, "GFI").length === 2, "inspect by type returns both GFI marks");
assert(marksOfType(marks, "OS", { sheet: 50 }).length === 1, "inspect by type honors sheet");
assert(inspectTypes(marks).some((row) => row.type === "GFI" && row.count === 2), "type rollup counts GFI");
assert(filterMarksByInspect(marks, { type: "OS", sheet: 50 }).map((item) => item.id).join() === "o1", "inspect filter keeps the selected type");

const accepted = applyReviewCommand(marks, { action: "accept", mark: gfi });
assert(accepted.find((item) => item.id === "g1").reviewStatus === "accepted", "accept keeps the selected GFI");
assert(accepted.find((item) => item.id === "g2").reviewStatus === "accepted", "accept applies to the same typed family");

const rejected = applyReviewCommand(marks, { action: "reject", mark: unknown });
assert(rejected.find((item) => item.id === "u1").reviewStatus === "rejected", "reject uncertain marks one-by-one");
assert(rejected.find((item) => item.id === "g1").reviewStatus === "pending", "reject does not wipe typed GFI");

const gfiSymbol = { id: "gfci", abbr: "GFI", label: "GFCI receptacle", takeoffCategory: "Receptacles", source: "legend", page: 47 };
const wpSymbol = { id: "wp", abbr: "WP", label: "Weatherproof receptacle", takeoffCategory: "Receptacles", source: "legend", page: 47 };
const reclass = applyReviewCommand(marks, { action: "reclassify", mark: gfi, symbol: wpSymbol }, { drawingSymbols: [gfiSymbol, wpSymbol] });
assert(reclass.find((item) => item.id === "g1").typeCode === "WP", "reclassify writes the new type");
assert(reclass.find((item) => item.id === "g1").legendCode === "WP", "reclassify binds the mark to the WP legend entry");

const moved = applyReviewCommand(marks, { action: "move", mark: os, point: { x: 24.2, y: 31.1 } });
assert(Math.abs(moved.find((item) => item.id === "o1").x - 24.2) < 0.001, "move updates the symbol body");

const resized = applyReviewCommand(marks, { action: "resize", mark: os, bounds: { w: 0.9, h: 0.8 } });
assert(resized.find((item) => item.id === "o1").symbolBodyBounds.w === 0.9, "resize writes new bounds");

const added = applyReviewCommand(marks, {
  action: "add",
  sheet: 51,
  symbol: wpSymbol,
  point: { x: 30, y: 16 },
}, { drawingSymbols: [wpSymbol] });
assert(added.length === marks.length + 1, "add inserts a manual device");
assert(added.at(-1).source === "manual" && added.at(-1).typeCode === "WP", "manual add is an accepted WP");
assert(added.at(-1).legendCode === "WP", "manual add hover binds to the WP legend");

const hover = hoverBoundToLegend({
  type: "count",
  typeCode: "GFI",
  abbr: "GFI",
  symbol: "gfci",
  symbolLabel: "GFCI receptacle",
}, [gfiSymbol]);
assert(hover.bound && hover.code === "GFI" && hover.hover.verified, "hover is bound to the matching legend entry");
assert(legendHoverData(hover.mark, [gfiSymbol]).code === "GFI", "enriched mark still resolves the same legend code");

const compare = revisionCompare(
  [gfi, os],
  [
    { ...gfi, x: 18, y: 18 },
    { ...os, typeCode: "VS", abbr: "VS" },
    { id: "n1", type: "count", sheet: 51, x: 8, y: 8, typeCode: "WP", abbr: "WP" },
  ],
);
assert(compare.addedCount === 1, "revision compare reports the added WP");
assert(compare.removedCount === 0, "stable ids are not removed");
assert(compare.movedCount === 1, "moved GFI is a revision move");
assert(compare.reclassifiedCount === 1, "OS to VS is a reclassify");

if (!process.exitCode) console.log("phase 3 professional review recorded");
