import assert from "node:assert/strict";
import {
  addSlipSheet,
  addToolChestItem,
  countInteractiveObjects,
  interactiveOpenMessage,
  interleaveSlipSheets,
  isPageTakeoffEnabled,
  mergeStudioPackage,
  normalizePageTakeoff,
  pagesIncludedInTakeoff,
  quantityLinkChecksum,
  quantityLinkCsv,
  setPageTakeoff,
  studioPackage,
  visualSearchCounts,
  volumeCubicFeet,
} from "./interactiveSheet.js";
import {
  buildDrawingObjectLayer,
  classifySheetPath,
  enclosingRoom,
  hitDrawingObject,
  materializeDrawingObject,
} from "./drawingObjectLayer.js";
import { rollupTakeoff } from "./quantities.js";
import { buildAiMarks } from "./aiTakeoff.js";
import { DRAW_CLOSE, DRAW_LINE, DRAW_MOVE, sheetGeometryFromConstructedPaths } from "./vectorSymbols.js";

const symbol = { kind: "rect", cx: 10, cy: 12, w: 0.8, h: 0.6 };
const line = { kind: "rect", cx: 40, cy: 20, w: 18, h: 0.2 };
const room = { kind: "rect", cx: 50, cy: 50, w: 20, h: 16 };
const border = { kind: "rect", cx: 50, cy: 50, w: 96, h: 96 };

assert.equal(classifySheetPath(symbol), "symbol");
assert.equal(classifySheetPath(line), "circuit");
assert.equal(classifySheetPath(room), "room");
assert.equal(classifySheetPath(border), null, "sheet border is not a room");

const objects = buildDrawingObjectLayer({
  pages: [{ page: 2, paths: [symbol, line, room, border] }],
});
assert.equal(countInteractiveObjects(objects).symbols, 1);
assert.equal(countInteractiveObjects(objects).circuits, 1);
assert.equal(countInteractiveObjects(objects).rooms, 1);

const symbolHit = hitDrawingObject(objects, { x: 10, y: 12 }, 2);
assert.equal(symbolHit.objectKind, "unclassified-vector");
const lineHit = hitDrawingObject(objects, { x: 40, y: 20 }, 2);
assert.equal(lineHit.objectKind, "circuit");
assert.equal(hitDrawingObject(objects, { x: 55, y: 50 }, 2)?.objectKind, "room", "a click inside the room and off the line selects the room");
assert.equal(hitDrawingObject(objects, { x: 39.9, y: 50 }, 2)?.objectKind, "room", "a click on the room wall stroke selects the room");
assert.equal(hitDrawingObject(objects, { x: 39.4, y: 50 }, 2), null, "a click beside the wall does not select the room");
const roomHit = enclosingRoom(objects, { x: 48, y: 48 }, 2);
assert.equal(roomHit.objectKind, "room");

const nested = buildDrawingObjectLayer({
  pages: [{
    page: 1,
    paths: [
      { kind: "rect", cx: 30, cy: 30, w: 24, h: 20 },
      { kind: "rect", cx: 30, cy: 30, w: 8, h: 6 },
      symbol,
    ],
  }],
});
assert.equal(hitDrawingObject(nested, { x: 10, y: 12 }, 1).objectKind, "unclassified-vector", "a symbol wins over the room around it");
assert.equal(enclosingRoom(nested, { x: 30, y: 30 }, 1).w, 8, "dynamic fill uses the smallest room that contains the click");

const materializedLine = materializeDrawingObject(lineHit, []);
assert.equal(materializedLine.existing, false);
assert.equal(materializedLine.mark.bidUse, false);
assert.equal(materializedLine.mark.prediction, true);
assert.equal(materializedLine.mark.editable, true);
const again = materializeDrawingObject(lineHit, [materializedLine.mark]);
assert.equal(again.existing, true);

const rollup = rollupTakeoff([
  materializedLine.mark,
  { id: "kept", type: "count", category: "Receptacles", symbolLabel: "Duplex", sheet: 1 },
], null, 1);
assert.equal(rollup.rows.find((row) => row.symbol === "Duplex")?.count, 1);
assert.equal(rollup.rows.some((row) => row.symbol === "Line"), false, "an unnamed line is not bid length");

const pages = normalizePageTakeoff({ 2: false }, 3);
assert.equal(isPageTakeoffEnabled(pages, 1), true);
assert.equal(isPageTakeoffEnabled(pages, 2), false);
assert.equal(isPageTakeoffEnabled(setPageTakeoff(pages, 2, true), 2), true);
const included = pagesIncludedInTakeoff([
  { page: 1 },
  { page: 2, takeoffDisabled: true },
  { page: 3 },
], (page) => page.page !== 3);
assert.deepEqual(included.map((page) => page.page), [1]);

