import {
  aliasesFromDrawingSymbols,
  buildAiMarks,
  conduitRunLabel,
  findConduitSections,
  groupHomeruns,
  matchTradeSymbol,
  parseConduitCallout,
} from "./aiTakeoff.js";
import { CIRCUIT_COLOR, SCHEDULE_TYPE_COLORS } from "./deviceStyles.js";
import { parseScheduleRows } from "./drawing-docs.js";
import { paletteForTrade } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const electrical = paletteForTrade("electrical");
const fire = paletteForTrade("fire-alarm");
assert(!electrical.symbols.some((item) => item.category === "Fire Alarm"), "electrical palette excludes fire alarm");
assert(!electrical.symbols.some((item) => item.category === "Plumbing"), "electrical palette excludes plumbing");
assert(fire.symbols.every((item) => item.category === "Fire Alarm"), "fire alarm palette is only fire alarm");
assert(matchTradeSymbol("FACP", electrical.symbols) == null, "fire alarm panel is not an electrical match");
assert(matchTradeSymbol("GFI", electrical.symbols)?.id === "gfci", "gfci matches electrical");
assert(matchTradeSymbol("1x4", electrical.symbols)?.id === "1x4", "1x4 fixture matches");
assert(matchTradeSymbol("TRANSFORMER", electrical.symbols)?.id === "transformer", "transformer label matches");
assert(matchTradeSymbol("PAD-MOUNT TRANSFORMER", electrical.symbols)?.id === "pad-tx", "pad-mount transformer matches");
assert(matchTradeSymbol("GROUNDING", electrical.symbols)?.id === "ground-rod", "grounding callout matches");

const anchors = [{ id: "p1", sheet: 1, x: 80, y: 10 }];
const devices = [
  { id: "d1", sheet: 1, x: 10, y: 10 },
  { id: "d2", sheet: 1, x: 20, y: 10 },
  { id: "d3", sheet: 1, x: 30, y: 10 },
  { id: "d4", sheet: 1, x: 40, y: 10 },
];
const grouped = groupHomeruns(devices, anchors, 3);
assert(grouped.length === 2, "4 homeruns split into two conduits");
assert(grouped.every((group) => group.devices.length <= 3), "no conduit has more than 3 homeruns");
assert(groupHomeruns(devices, anchors, 4).length === 1, "user can raise the homerun cap");

const splitClusters = groupHomeruns([
  { id: "a1", sheet: 1, x: 8, y: 8 },
  { id: "a2", sheet: 1, x: 10, y: 9 },
  { id: "b1", sheet: 1, x: 80, y: 80 },
  { id: "b2", sheet: 1, x: 82, y: 81 },
], [{ id: "p1", sheet: 1, x: 50, y: 50 }], 3);
assert(splitClusters.length === 2, "closest circuits stay in separate conduit groups");
assert(splitClusters.every((group) => group.devices.length === 2), "each nearby pair shares a conduit");

const noPanel = groupHomeruns([
  { id: "c1", sheet: 1, x: 10, y: 10 },
  { id: "c2", sheet: 1, x: 12, y: 11 },
  { id: "c3", sheet: 1, x: 14, y: 10 },
], [], 3);
assert(noPanel.length === 1 && noPanel[0].devices.length === 3, "closest circuits still group without a panel");
assert(noPanel[0].anchor == null, "no invented panel when the sheet has none");

const planned = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  maxHomeruns: 3,
  conduit: { id: "emt-3-4", label: '3/4" EMT', size: '3/4"', material: "EMT" },
  pages: [{
    page: 1,
    kind: "drawing",
    sheetId: "E1.01",
    tokens: [
      { text: "ELECTRICAL POWER PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "LP", x: 70, y: 20 },
      { text: "GFI", x: 10, y: 20 },
      { text: "GFI", x: 20, y: 20 },
      { text: "GFI", x: 30, y: 22 },
      { text: "GFI", x: 40, y: 22 },
      { text: "FACP", x: 15, y: 40 },
    ],
  }],
});
assert(planned.marks.filter((mark) => mark.symbol === "facp" || mark.abbr === "FACP").length === 0, "AI did not take off fire alarm");
assert(planned.marks.filter((mark) => mark.tool === "conduit").every((mark) => mark.homerunCount <= 3), "AI conduits stay within the cap");
assert(planned.marks.some((mark) => mark.tool === "conduit" && mark.conduitSize === '3/4"'), "AI conduit keeps the selected size");
assert(planned.marks.filter((mark) => mark.tool === "conduit").every((mark) => (mark.points || []).length >= 2), "AI draws conduit lines");

