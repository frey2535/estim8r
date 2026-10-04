import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shouldScan } from "./aiTakeoff.js";
import { buildAiMarks } from "./aiTakeoff.js";
import {
  classifyPageText,
  looksLikeCoverOrRendering,
  looksLikeElectricalPlan,
  looksLikeIndexPage,
} from "./drawing-docs.js";
import { isNonPlanSheetKind } from "./symbolDetection.js";
import { paletteForTrade } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(classifyPageText("COVER / ADD 2 SET MAURY COUNTY 42005 US-4311 COLUMBIA TN") === "cover", "cover sheet classifies as cover");
assert(classifyPageText("MCFD POTTSVILLE FIRE STATION COVER / ADD 2 SET") === "cover", "cover slash title is a cover");
assert(classifyPageText("E210 LIGHTING PLANS FIRST FLOOR RATED WALL LEGEND PANELBOARD SCHEDULES") === "drawing", "lighting PLANS title wins over a wall legend");
assert(classifyPageText("E110 POWER & SYSTEMS PLANS COVER PLATE") === "drawing", "power & systems PLANS is a plan, not a cover");
assert(classifyPageText("E111 PUMP HOUSE POWER & LIGHTING PLANS") === "drawing", "pump-house power & lighting plans is a plan");
assert(classifyPageText("E001 GENERAL NOTES & LEGENDS ABBREVIATIONS COVERPLATE") === "legend", "E001 stays a legend");
assert(classifyPageText("E601 DIAGRAMS & SCHEDULES") !== "drawing", "diagrams & schedules is not a plan");
assert(classifyPageText("THESE DRAWINGS REFLECT LOCAL JURISDICTION G002 E001 E110 E210 LIGHTING PLANS A101 S100") === "index", "drawing index is not a lighting plan");
assert(classifyPageText("ELECTRICAL RISER DIAGRAM PANEL H1") === "oneline", "riser stays oneline");
assert(classifyPageText("ELECTRICAL SITE PLAN DETAILS SECTION TWO CONDUIT") === "detail", "site plan details stay details");
assert(isNonPlanSheetKind("cover") && isNonPlanSheetKind("index") && isNonPlanSheetKind("other"), "cover/index/other are non-plan kinds");

const cover = {
  page: 1,
  kind: "drawing",
  discipline: "unknown",
  title: "COVER / ADD 2 SET",
  tokens: [
    { text: "MAURY", x: 18, y: 8 },
    { text: "COUNTY", x: 24, y: 8 },
    { text: "42005", x: 20, y: 12 },
    { text: "US-4311", x: 28, y: 12 },
    { text: "COLUMBIA", x: 22, y: 16 },
    { text: "TN", x: 36, y: 16 },
    { text: "COVER", x: 70, y: 88 },
    { text: "/", x: 76, y: 88 },
    { text: "ADD", x: 78, y: 88 },
    { text: "2", x: 84, y: 88 },
    { text: "SET", x: 88, y: 88 },
  ],
  paths: [
    { cx: 30, cy: 22, w: 1.2, h: 1.1, kind: "circle", r: 0.6 },
    { cx: 48, cy: 40, w: 1.4, h: 0.9, kind: "rect" },
    { cx: 62, cy: 18, w: 0.8, h: 0.8, kind: "circle", r: 0.4 },
  ],
};
assert(looksLikeCoverOrRendering(cover), "cover page is detected from title tokens");
assert(!looksLikeElectricalPlan(cover), "cover is not an electrical plan");
assert(!shouldScan(cover, "electrical"), "cover is never scanned");

const lighting = {
  page: 52,
  kind: "legend",
  discipline: "unknown",
  sheetId: "E210",
  title: "E210 LIGHTING PLANS",
  tokens: [
    { text: "E210", x: 88, y: 92 },
    { text: "LIGHTING", x: 80, y: 90 },
    { text: "PLANS", x: 88, y: 90 },
    { text: "RATED", x: 10, y: 12 },
    { text: "WALL", x: 16, y: 12 },
    { text: "LEGEND", x: 22, y: 12 },
    { text: "L1", x: 24, y: 40 },
    { text: "F1", x: 30, y: 40 },
  ],
};
assert(looksLikeElectricalPlan(lighting), "E210 lighting plans is an electrical plan even if kind was legend");
assert(shouldScan(lighting, "electrical"), "E210 is scanned");

