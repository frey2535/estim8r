import {
  assignDeviceToConduit,
  associateDevicesToConduits,
  buildReviewMarkupPages,
  flattenMarkupMarks,
  reviewCategoryForMark,
} from "./markupPages.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const lighting = {
  id: "light-1",
  type: "count",
  sheet: 9,
  x: 18.5,
  y: -33.6,
  category: "Lighting",
  symbol: "1x4",
  symbolLabel: "1x4 recessed troffer / strip",
  abbr: "1x4",
};
const receptacle = {
  id: "rec-1",
  type: "count",
  sheet: 9,
  x: 64.1,
  y: -33.6,
  category: "Receptacles",
  symbol: "duplex",
  symbolLabel: "Duplex receptacle",
  abbr: "R",
};
const hvac = {
  id: "hvac-1",
  type: "count",
  sheet: 9,
  x: 40,
  y: -20,
  category: "Equipment",
  symbol: "ahu",
  symbolLabel: "AHU connection",
  abbr: "AHU",
};
const fire = {
  id: "fa-1",
  type: "count",
  sheet: 10,
  x: 12,
  y: 20,
  category: "Fire Alarm",
  symbol: "fa",
  symbolLabel: "Fire alarm device",
  abbr: "FA",
};
const conduit = {
  id: "run-1",
  type: "route",
  tool: "conduit",
  sheet: 9,
  points: [
    { x: 18.5, y: -33.6 },
    { x: 11.2, y: -16 },
  ],
  runNumber: 1,
  category: "Raceway",
  symbolLabel: '3/4" EMT',
};

assert(reviewCategoryForMark(hvac) === "HVAC", "AHU counts land on the HVAC drawing");
assert(reviewCategoryForMark(fire) === "Fire Alarm", "fire alarm stays on its own drawing");
assert(reviewCategoryForMark(conduit) === "Conduit", "conduit runs are not mixed into device pages");
assert(reviewCategoryForMark({
  type: "count",
  category: "Equipment",
  symbol: "vf",
  symbolLabel: "Vent fan",
  abbr: "VF",
}) === "Equipment", "vent fans stay electrical equipment, not HVAC");
assert(reviewCategoryForMark({
  type: "count",
  category: "Equipment",
  symbol: "ef",
  symbolLabel: "Exhaust fan",
  abbr: "EF",
}) === "Equipment", "exhaust fans stay electrical equipment, not HVAC");

const note = {
  id: "note-1",
  type: "note",
  tool: "markup",
  sheet: 9,
  x: 8,
  y: 16,
  text: "1. Provide GFCI where shown.",
  symbolLabel: "1. Provide GFCI where shown.",
  category: "Notes",
};
const pages = buildReviewMarkupPages({
  marks: [lighting, receptacle, hvac, fire, conduit, note],
  reconciliation: {
    rows: [{ type: "R", planCount: 1, scheduleQty: 24, persistedCount: 1, status: "short" }],
    persistedCount: 1,
    discrepancyCount: 1,
  },
  skippedSheets: [{ page: 1, kind: "drawing", discipline: "plumbing", sheetId: "P1.01" }],
});
assert(pages.some((page) => page.kind === "notes" && page.sourcePage === 9 && page.marks.every((mark) => mark.type === "note")), "notes have their own markup page");
assert(pages.some((page) => page.kind === "reconciliation" && page.reconciliation.persistedCount === 1), "plan-vs-schedule review does not adopt the legend total");
assert(pages.some((page) => page.kind === "skipped" && page.skippedSheets[0].sheetId === "P1.01"), "skipped non-electrical sheets are listed");
assert(pages.some((page) => page.kind === "conduit" && page.sourcePage === 9), "conduit runs get a page");
assert(pages.some((page) => page.kind === "devices" && page.category === "Lighting" && page.marks.length === 1), "lighting has its own drawing");
assert(pages.some((page) => page.kind === "devices" && page.category === "Receptacles"), "receptacles have their own drawing");
assert(pages.some((page) => page.kind === "devices" && page.category === "HVAC"), "HVAC has its own drawing");
assert(pages.some((page) => page.kind === "devices" && page.category === "Fire Alarm" && page.sourcePage === 10), "fire alarm has its own drawing");
assert(!pages.some((page) => page.kind === "devices" && page.category === "Lighting" && page.marks.some((mark) => mark.id === "rec-1")), "device pages do not mix types");
assert(pages.filter((page) => page.kind === "devices").every((page) => page.marks.every((mark) => mark.tool !== "conduit" && mark.type !== "route")), "device-count markup pages have no conduit overlay");
const conduitPage = pages.find((page) => page.kind === "conduit" && page.sourcePage === 9);
assert(conduitPage && conduitPage.marks.every((mark) => mark.tool === "conduit"), "conduit overlay lives on the conduit markup page");
const circuits = pages.find((page) => page.kind === "circuits" && page.sourcePage === 9);
assert(circuits, "circuits per conduit get a page");
assert(circuits.marks.some((mark) => mark.tool === "conduit"), "grouped circuits stay on the circuit markup page");
assert(circuits.groups[0].deviceIds.includes("light-1"), "devices on the conduit polyline group to that run");

const grouped = associateDevicesToConduits([lighting, receptacle, conduit]);
assert(grouped[0].deviceIds.includes("light-1"), "nearest conduit point wins");

const moved = assignDeviceToConduit([lighting, conduit], "light-1", "run-1");
assert(moved[0].circuitRunId === "run-1", "estimator can reassign a device to a conduit");

const flat = flattenMarkupMarks({
  pages: [
    { page: 1, marks: [{ id: "a", type: "count" }] },
    { page: 9, marks: [{ id: "b", type: "count", sheet: 9 }] },
  ],
});
assert(flat.length === 2 && flat[0].sheet === 1, "imported markup JSON flattens to marks");

if (!process.exitCode) console.log("markup page checks passed");
