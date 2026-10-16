import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { persistableAiPages, shouldExtractRaster } from "./aiPageBudget.js";
import { scoreTakeoffAccuracy } from "./accuracyHarness.js";
import { bidDeviceMarks, isReviewOnlyMark, reviewCandidateMark } from "./detectionRecord.js";
import { displayDeviceOutline } from "./deviceStyles.js";
import { drawingProcessingPlan } from "./drawingUpload.js";
import { legendHoverData } from "./legendHover.js";
import { geometrySimilarity } from "./legendGeometry.js";
import { pagesNeedingRaster } from "./rasterSymbols.js";
import { rollupTakeoff } from "./quantities.js";
import { isJunkGeometry } from "./vectorSymbols.js";
import {
  assembleOverlappingSymbol,
  classifyAiEvidence,
  dedupePhysicalSymbols,
  drawingProcessingPlan as qualityPlan,
  isScannedOrSparsePage,
  isWallOrArchitecturalMark,
  legendGraphicMatch,
  outlineExcludesAdjacentAnnotation,
  rasterCandidateSurvivesNoise,
  stressZoomPan,
  takeoffPerformanceBudget,
} from "./takeoffQuality.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const status = [];

const largeScan = drawingProcessingPlan(
  { type: "application/pdf", size: 32 * 1024 * 1024 },
  { byteLength: 32 * 1024 * 1024, scanned: true },
);
assert(largeScan.largePlan && largeScan.scanned && largeScan.includeRaster && largeScan.chunkRead, "large scanned plans request raster + chunked read");
assert(qualityPlan({ type: "image/png", size: 4_000_000 }).scanned, "image drawings use the scan pipeline");
const scannedPage = { kind: "scan", paths: [], tokens: [], forceRaster: true };
assert(isScannedOrSparsePage(scannedPage), "empty-vector pages are treated as scans");
assert(shouldExtractRaster({ ...scannedPage, kind: "drawing", forceRaster: true, discipline: "electrical", sheetId: "E110" }), "scanned electrical sheets stay raster-eligible");
assert(pagesNeedingRaster([{ page: 1, paths: [], forceRaster: true, scanned: true }]).length === 1, "scanned pages are hydrated");
assert(!persistableAiPages([{ pdfPage: {}, paths: [] }])[0].pdfPage, "upload state drops live pdf.js pages");
status.push("Drawing upload: large/scanned plans take the raster+chunk path; pdf.js pages never enter React state");

const proto = { cx: 10, cy: 10, w: 0.6, h: 0.8, kind: "rect" };
const rotated = { cx: 40, cy: 18, w: 0.8, h: 0.6, kind: "rect" };
const match = legendGraphicMatch(rotated, proto);
assert(match >= 0.55, `legend graphic match must accept a 90° size swap, got ${match}`);
assert(legendGraphicMatch({ ...rotated, w: 4.8, h: 4.2 }, proto) < match, "room-sized geometry cannot steal a legend prototype");
assert(geometrySimilarity(rotated, proto) > 0, "rotation-aware layout score is used");
status.push("Symbol legend reading: graphical match is size-checked and rotation-tolerant");

const body = { cx: 20, cy: 20, w: 0.5, h: 0.5, kind: "circle" };
const slash = { cx: 20.12, cy: 20.08, w: 0.42, h: 0.08, kind: "line" };
const assembled = assembleOverlappingSymbol(body, [slash]);
assert(assembled.parts.length === 2 && assembled.kind === "composite", "overlapping circle+slash assemble as one symbol");
status.push("Vector detection: overlapping parts cluster into one complete symbol");

assert(rasterCandidateSurvivesNoise({ w: 0.4, h: 0.35 }), "compact raster bodies survive");
assert(!rasterCandidateSurvivesNoise({ w: 6.2, h: 0.2 }), "noisy wall streaks are dropped");
assert(!rasterCandidateSurvivesNoise({ w: 0.05, h: 0.04 }), "speckle noise is dropped");
status.push("Raster detection: noise, long streaks, and speckle are rejected before legend match");

const accepted = classifyAiEvidence({ visual: 0.9, legend: 0.88, context: 0.7 });
const shapeOnly = classifyAiEvidence({ visual: 0.91, legend: 0.1, context: 0.1 });
const review = classifyAiEvidence({ visual: 0.74, legend: 0.2, context: 0.2 });
assert(accepted.decision === "accept" && accepted.sources === 3, "accept requires visual+legend+context");
assert(shapeOnly.decision !== "accept", "shape-only evidence cannot become a bid count");
assert(review.decision === "review", "single-source mid scores stay in review");
status.push("AI classification: accept only with two independent evidence sources");

const receptacle = { w: 0.55, h: 0.7, kind: "rect" };
const wall = { w: 8.5, h: 0.18, kind: "line" };
const crossing = [
  { w: 6, h: 0.2, kind: "line" },
  { w: 5.5, h: 0.22, kind: "line" },
];
assert(!isWallOrArchitecturalMark(receptacle), "receptacle body is not a wall");
assert(isWallOrArchitecturalMark(wall), "long thin segments are walls");
assert(isWallOrArchitecturalMark({ w: 2.6, h: 0.9 }, crossing), "wall intersections are rejected");
assert(isJunkGeometry(wall), "scan junk filter uses the wall discriminator");
status.push("Wall rejection: long walls and crossing intersections are not symbols");

