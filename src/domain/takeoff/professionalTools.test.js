import assert from "node:assert/strict";
import {
  aerialLengthMark,
  applyRemoteMark,
  createSigningKey,
  cropToObject,
  evaluateFormula,
  haversineFeet,
  interleavePages,
  markFromAssembly,
  measureMark,
  quantityWorkbookRows,
  readLiveQuantity,
  rememberLiveQuantity,
  reportLines,
  revisionReport,
  signQuantity,
  spreadsheetMl,
  verifyQuantity,
  visualSearchGeometry,
  wasteQuantity,
} from "./professionalTools.js";

const objects = [
  { objectId: "a", objectKind: "unclassified-vector", sheet: 1, x: 10, y: 10, w: 0.8, h: 0.6 },
  { objectId: "b", objectKind: "unclassified-vector", sheet: 2, x: 30, y: 40, w: 0.82, h: 0.58 },
  { objectId: "c", objectKind: "unclassified-vector", sheet: 3, x: 70, y: 70, w: 2.2, h: 1.4 },
  { objectId: "d", objectKind: "room", sheet: 2, x: 50, y: 50, w: 0.8, h: 0.6 },
];
const search = visualSearchGeometry(objects, objects[0]);
assert.equal(search.total, 2);
assert.deepEqual(search.sheets, [{ sheet: 1, count: 1 }, { sheet: 2, count: 1 }]);

const calibration = { feet: 10, percentLength: 10 };
const measured = measureMark({
  type: "area",
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  heightFeet: 8,
}, calibration, 1);
assert.ok(measured.areaSf > 0);
assert.ok(measured.perimeterLf > measured.lengthLf);
assert.equal(measured.volumeCf, measured.areaSf * 8);

assert.equal(evaluateFormula("qty * (1 + waste / 100)", { qty: 10, waste: 10 }).value, 11);
assert.equal(evaluateFormula("10 / 0").ok, false);
assert.equal(evaluateFormula("alert(1)").ok, false);
assert.equal(wasteQuantity(10, 10), 11);

const placed = markFromAssembly({ id: "device-duplex-receptacle", name: "Duplex", category: "Receptacles", components: [{ id: "box" }] }, { x: 12, y: 18 }, 3);
assert.equal(placed.assemblyId, "device-duplex-receptacle");
assert.equal(placed.sheet, 3);
assert.equal(placed.components.length, 1);

const report = revisionReport(
  [{ id: "a", objectId: "obj-a", sheet: 1, typeCode: "R", x: 1, y: 1 }],
  [{ id: "b", objectId: "obj-b", sheet: 1, typeCode: "GFI", x: 2, y: 2 }],
);
assert.equal(report.added, 1);
assert.equal(report.removed, 1);

const frame = cropToObject({ object: { x: 80, y: 20, w: 10, h: 10 }, viewWidth: 800, viewHeight: 600, sheetWidth: 400, sheetHeight: 400 });
assert.ok(frame.zoom > 1);
assert.ok(frame.pan.x < 0);
assert.ok(frame.pan.y > 0);

const feet = haversineFeet({ lat: 40, lng: -75 }, { lat: 40.001, lng: -75 });
assert.ok(feet > 300 && feet < 400);
const aerial = aerialLengthMark({ lat: 40, lng: -75 }, { lat: 40.001, lng: -75 });
assert.equal(aerial.lengthEdited, true);
assert.ok(aerial.storedFeet > 300);

const xml = spreadsheetMl("Takeoff", quantityWorkbookRows([
  { sheet: 1, symbolLabel: "Duplex", type: "count", circuit: "A-1", assemblyId: "device-duplex-receptacle" },
]));
assert.match(xml, /Duplex/);
assert.match(xml, /ss:Type="Number"/);
assert.match(xml, /Excel.Sheet/);

const merged = applyRemoteMark([{ id: "a", x: 1 }], { kind: "estim8r-collab", op: "upsert", mark: { id: "b", x: 2 } });
assert.equal(merged.length, 2);
assert.equal(applyRemoteMark(merged, { kind: "estim8r-collab", op: "delete", markId: "a" }).length, 1);
assert.equal(applyRemoteMark(merged, { kind: "estim8r-collab", op: "request", sender: "other" }).length, 2);
assert.deepEqual(interleavePages(2, [{ afterPage: 1, title: "Addendum" }]).map((row) => row.label), ["Sheet 1", "Addendum", "Sheet 2"]);

const key = await createSigningKey();
const signature = await signQuantity(key.privateKey, "qty,1");
assert.equal(await verifyQuantity(key.publicKey, "qty,1", signature), true);
assert.equal(await verifyQuantity(key.publicKey, "qty,2", signature), false);

assert.equal(reportLines([
  { category: "Receptacles", symbolLabel: "Duplex", type: "count", bidUse: true },
  { category: "Receptacles", symbolLabel: "Duplex", type: "count" },
  { category: "Rooms", symbolLabel: "Line", type: "route", bidUse: false },
]).length, 1);

const memory = new Map();
const storage = {
  setItem(key, value) { memory.set(key, value); },
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
};
rememberLiveQuantity({ kind: "estim8r-quantity", csv: "Name,Count\nDuplex,1", updatedAt: "2026-10-17T00:00:00.000Z" }, storage);
assert.equal(readLiveQuantity(storage).csv, "Name,Count\nDuplex,1");
assert.equal(readLiveQuantity({ getItem() { return "{"; } }), null);

console.log("professional tool checks passed");