assert(matchTradeSymbol("2'x4'", electrical.symbols)?.id === "2x4", "2'x4' counts as a 2x4 fixture");
assert(matchTradeSymbol("2×4", electrical.symbols)?.id === "2x4", "2×4 counts as a 2x4 fixture");

const fixtures = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  maxHomeruns: 3,
  conduit: { id: "emt-3-4", label: '3/4" EMT', size: '3/4"', material: "EMT" },
  pages: [
    {
      page: 1,
      kind: "lighting-schedule",
      tokens: [
        { text: "F1", x: 10, y: 20 },
        { text: "2' x 4'", x: 18, y: 20 },
        { text: "LED", x: 28, y: 20 },
        { text: "troffer", x: 34, y: 20 },
      ],
    },
    {
      page: 2,
      kind: "drawing",
      sheetId: "E2.01",
      tokens: [
        { text: "ELECTRICAL LIGHTING PLAN", x: 80, y: 88 },
        { text: "E2.01", x: 92, y: 94 },
        { text: "F1", x: 12, y: 30 },
        { text: "F1", x: 40, y: 55 },
        { text: "2", x: 70, y: 40 },
        { text: "x", x: 71.2, y: 40 },
        { text: "4", x: 72.2, y: 40 },
      ],
    },
  ],
});
const lights = fixtures.marks.filter((mark) => mark.symbol === "2x4");
assert(lights.length === 3, `expected 3 2x4 fixtures, got ${lights.length}`);
assert(lights.every((mark) => mark.sheet === 2), "schedule types are marked on the drawing, not the schedule sheet");

const scheduleRows = parseScheduleRows([
  { y: 10, text: "A 1x4 LED site light", tokens: ["A", "1x4", "LED", "site", "light"] },
  { y: 20, text: "B 1x4 LED site light", tokens: ["B", "1x4", "LED", "site", "light"] },
], "lighting-schedule");
assert(scheduleRows.some((item) => item.abbr === "A"), "letter schedule type A is read");
assert(scheduleRows.some((item) => item.abbr === "B"), "letter schedule type B is read");

const drawingSymbols = scheduleRows.map((item) => ({
  ...item,
  category: "From drawing",
  takeoffCategory: item.category,
}));
const typeAliases = aliasesFromDrawingSymbols(drawingSymbols, electrical.symbols);
assert(typeAliases.find((item) => item.code === "A")?.symbol.id === "1x4", "schedule type A maps to 1x4");
assert(matchTradeSymbol("A", electrical.symbols, typeAliases)?.id === "1x4", "drawing callout A matches the schedule");

