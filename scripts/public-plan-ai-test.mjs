import fs from "node:fs";
import path from "node:path";
import { readDrawingDocuments, drawingSymbolsFromDocs } from "../src/domain/takeoff/drawing-docs.js";
import { readAiPages } from "../src/domain/takeoff/aiPages.js";
import { buildAiMarks } from "../src/domain/takeoff/aiTakeoff.js";
import { applyDeviceTypeColors, deviceOutline, isDeviceMark } from "../src/domain/takeoff/deviceStyles.js";
import { findConduitOption, paletteForTrade } from "../src/domain/takeoff/trades.js";

const pdfPath = process.argv[2];
const outPath = process.argv[3] || "public-plan-test-result.json";
if (!pdfPath) throw new Error("Usage: npx tsx scripts/public-plan-ai-test.mjs <pdf> [output.json]");

const fileBytes = new Uint8Array(fs.readFileSync(pdfPath));
const docs = await readDrawingDocuments(fileBytes);
const drawingSymbols = drawingSymbolsFromDocs(docs);
const palette = paletteForTrade("electrical", drawingSymbols);
const pages = await readAiPages(fileBytes);

const planned = buildAiMarks({
  pages,
  trade: "electrical",
  symbols: palette.symbols,
  drawingSymbols: palette.fromDrawing,
  maxHomeruns: 8,
  conduit: findConduitOption("emt-3-4", "electrical"),
  color: "#2563eb",
});

const marks = applyDeviceTypeColors((planned.marks || []).map((mark) => ({
  ...mark,
  source: mark.source || "ai",
  trade: mark.trade || "electrical",
  markerSize: mark.markerSize || 1.45,
  reviewStatus: mark.reviewStatus || "pending",
})));

const deviceMarks = marks.filter(isDeviceMark).map((mark) => ({
  ...mark,
  resolvedOutline: deviceOutline(mark, mark.markerSize || 1.45),
}));

const payload = {
  sourcePdf: path.basename(pdfPath),
  pages: pages.map((p) => ({
    page: p.page,
    kind: p.kind,
    sheetId: p.sheetId,
    discipline: p.discipline,
    tokenCount: p.tokens?.length || 0,
    pathCount: p.paths?.length || 0,
  })),
  parsedLegend: drawingSymbols.map((s) => ({
    id: s.id,
    abbr: s.abbr,
    label: s.label,
    category: s.takeoffCategory || s.category,
    page: s.page,
  })),
  summary: planned.summary,
  reconciliation: planned.reconciliation || null,
  deviceCount: planned.deviceCount,
  conduitCount: planned.conduitCount,
  marks: deviceMarks,
};

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(JSON.stringify({
  parsedLegendCount: payload.parsedLegend.length,
  deviceCount: payload.deviceCount,
  conduitCount: payload.conduitCount,
  pages: payload.pages,
  summary: payload.summary,
}, null, 2));