const index = {
  page: 2,
  kind: "drawing",
  title: "G002",
  tokens: [
    { text: "THESE", x: 10, y: 10 },
    { text: "DRAWINGS", x: 16, y: 10 },
    { text: "REFLECT", x: 28, y: 10 },
    { text: "E001", x: 20, y: 30 },
    { text: "E110", x: 20, y: 34 },
    { text: "E210", x: 20, y: 38 },
    { text: "LIGHTING", x: 28, y: 38 },
    { text: "PLANS", x: 38, y: 38 },
    { text: "A101", x: 20, y: 42 },
    { text: "A111", x: 20, y: 46 },
    { text: "S100", x: 20, y: 50 },
    { text: "S102", x: 20, y: 54 },
    { text: "M110", x: 20, y: 58 },
    { text: "P100", x: 20, y: 62 },
  ],
};
assert(looksLikeIndexPage(index), "G002 index is detected");
assert(!shouldScan(index, "electrical"), "drawing index is never scanned");

const architectural = {
  page: 17,
  kind: "drawing",
  discipline: "unknown",
  title: "A101 DIMENSIONED FLOOR PLANS",
  tokens: [
    { text: "A101", x: 88, y: 92 },
    { text: "DIMENSIONED", x: 70, y: 90 },
    { text: "FLOOR", x: 82, y: 90 },
    { text: "PLANS", x: 90, y: 90 },
  ],
  paths: [{ cx: 40, cy: 40, w: 1, h: 1, kind: "circle", r: 0.5 }],
};
assert(!looksLikeElectricalPlan(architectural), "architectural floor plans are not electrical takeoff sheets");
assert(!shouldScan(architectural, "electrical"), "A101 is never scanned for electrical");

const electrical = paletteForTrade("electrical");
const coverResult = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  pages: [cover],
  maxHomeruns: 8,
});
const coverMarks = (coverResult.marks || []).filter((mark) => mark.sheet === 1);
assert(coverMarks.length === 0, `cover must have 0 marks, got ${coverMarks.length}`);

const coverFixture = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/pottsville-cover.json"),
  "utf8",
));
const extractedCover = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  pages: [coverFixture],
  maxHomeruns: 8,
});
const extractedCoverMarks = (extractedCover.marks || []).filter((mark) => mark.sheet === 1);
assert(extractedCoverMarks.length === 0, `extracted cover must have 0 marks, got ${extractedCoverMarks.length}`);

const fixture = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/pottsville-electrical.json"),
  "utf8",
));
const pottsville = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: fixture.drawingSymbols || [],
  pages: fixture.pages || [],
  maxHomeruns: 8,
});
const bySheet = new Map();
for (const mark of pottsville.marks || []) {
  if (mark.type !== "count" && mark.type !== "drop") continue;
  bySheet.set(mark.sheet, (bySheet.get(mark.sheet) || 0) + 1);
}
assert((bySheet.get(48) || 0) === 0, `legend E001 page 48 must have 0 device marks, got ${bySheet.get(48) || 0}`);
assert((bySheet.get(50) || 0) > 0, "power plan E110 page 50 must have device marks");
assert((bySheet.get(52) || 0) > 0, "lighting plan E210 page 52 must have device marks");
assert(!(pottsville.marks || []).some((mark) => mark.sheet === 1), "no marks land on a cover page number");

console.log(`plan sheet gating: cover=${coverMarks.length} extractedCover=${extractedCoverMarks.length} E001=${bySheet.get(48) || 0} E110=${bySheet.get(50) || 0} E210=${bySheet.get(52) || 0}`);
if (!process.exitCode) console.log("plan sheet gating checks passed");