const empty = buildAiMarks({
  pages: [{ page: 1, takeoffDisabled: true, tokens: [{ text: "R", x: 10, y: 10 }], paths: [symbol], kind: "plan" }],
  trade: "electrical",
  symbols: [],
  timeBudgetMs: 500,
});
assert.equal(empty.deviceCount || empty.marks?.length || 0, 0);

assert.equal(volumeCubicFeet(100, 10), 1000);
assert.equal(volumeCubicFeet(100, 0), null);
const csv = quantityLinkCsv([
  { sheet: 1, type: "count", symbolLabel: "Duplex", circuit: "A-1", bidUse: true },
  { sheet: 2, objectKind: "room", roomName: "Storage", areaSf: 80, heightFeet: 10, prediction: true, bidUse: false },
], { slips: [{ afterPage: 1, title: "Addendum" }] });
assert.match(csv, /Storage/);
assert.match(csv, /800\.00/);
assert.match(csv, /Addendum/);
const checksum = await quantityLinkChecksum(csv);
assert.equal(checksum.algorithm, "SHA-256");
assert.equal(checksum.digest.length, 64);

const counts = visualSearchCounts([
  { sheet: 2, typeCode: "GFI", bidUse: true },
  { sheet: 2, typeCode: "GFI" },
  { sheet: 4, typeCode: "GFI" },
  { sheet: 3, typeCode: "GFI", bidUse: false },
], { typeCode: "GFI" });
assert.deepEqual(counts, [{ sheet: 2, count: 2 }, { sheet: 4, count: 1 }]);
assert.deepEqual(visualSearchCounts([], { typeCode: "UNKNOWN" }), []);

const chest = addToolChestItem([], { name: "Homerun red", tool: "homerun", color: "#dc2626", symbolId: "duplex" });
assert.equal(chest.length, 1);
assert.equal(addToolChestItem(chest, { name: "Homerun red", color: "#000000" })[0].color, "#000000");

const slips = addSlipSheet([], 2, "Revision cloud");
assert.deepEqual(interleaveSlipSheets(2, slips).map((row) => row.kind), ["sheet", "sheet", "slip-sheet"]);

const packed = studioPackage({ fileName: "E1.pdf", marks: [{ id: "a", x: 1 }], pageTakeoff: { 1: true } });
const merged = mergeStudioPackage([{ id: "a", x: 1, note: "kept" }, { id: "b", x: 2 }], {
  ...packed,
  marks: [{ id: "a", x: 9 }, { id: "c", x: 3 }],
});
assert.equal(merged.find((mark) => mark.id === "a").x, 9);
assert.equal(merged.find((mark) => mark.id === "a").note, "kept");
assert.equal(merged.find((mark) => mark.id === "c").x, 3);
assert.equal(mergeStudioPackage([{ id: "a" }], { kind: "other", marks: [] }).length, 1);

assert.match(interactiveOpenMessage("E1.pdf", { symbols: 2, circuits: 1, rooms: 1 }), /interactive/);
assert.match(interactiveOpenMessage("photo.png", {}, { image: true }), /PDF vector layer/);

const sheetGeometry = sheetGeometryFromConstructedPaths([{
  ctm: [1, 0, 0, 1, 0, 0],
  drawOps: [
    DRAW_MOVE, 40, 42, DRAW_LINE, 60, 42, DRAW_LINE, 60, 58, DRAW_LINE, 40, 58, DRAW_CLOSE,
    DRAW_MOVE, 31, 20, DRAW_LINE, 49, 20.2,
    DRAW_MOVE, 10, 12, DRAW_LINE, 10.8, 12, DRAW_LINE, 10.8, 12.6, DRAW_LINE, 10, 12.6, DRAW_CLOSE,
  ],
}], (x, y) => ({ x, y }));
assert.equal(sheetGeometry.length, 2, "line and room geometry stay available without becoming symbols");
const fromSheet = buildDrawingObjectLayer({ pages: [{ page: 1, paths: [], sheetGeometry }] });
assert.equal(countInteractiveObjects(fromSheet).circuits, 1);
assert.equal(countInteractiveObjects(fromSheet).rooms, 1);
assert.equal(countInteractiveObjects(fromSheet).symbols, 0);

console.log("interactive sheet checks passed");