const sitePlan = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols,
  maxHomeruns: 3,
  conduit: { id: "emt-3-4", label: '3/4" EMT', size: '3/4"', material: "EMT" },
  pages: [
    {
      page: 1,
      kind: "lighting-schedule",
      tokens: [
        { text: "TYPE", x: 8, y: 12 },
        { text: "A", x: 14, y: 12 },
        { text: "1x4", x: 20, y: 12 },
        { text: "LED", x: 28, y: 12 },
        { text: "TYPE", x: 8, y: 18 },
        { text: "B", x: 14, y: 18 },
        { text: "1x4", x: 20, y: 18 },
        { text: "LED", x: 28, y: 18 },
      ],
    },
    {
      page: 2,
      kind: "drawing",
      sheetId: "E1.01",
      tokens: [
        { text: "ELECTRICAL SITE PLAN", x: 80, y: 88 },
        { text: "E1.01", x: 92, y: 94 },
        { text: "SECTION", x: 8, y: 8 },
        { text: "A", x: 16, y: 8 },
        { text: "SECTION", x: 70, y: 8 },
        { text: "B", x: 78, y: 8 },
        { text: "1x4", x: 12, y: 30 },
        { text: "1x4", x: 18, y: 32 },
        { text: "A", x: 20, y: 34 },
        { text: "1x4", x: 72, y: 60 },
        { text: "1x4", x: 78, y: 62 },
        { text: "B", x: 80, y: 64 },
        { text: "TRANSFORMER", x: 45, y: 48 },
        { text: "GROUNDING", x: 48, y: 52 },
      ],
    },
  ],
});
const siteLights = sitePlan.marks.filter((mark) => mark.symbol === "1x4");
const siteTx = sitePlan.marks.filter((mark) => mark.symbol === "transformer" || mark.symbol === "pad-tx");
const siteGround = sitePlan.marks.filter((mark) => mark.symbol === "ground-rod");
const siteConduits = sitePlan.marks.filter((mark) => mark.tool === "conduit");
assert(siteLights.length >= 4, `site plan marks 1x4 fixtures, got ${siteLights.length}`);
assert(siteLights.every((mark) => mark.sheet === 2), "1x4 matches are marked on the drawing");
assert(siteTx.length >= 1, "transformer pad is marked");
assert(siteGround.length >= 1, "transformer pad grounding is marked");
assert(siteConduits.length >= 2, `closest circuits draw at least two conduit lines, got ${siteConduits.length}`);
assert(siteConduits.every((mark) => (mark.points || []).length >= 2), "each grouped conduit has a drawn line");
assert(
  !sitePlan.marks.some((mark) => mark.type === "count" && mark.x === 16 && mark.y === 8),
  "conduit section A title is not counted as a fixture",
);

const sections = findConduitSections([{
  page: 2,
  kind: "drawing",
  tokens: [
    { text: "SECTION", x: 8, y: 8 },
    { text: "A", x: 16, y: 8 },
    { text: "CONDUIT", x: 70, y: 8 },
    { text: "SECTION", x: 78, y: 8 },
    { text: "B", x: 86, y: 8 },
  ],
}]);
assert(sections.map((item) => item.label).sort().join("") === "AB", "conduit sections A and B are read");

const lonely = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  maxHomeruns: 3,
  pages: [{
    page: 1,
    kind: "drawing",
    sheetId: "E1.01",
    tokens: [
      { text: "ELECTRICAL POWER PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "1x4", x: 10, y: 10 },
      { text: "1x4", x: 14, y: 12 },
    ],
  }],
});
assert(lonely.marks.some((mark) => mark.tool === "conduit" && mark.points.length >= 2), "conduit lines are drawn without a panel");

const foreign = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  pages: [
    {
      page: 1,
      kind: "drawing",
      tokens: [
        { text: "1x4", x: 12, y: 30 },
        { text: "1x4", x: 40, y: 18 },
        { text: "UNDERGROUND FLOOR PLAN - PLUMBING", x: 80, y: 88 },
        { text: "P1.01", x: 92, y: 94 },
      ],
    },
    {
      page: 2,
      kind: "legend",
      tokens: [
        { text: "SS", x: 40, y: 22 },
        { text: "PLUMBING GENERAL NOTES AND LEGENDS", x: 78, y: 88 },
        { text: "P0.01", x: 91, y: 93 },
        ...Array.from({ length: 90 }, (_, index) => ({ text: `NOTE ${index}`, x: 10, y: 10 + (index % 70) })),
      ],
    },
    {
      page: 3,
      kind: "drawing",
      tokens: [
        { text: "EQ", x: 20, y: 20 },
        { text: "EQ", x: 28, y: 36 },
        { text: "FOUNDATION AND ROOF FRAMING PLAN", x: 80, y: 88 },
        { text: "S1.01", x: 91, y: 94 },
      ],
    },
    {
      page: 4,
      kind: "drawing",
      tokens: [
        { text: "OS", x: 30, y: 20 },
        { text: "OS", x: 55, y: 40 },
        { text: "CONSTRUCTION MANAGEMENT PLAN", x: 78, y: 88 },
        { text: "C0.04", x: 90, y: 94 },
      ],
    },
    {
      page: 5,
      kind: "equipment-schedule",
      tokens: [
        { text: "208V", x: 20, y: 20 },
        { text: "HVAC SCHEDULES", x: 80, y: 88 },
        { text: "M0.01", x: 91, y: 93 },
      ],
    },
  ],
});
assert(foreign.marks.length === 0, `electrical AI must not mark plumbing/structural/CM sheets, got ${foreign.marks.length}`);
assert(foreign.skippedSheets?.length === 5, "skipped sheet list is persisted for markup review");
assert(/Skipped 5/.test(foreign.summary), `summary mentions skipped foreign sheets: ${foreign.summary}`);

