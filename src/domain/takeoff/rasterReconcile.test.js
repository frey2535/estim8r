import { buildAiMarks } from "./aiTakeoff.js";
import { isReviewOnlyMark } from "./detectionRecord.js";
import { matchRasterToLegend, rasterCandidatesFromPage } from "./rasterSymbols.js";
import { paletteForTrade } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const electrical = paletteForTrade("electrical");
const proto = {
  cx: 20,
  cy: 20,
  w: 0.8,
  h: 1.25,
  kind: "rect",
  source: "vector",
  outline: { kind: "rect", source: "vector", w: 0.8, h: 1.25, points: [] },
};
const rasterBlob = {
  cx: 40.2,
  cy: 36.4,
  w: 0.8,
  h: 1.25,
  kind: "rect",
  source: "raster",
  outline: { kind: "rect", source: "raster", w: 0.8, h: 1.25, points: [] },
};

const page = {
  page: 1,
  kind: "drawing",
  title: "LIGHTING FLOOR PLAN",
  discipline: "electrical",
  tokens: [
    { text: "LIGHTING FLOOR PLAN", x: 80, y: 88 },
    { text: "E1.01", x: 92, y: 94 },
    { text: "'1E'", x: 20.2, y: 20.1 },
  ],
  paths: [proto],
  rasterPaths: [rasterBlob],
};

assert(rasterCandidatesFromPage(page).length === 1, "page rasterPaths are the independent raster candidates");
const matched = matchRasterToLegend(rasterCandidatesFromPage(page), {
  entries: [{ code: "1E", symbol: { id: "2x4", label: "Type 1E 2x4 LED", abbr: "1E", takeoffCategory: "Lighting" }, prototype: proto }],
}, { threshold: 0.72 });
assert(matched.length === 1 && matched[0].entry.code === "1E", "raster blobs score against legend prototypes");

const result = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "1E", type: "1E", label: "Type 1E 2x4 LED surface troffer with emergency battery", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [page],
  maxHomeruns: 8,
});
const counts = (result.marks || []).filter((mark) => mark.type === "count");
const labeled = counts.find((mark) => mark.typeCode === "1E" && !isReviewOnlyMark(mark));
const rasterHit = counts.find((mark) => Math.abs(mark.x - 40.2) < 0.2 && Math.abs(mark.y - 36.4) < 0.2);
assert(labeled, "labeled vector/text 1E still counts");
assert(rasterHit, "independent raster hit is kept, not deleted");
assert((rasterHit.detectionSources || []).includes("raster"), "raster source is recorded");
assert(rasterHit.requiresReview === true || isReviewOnlyMark(rasterHit), "raster-only or disagreed hits stay reviewable");

const disagreed = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "1E", type: "1E", label: "Type 1E 2x4 LED surface troffer with emergency battery", takeoffCategory: "Lighting", category: "From drawing" },
    { abbr: "2", type: "2", label: "Type 2 8 inch recessed downlight", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    ...page,
    rasterPaths: [{ ...proto, source: "raster", outline: { kind: "rect", source: "raster", w: 0.8, h: 1.25, points: [] } }],
  }],
  maxHomeruns: 8,
});
const overlap = (disagreed.marks || []).find((mark) => mark.type === "count" && Math.abs(mark.x - 20) < 0.4);
assert(overlap, "overlapping raster+vector still produces a mark");
assert((overlap.detectionSources || []).includes("raster") || overlap.outlineSource === "vector", "vector/raster overlap is reconciled onto one body");

if (!process.exitCode) console.log("raster reconcile checks passed");
