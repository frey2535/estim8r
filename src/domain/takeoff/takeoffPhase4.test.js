import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { persistableAiPages } from "./aiPageBudget.js";
import { runTakeoffPipeline } from "./takeoffPipeline.js";
import { createPageCache, largeDrawingNavigable, regionalTiles, workerJobPlan } from "./takeoffRuntime.js";
import { paletteForTrade } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const tiles = regionalTiles({ cols: 2, rows: 2 });
assert(tiles.length === 4 && tiles[0].w === 50 && tiles[3].x === 50, "large sheets split into four regions");

const densePage = { page: 52, paths: Array.from({ length: 1200 }, (_, index) => ({ cx: index % 40, cy: Math.floor(index / 40) })) };
const jobs = workerJobPlan([densePage], { concurrency: 2 });
assert(jobs.regional && jobs.jobs.length === 4 && jobs.workerCount === 2, "dense pages schedule regional workers");

const cache = createPageCache({ maxBytes: 100, maxEntries: 2 });
cache.set("a", { n: 1 }, 60);
cache.set("b", { n: 2 }, 60);
assert(cache.stats().size === 1 && cache.stats().withinBudget, "page cache evicts until memory stays bounded");
assert(!cache.get("a") && cache.get("b"), "LRU drops the older raster page");

const nav = largeDrawingNavigable({ width: 2592, height: 1944, pathCount: 900, paths: densePage.paths }, { memoryMb: 90, zoom: 2 });
assert(nav.ok && nav.budget.ok, "large drawings stay inside the zoom/memory budget");

const live = persistableAiPages([{ page: 1, pdfPage: { peek: true }, tokens: [] }]);
assert(!live[0].pdfPage, "upload cache never keeps a live pdf.js page");

const fixture = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/takeoff-upgrade-labeled.json"),
  "utf8",
));
const electrical = paletteForTrade("electrical");
const pipeline = runTakeoffPipeline({
  file: { type: "application/pdf", size: 2_000_000 },
  pages: fixture.pages,
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: fixture.drawingSymbols,
  reviewCommands: [{ action: "accept", mark: { id: "pending-wp", type: "count", typeCode: "WP", abbr: "WP", sheet: 1 } }],
});
assert(pipeline.pdfPageStripped, "pipeline upload strips live pages");
assert(pipeline.bidMarks.length >= 1, `pipeline detect found bid marks, got ${pipeline.bidMarks.length}`);
assert(pipeline.quantities.totals.count >= 1, "pipeline quantities roll bid marks");
assert(pipeline.estimate.some((line) => line.source === "takeoff" && line.quantity >= 1), "pipeline estimate has takeoff lines");
assert(pipeline.pdf.ready && pipeline.pdf.title === "COUNTED DEVICE COPY", "pipeline PDF spec is ready without rendering in Node");
assert(pipeline.cache.withinBudget, "pipeline page cache stays bounded");
assert(pipeline.navigation.ok, "pipeline reports the sheet is still navigable");

if (!process.exitCode) console.log("phase 4 performance and end-to-end recorded");