const electricalPlan = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  maxHomeruns: 3,
  conduit: { id: "emt-3-4", label: '3/4" EMT', size: '3/4"', material: "EMT" },
  pages: [{
    page: 6,
    kind: "drawing",
    tokens: [
      { text: "ELECTRICAL POWER PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "LP", x: 72, y: 18 },
      { text: "GFI", x: 14, y: 22 },
      { text: "GFI", x: 20, y: 24 },
      { text: "1x4", x: 16, y: 40 },
      { text: "1x4", x: 22, y: 42 },
      { text: "EQ", x: 48, y: 50 },
      { text: "(4) 4\" PVC", x: 40, y: 36 },
      { text: "TRANSFORMER", x: 38, y: 12 },
    ],
  }],
});
const planDevices = electricalPlan.marks.filter((mark) => mark.type === "count");
const planConduits = electricalPlan.marks.filter((mark) => mark.tool === "conduit");
assert(planDevices.length >= 5, `electrical plan counts devices, got ${planDevices.length}`);
assert(planDevices.every((mark) => mark.sheet === 6), "electrical counts stay on the electrical sheet");
assert(planConduits.length >= 1, "electrical plan draws conduit runs");
assert(planConduits.every((mark) => (mark.points || []).length >= 2), "each conduit has an installation path");
assert(planConduits.every((mark) => mark.sheet === 6), "conduit paths stay on the electrical sheet");
assert(planConduits.some((mark) => mark.runLabel), "conduit runs are labeled with run count");
assert(planConduits.some((mark) => Number(mark.parallelRuns) === 4), "drawing callout (4) 4\" PVC becomes 4 conduit runs");
assert(parseConduitCallout('(4) 4" PVC')?.parallelRuns === 4, "parses (4) 4\" PVC");
assert(parseConduitCallout("3 runs of 3/4\" EMT")?.parallelRuns === 3, "parses 3 runs of 3/4\" EMT");
assert(conduitRunLabel({ runNumber: 2, parallelRuns: 4, conduitSize: '4"', conduitMaterial: "PVC" }) === 'R2 · 4 runs · 4" · PVC', "run label shows count and size");

const typed = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "1", type: "1", label: "Type 1 2x4", takeoffCategory: "Lighting", category: "From drawing" },
    { abbr: "1E", type: "1E", label: "Type 1E 2x4 emergency", takeoffCategory: "Lighting", category: "From drawing" },
    { abbr: "F", type: "F", label: "Type F flood", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    page: 1,
    kind: "drawing",
    tokens: [
      { text: "ELECTRICAL LIGHTING PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "1", x: 20, y: 30 },
      { text: "1E", x: 28, y: 30 },
      { text: "F", x: 36, y: 30 },
      { text: "GFI", x: 50, y: 40 },
      { text: "LP", x: 80, y: 20 },
    ],
  }],
});
const type1 = typed.marks.find((mark) => mark.type === "count" && mark.typeCode === "1");
const type1e = typed.marks.find((mark) => mark.type === "count" && mark.typeCode === "1E");
const typeF = typed.marks.find((mark) => mark.type === "count" && mark.typeCode === "F");
const gfi = typed.marks.find((mark) => mark.symbol === "gfci");
assert(type1?.color === SCHEDULE_TYPE_COLORS["1"], "AI type 1 is dark blue");
assert(type1e?.color === SCHEDULE_TYPE_COLORS["1e"], "AI type 1E is light blue");
assert(typeF?.color === SCHEDULE_TYPE_COLORS.f, "AI type F is distinct");
assert(gfi && gfi.color !== type1.color, "receptacles on the same sheet use another color");
assert(typed.marks.filter((mark) => mark.tool === "conduit").every((mark) => mark.color === CIRCUIT_COLOR), "circuit overlay stays off the device palette");

