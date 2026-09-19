import {
  aliasesFromDrawingSymbols,
  buildAiMarks,
  findConduitSections,
  groupHomeruns,
  matchTradeSymbol,
} from "./aiTakeoff.js";
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
    tokens: [
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
      tokens: [
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
      tokens: [
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
    tokens: [
      { text: "1x4", x: 10, y: 10 },
      { text: "1x4", x: 14, y: 12 },
    ],
  }],
});
assert(lonely.marks.some((mark) => mark.tool === "conduit" && mark.points.length >= 2), "conduit lines are drawn without a panel");

if (!process.exitCode) console.log("trade and AI takeoff checks passed");
