import { persistableAiPages } from "./aiPageBudget.js";
import { buildAiMarks } from "./aiTakeoff.js";
import { bidDeviceMarks } from "./detectionRecord.js";
import { applyReviewCommand } from "./professionalReview.js";
import { rollupTakeoff } from "./quantities.js";
import { drawingProcessingPlan } from "./drawingUpload.js";
import { createPageCache, largeDrawingNavigable, workerJobPlan } from "./takeoffRuntime.js";

export function estimateLinesFromQuantities(rollup) {
  return (rollup?.rows || [])
    .filter((row) => (Number(row.count) || 0) > 0 || (Number(row.lf) || 0) > 0)
    .map((row) => ({
      source: "takeoff",
      category: row.category,
      description: row.symbol || row.category,
      quantity: Number(row.count) || Number(row.lf) || 0,
      unit: (Number(row.count) || 0) > 0 ? "EA" : "LF",
    }));
}

export function markedDrawingPdfSpec(marks = [], pages = []) {
  const devices = bidDeviceMarks(marks);
  return {
    title: "COUNTED DEVICE COPY",
    pages: (pages || []).length,
    deviceMarks: devices.length,
    sheets: [...new Set(devices.map((mark) => mark.sheet))],
    ready: (pages || []).length > 0,
  };
}

export function runTakeoffPipeline({
  file = {},
  pages = [],
  trade = "electrical",
  symbols = [],
  drawingSymbols = [],
  reviewCommands = [],
  calibration = null,
  laborRate = 85,
} = {}) {
  const upload = drawingProcessingPlan(file, { byteLength: file.size || 0, scanned: file.scanned });
  const uploaded = persistableAiPages(pages);
  const cache = createPageCache({ maxBytes: 8 * 1024 * 1024, maxEntries: 6 });
  for (const page of uploaded) {
    cache.set(`page:${page.page}`, { tokens: page.tokens?.length || 0, paths: page.paths?.length || 0 }, (page.paths?.length || 0) * 48);
  }
  const workers = workerJobPlan(uploaded);
  const detected = buildAiMarks({
    pages: uploaded,
    trade,
    symbols,
    drawingSymbols,
    maxHomeruns: 8,
  });
  let marks = detected.marks || [];
  for (const command of reviewCommands || []) {
    marks = applyReviewCommand(marks, command, { drawingSymbols });
  }
  const quantities = rollupTakeoff(marks, calibration);
  const estimate = estimateLinesFromQuantities(quantities).map((line) => ({ ...line, laborRate }));
  const pdf = markedDrawingPdfSpec(marks, uploaded);
  const navigation = largeDrawingNavigable(uploaded[0] || {}, { memoryMb: 90 });
  return {
    upload,
    uploaded,
    cache: cache.stats(),
    workers,
    detected,
    marks,
    bidMarks: bidDeviceMarks(marks),
    quantities,
    estimate,
    pdf,
    navigation,
    pdfPageStripped: uploaded.every((page) => !page.pdfPage),
  };
}