// Pottsville E210 3@52: printed type 3 beside a foreign can must stay on the
// tag (or its own body), not steal the neighbor — even when legend seeding
// would prefer a circle hint for "Type 3 lighting fixture".
const type3Neighbor = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "3", type: "3", label: "Type 3 lighting fixture", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    page: 52,
    kind: "drawing",
    sheetId: "E210",
    title: "LIGHTING FLOOR PLAN",
    planType: "lighting",
    tokens: [
      { text: "LIGHTING FLOOR PLAN", x: 80, y: 88 },
      { text: "E210", x: 92, y: 94 },
      { text: "3", x: 69.549, y: 77.862 },
    ],
    paths: [
      { kind: "path", cx: 69.547, cy: 78.144, w: 0.152, h: 0.196, outline: { kind: "path", source: "vector", w: 0.152, h: 0.196, points: [] } },
      { kind: "circle", cx: 70.148, cy: 78.562, w: 0.726, h: 0.959, r: 0.48, outline: { kind: "circle", source: "vector", w: 0.726, h: 0.959, r: 0.48, points: [] } },
      { kind: "rect", cx: 70.337, cy: 77.168, w: 0.628, h: 0.503, outline: { kind: "rect", source: "vector", w: 0.628, h: 0.503, points: [] } },
    ],
  }],
});
const type3Mark = type3Neighbor.marks.find((mark) => mark.type === "count" && String(mark.typeCode) === "3" && mark.sheet === 52);
assert(type3Mark, "type 3 on E210 is detected");
assert(
  Math.hypot(type3Mark.x - 69.549, type3Mark.y - 77.862) < 0.35,
  `type 3@52 stays on the printed tag, not a neighbor body, got ${type3Mark.x.toFixed(2)},${type3Mark.y.toFixed(2)}`,
);
assert(
  Math.hypot(type3Mark.x - 70.148, type3Mark.y - 78.562) > 0.5,
  "type 3@52 does not sit on the neighboring can",
);

// Same sheet with the genuine fixture bar extracted: marker must bind the bar
// at (69.825,77.442), not the printed tag or the neighboring can.
const type3WithBar = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "3", type: "3", label: "Type 3 lighting fixture", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    page: 52,
    kind: "drawing",
    sheetId: "E210",
    title: "LIGHTING FLOOR PLAN",
    planType: "lighting",
    tokens: [
      { text: "LIGHTING FLOOR PLAN", x: 80, y: 88 },
      { text: "E210", x: 92, y: 94 },
      { text: "3", x: 69.549, y: 77.862 },
      { text: "P1-41", x: 70.024, y: 76.867 },
    ],
    paths: [
      { kind: "path", cx: 69.547, cy: 78.144, w: 0.152, h: 0.196, outline: { kind: "path", source: "vector", w: 0.152, h: 0.196, points: [] } },
      { kind: "rect", cx: 69.825, cy: 77.442, w: 0.201, h: 0.548, outline: { kind: "rect", source: "vector", w: 0.201, h: 0.548, points: [] } },
      { kind: "circle", cx: 70.148, cy: 78.562, w: 0.726, h: 0.959, r: 0.48, outline: { kind: "circle", source: "vector", w: 0.726, h: 0.959, r: 0.48, points: [] } },
      { kind: "rect", cx: 70.337, cy: 77.168, w: 0.628, h: 0.503, outline: { kind: "rect", source: "vector", w: 0.628, h: 0.503, points: [] } },
    ],
  }],
});
const type3BarMark = type3WithBar.marks.find((mark) => mark.type === "count" && String(mark.typeCode) === "3" && mark.sheet === 52);
assert(type3BarMark, "type 3 with fixture bar is detected despite nearby panel callout");
assert(
  Math.hypot(type3BarMark.x - 69.825, type3BarMark.y - 77.442) < 0.15,
  `type 3@52 binds the fixture bar, got ${type3BarMark.x.toFixed(3)},${type3BarMark.y.toFixed(3)}`,
);
assert(type3BarMark.outlineSource === "vector", "type 3@52 uses extracted bar geometry");
assert(
  Math.hypot(type3BarMark.x - 69.549, type3BarMark.y - 77.862) > 0.35,
  "type 3@52 does not stay on the printed tag when the bar is present",
);