const outline = outlineExcludesAdjacentAnnotation(
  { cx: 20, cy: 20, w: 0.55, h: 0.7, kind: "rect" },
  [{ text: "11", x: 20.72, y: 20.05 }],
);
assert(outline.excludedAnnotation?.text === "11", "adjacent circuit numbers stay outside the fill");
assert(Math.abs(outline.cx - 20) < 0.01 && Math.abs(outline.w - 0.55) < 0.01, "fill stays on the symbol perimeter");
const painted = displayDeviceOutline({
  outline: { kind: "rect", source: "vector", w: 0.55, h: 0.7 },
  x: 20,
  y: 20,
  type: "count",
  source: "ai",
});
assert(painted && painted.w <= 0.8, "painted fill is the symbol body, not a wall span");
status.push("Symbol marking: fills stay on the symbol perimeter and drop adjacent numbers");

const hover = legendHoverData({
  typeCode: "WP",
  abbr: "WP",
  symbol: "wp",
  legendEntryId: "legend:wp",
  legendCode: "WP",
  legendLabel: "Weatherproof receptacle",
  legendCategory: "Receptacles",
  legendSource: "legend",
  legendSourcePage: 1,
}, [{
  id: "legend:wp",
  abbr: "WP",
  label: "Weatherproof receptacle",
  takeoffCategory: "Receptacles",
  source: "legend",
  page: 1,
}], { planType: "power" });
assert(hover.verified && hover.code === "WP" && hover.fixtureType === "Receptacles", "hover names the exact legend entry and fixture type");
status.push("Hover identification: verified legend code, description, and fixture type");

const dupes = dedupePhysicalSymbols([
  { type: "count", sheet: 1, x: 20, y: 20, symbol: "wp", combinedConfidence: 0.7 },
  { type: "count", sheet: 1, x: 20.1, y: 20.05, symbol: "wp", combinedConfidence: 0.92 },
  { type: "count", sheet: 1, x: 40, y: 40, symbol: "gfi", combinedConfidence: 0.8 },
]);
assert(dupes.filter((mark) => mark.type === "count").length === 2, "two physical symbols remain");
assert(dupes.some((mark) => mark.combinedConfidence === 0.92), "the stronger evidence mark is kept");
status.push("Counting: one counted item per physical symbol");

const unknown = reviewCandidateMark({
  trade: "electrical",
  sheet: 1,
  geometry: { cx: 30, cy: 30, w: 0.5, h: 0.5, kind: "rect" },
  reason: "low-confidence-visual",
  sources: ["raster"],
  scores: { visual: 0.5 },
});
assert(isReviewOnlyMark(unknown), "uncertain marks are review-only");
assert(bidDeviceMarks([unknown]).length === 0, "review marks are excluded from bid quantities");
const rolled = rollupTakeoff([
  unknown,
  { type: "count", sheet: 1, category: "Receptacles", symbol: "wp", symbolLabel: "WP", x: 20, y: 20 },
], null, 1);
assert(rolled.rows.find((row) => row.symbol === "WP")?.count === 1, "only the verified WP rolls up");
assert(!rolled.rows.some((row) => /unknown/i.test(row.symbol) && row.count > 0), "unknown review items never become bid counts");
status.push("Unknown symbols: review workflow keeps uncertain items out of bid quantities");

const labeled = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/takeoff-upgrade-labeled.json"),
  "utf8",
));
const scored = scoreTakeoffAccuracy(labeled);
assert(scored.truth === 1, "labeled fixture has independent ground truth");
assert(scored.found >= 1, `labeled WP must be found, got found=${scored.found}`);
assert(typeof scored.detectionRecall === "number" && scored.detectionRecall > 0, "accuracy harness reports measured recall");
status.push(`Accuracy testing: labeled WP fixture recall ${scored.detectionRecall.toFixed(2)} / precision ${(scored.detectionPrecision || 0).toFixed(2)}`);

const perf = takeoffPerformanceBudget({
  width: 2592,
  height: 1944,
  pathCount: 12_000,
  zoom: 2,
  memoryMb: 90,
  coarsePointer: false,
});
assert(perf.ok && perf.pixelOk, "large CAD sheets stay inside render/raster pixel budgets");
const phone = takeoffPerformanceBudget({
  width: 2592,
  height: 1944,
  pathCount: 12_000,
  zoom: 1,
  memoryMb: 40,
  coarsePointer: true,
});
assert(phone.ok && phone.rasterScale <= perf.rasterScale, "phone raster scale is capped below desktop");
const zoomed = stressZoomPan();
assert(zoomed.ok, "pinch zoom/pan stays finite inside the takeoff zoom range");
const started = Date.now();
dedupePhysicalSymbols(Array.from({ length: 4000 }, (_, index) => ({
  type: "count",
  sheet: 1,
  x: (index % 80) * 1.2,
  y: Math.floor(index / 80) * 1.2,
  combinedConfidence: 0.8,
})));
assert(Date.now() - started < 250, "dedupe of 4000 marks stays interactive");
status.push("Performance: pixel budgets, pinch zoom/pan, and 4k-mark dedupe stay inside limits");

if (!process.exitCode) {
  console.log("takeoff upgrade category checks passed");
  for (const line of status) console.log(`- ${line}`);
}
