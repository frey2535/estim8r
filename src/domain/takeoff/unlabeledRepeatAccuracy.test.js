import { buildAiMarks } from "./aiTakeoff.js";
import { paletteForTrade } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const electrical = paletteForTrade("electrical");
const body = (cx, cy) => ({
  cx, cy, w: 0.8, h: 1.25, kind: "rect", source: "vector",
  outline: { kind: "rect", source: "vector", w: 0.8, h: 1.25, points: [] },
});

const result = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "1E", type: "1E", label: "Type 1E 2x4 LED surface troffer with emergency battery", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    page: 1,
    kind: "drawing",
    title: "LIGHTING FLOOR PLAN - MAIN LEVEL",
    discipline: "electrical",
    tokens: [
      { text: "LIGHTING FLOOR PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "'1E'", x: 20.2, y: 20.1 },
      { text: "'1E'", x: 32.2, y: 20.1 },
    ],
    paths: [
      body(20.6, 20.4),
      body(32.6, 20.4),
      body(20.6, 36.4),
      body(32.6, 36.4),
    ],
  }],
  maxHomeruns: 8,
});

const counts = result.marks.filter((mark) => mark.type === "count");
const type1e = counts.filter((mark) => String(mark.typeCode || "").toUpperCase() === "1E");
const unlabeled = type1e.filter((mark) => mark.y > 30);
console.log(`labeled+unlabeled 1E ${type1e.length}; unlabeled copies ${unlabeled.length}`);
assert(type1e.length >= 4, `finds labeled 1E and unlabeled copies, got ${type1e.length}`);
assert(unlabeled.length >= 2, `recovers both unlabeled 1E bodies, got ${unlabeled.length}`);
assert(unlabeled.every((mark) => Math.abs(mark.x - 20.6) < 0.15 || Math.abs(mark.x - 32.6) < 0.15), "unlabeled fills sit on the fixture body, not beside it");
assert(!counts.some((mark) => mark.x > 70), "right-side schedule chrome is not counted as a device");

const circle = (cx, cy) => ({
  cx, cy, w: 0.72, h: 0.72, kind: "circle", r: 0.36, source: "vector",
  outline: { kind: "circle", source: "vector", w: 0.72, h: 0.72, r: 0.36, points: [] },
});
const lookalikeSymbols = [
  { abbr: "2", type: "2", label: "Type 2 8 inch recessed downlight", takeoffCategory: "Lighting", category: "From drawing" },
  { abbr: "GFI", type: "GFI", label: "GFCI receptacle", takeoffCategory: "Receptacles", category: "From drawing" },
];
const lightingLookalike = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: lookalikeSymbols,
  pages: [{
    page: 2,
    kind: "drawing",
    title: "LIGHTING FLOOR PLAN - MAIN LEVEL",
    discipline: "electrical",
    tokens: [
      { text: "LIGHTING FLOOR PLAN", x: 80, y: 88 },
      { text: "'2'", x: 23.2, y: 22.1 },
      { text: "GFI", x: 51.2, y: 22.1 },
    ],
    paths: [circle(22.3, 22.3), circle(50.3, 22.3), circle(40.3, 36.3)],
  }],
});
const lightingMarks = lightingLookalike.marks.filter((mark) => mark.type === "count");
const lightingCopy = lightingMarks.find((mark) => Math.abs(mark.x - 40.3) < 0.2);
assert(lightingCopy?.typeCode === "2", `lighting lookalike copy is a can, got ${lightingCopy?.typeCode}`);
assert(lightingCopy?.detectionAmbiguous !== true, "lighting prior settles the can instead of dumping it to review");

const powerLookalike = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: lookalikeSymbols,
  pages: [{
    page: 3,
    kind: "drawing",
    title: "POWER FLOOR PLAN - MAIN LEVEL",
    discipline: "electrical",
    tokens: [
      { text: "POWER FLOOR PLAN", x: 80, y: 88 },
      { text: "'2'", x: 23.2, y: 22.1 },
      { text: "GFI", x: 51.2, y: 22.1 },
    ],
    paths: [circle(22.3, 22.3), circle(50.3, 22.3), circle(40.3, 36.3)],
  }],
});
const powerCopy = powerLookalike.marks.filter((mark) => mark.type === "count").find((mark) => Math.abs(mark.x - 40.3) < 0.2);
assert(powerCopy?.typeCode === "GFI", `power lookalike copy is a receptacle, got ${powerCopy?.typeCode}`);
assert(powerCopy?.detectionAmbiguous !== true, "power prior settles the receptacle instead of dumping it to review");

const hatch = (cx, cy) => ([
  { cx, cy, w: 0.8, h: 1.25, kind: "rect", source: "vector", outline: { kind: "rect", source: "vector", w: 0.8, h: 1.25, points: [] } },
  { cx: cx - 0.04, cy: cy + 0.06, w: 0.62, h: 0.97, kind: "rect", source: "vector", outline: { kind: "rect", source: "vector", w: 0.62, h: 0.97, points: [] } },
  { cx: cx - 0.08, cy: cy + 0.12, w: 0.4, h: 0.62, kind: "rect", source: "vector", outline: { kind: "rect", source: "vector", w: 0.4, h: 0.62, points: [] } },
  { cx: cx - 0.12, cy: cy - 0.18, w: 0.18, h: 0.22, kind: "rect", source: "vector", outline: { kind: "rect", source: "vector", w: 0.18, h: 0.22, points: [] } },
]);
const twinPage = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "1", type: "1", label: "Type 1 2x4 LED surface troffer", takeoffCategory: "Lighting", category: "From drawing" },
    { abbr: "1E", type: "1E", label: "Type 1E 2x4 LED surface troffer with emergency battery", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    page: 4,
    kind: "drawing",
    title: "LIGHTING FLOOR PLAN - MAIN LEVEL",
    discipline: "electrical",
    tokens: [
      { text: "LIGHTING FLOOR PLAN", x: 80, y: 88 },
      { text: "'1'", x: 20.1, y: 20.1 },
      { text: "'1E'", x: 32.1, y: 20.1 },
    ],
    paths: [
      body(20.6, 20.4),
      ...hatch(32.6, 20.4),
      body(20.6, 36.4),
      ...hatch(32.6, 36.4),
    ],
  }],
});
const twinCounts = twinPage.marks.filter((mark) => mark.type === "count");
const unlabeledOne = twinCounts.find((mark) => mark.typeCode === "1" && mark.y > 30);
const unlabeledEm = twinCounts.find((mark) => mark.typeCode === "1E" && mark.y > 30);
assert(unlabeledOne && Math.abs(unlabeledOne.x - 20.6) < 0.2, `simple unlabeled 2x4 is type 1, got ${unlabeledOne?.typeCode}@${unlabeledOne?.x}`);
assert(unlabeledEm && Math.abs(unlabeledEm.x - 32.6) < 0.2, `hatched unlabeled 2x4 is type 1E, got ${unlabeledEm?.typeCode}@${unlabeledEm?.x}`);

if (!process.exitCode) console.log("unlabeled repeat accuracy checks passed");