// Soccer E1.01: side-tagged 1E must bind the fixture body, not the printed tag.
const soccerSideTag = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "1E", type: "1E", label: "Type 1E 2x4 LED surface troffer with emergency battery", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    page: 50,
    kind: "drawing",
    sheetId: "E1.01",
    title: "LIGHTING FLOOR PLAN - MAIN LEVEL",
    planType: "lighting",
    tokens: [
      { text: "LIGHTING FLOOR PLAN - MAIN LEVEL", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "1E", x: 25.464, y: 18.095 },
    ],
    paths: [
      { kind: "rect", cx: 26.369, cy: 18.431, w: 0.627, h: 0.972, outline: { kind: "rect", source: "vector", w: 0.627, h: 0.972, points: [] } },
    ],
  }],
});
const soccer1eMark = soccerSideTag.marks.find((mark) => mark.type === "count" && String(mark.typeCode).toUpperCase() === "1E");
assert(soccer1eMark, "Soccer side-tagged 1E is detected");
assert(
  Math.hypot(soccer1eMark.x - 26.369, soccer1eMark.y - 18.431) < 0.2,
  `Soccer 1E marker sits on the fixture body, got ${soccer1eMark.x.toFixed(2)},${soccer1eMark.y.toFixed(2)}`,
);
assert(soccer1eMark.outlineSource === "vector", "Soccer 1E uses extracted vector geometry");

// E110 SP@50: cover preference + paintable outline (or text fallback) — never
// outlineSource=vector with a null paint perimeter.
const spPower = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "SP", type: "SP", label: "Special purpose receptacle", takeoffCategory: "Receptacles", category: "From drawing" },
  ],
  pages: [{
    page: 50,
    kind: "drawing",
    sheetId: "E110",
    title: "POWER & SYSTEMS PLAN",
    planType: "power",
    tokens: [
      { text: "POWER & SYSTEMS PLAN", x: 80, y: 88 },
      { text: "E110", x: 92, y: 94 },
      { text: "SP", x: 33.78, y: 78.852 },
    ],
    paths: [
      { kind: "path", cx: 33.963, cy: 79.1, w: 0.443, h: 0.622, outline: { kind: "path", source: "vector", w: 0.443, h: 0.622, points: [] } },
      { kind: "path", cx: 33.85, cy: 78.95, w: 0.391, h: 0.503, outline: { kind: "path", source: "vector", w: 0.391, h: 0.503, points: [] } },
      { kind: "rect", cx: 33.78, cy: 78.85, w: 0.09, h: 0.126, outline: { kind: "rect", source: "vector", w: 0.09, h: 0.126, points: [] } },
    ],
  }],
});
const spMark = spPower.marks.find((mark) => mark.type === "count" && /^(SP|SPR)$/i.test(String(mark.typeCode || "")) && mark.sheet === 50);
assert(spMark, "SP on E110 is detected");
assert(
  spMark.outlineSource === "text"
  || (spMark.outlineSource === "vector" && spMark.outline && Number(spMark.outline.w) >= 0.14),
  `SP@50 must be text-located or have a paintable vector outline, got outlineSource=${spMark.outlineSource} w=${spMark.outline?.w}`,
);
assert(!(spMark.outlineSource === "vector" && spMark.outline?.kind === "path" && !(spMark.outline.points || []).length), "SP@50 must not claim an empty path vector outline");

if (!process.exitCode) console.log("trade and AI takeoff checks passed");
