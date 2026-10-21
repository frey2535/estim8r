import { persistableAiPages, shouldExtractRaster } from "./aiPageBudget.js";
import { pagesToScan, shouldScanWithDictionary } from "./aiTakeoff.js";
import { recoverMissedLegendSymbols } from "./legendGeometry.js";
import { pagesNeedingRaster, rasterExtractScale } from "./rasterSymbols.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const cadSheet = { width: 2592, height: 1944 };
const desktopScale = rasterExtractScale(cadSheet.width, cadSheet.height, { coarsePointer: false });
const phoneScale = rasterExtractScale(cadSheet.width, cadSheet.height, { coarsePointer: true });
assert(desktopScale <= 1.35 && Number.isFinite(desktopScale), "desktop raster scale is finite");
assert(phoneScale <= desktopScale, "phone raster scale is not larger than desktop");
assert(
  cadSheet.width * desktopScale * cadSheet.height * desktopScale <= 4_500_000 + 1,
  `desktop raster pixels must stay under 4.5M, got ${Math.round(cadSheet.width * desktopScale * cadSheet.height * desktopScale)}`,
);
assert(
  cadSheet.width * phoneScale * cadSheet.height * phoneScale <= 2_200_000 + 1,
  `phone raster pixels must stay under 2.2M, got ${Math.round(cadSheet.width * phoneScale * cadSheet.height * phoneScale)}`,
);

const persistable = persistableAiPages([{
  page: 50,
  sheetId: "E110",
  pdfPage: { getViewport() { return { width: 100, height: 100 }; } },
  paths: [{ cx: 20, cy: 20 }],
}]);
assert(!("pdfPage" in persistable[0]), "persistable pages drop live pdf.js page objects");
assert(persistable[0].paths.length === 1 && persistable[0].sheetId === "E110", "persistable pages keep takeoff data");

assert(!shouldExtractRaster({
  kind: "drawing",
  sheetId: "A101",
  discipline: "architectural",
  tokens: [{ text: "A101", x: 88, y: 92 }],
}), "architectural sheets are not rasterized");
assert(!shouldExtractRaster({
  kind: "cover",
  sheetId: "",
  tokens: [{ text: "COVER", x: 20, y: 20 }],
}), "cover sheets are not rasterized");
assert(shouldExtractRaster({
  kind: "drawing",
  sheetId: "E110",
  discipline: "electrical",
  tokens: [{ text: "E110", x: 88, y: 92 }, { text: "POWER", x: 80, y: 90 }, { text: "PLANS", x: 88, y: 90 }],
}), "electrical plan sheets stay eligible for sparse raster");

const denseUnknown = {
  kind: "drawing",
  sheetId: "",
  tokens: Array.from({ length: 12 }, (_, index) => ({ text: `NOTE${index}`, x: 20, y: 16 + index })),
  paths: Array.from({ length: 200 }, (_, index) => ({ cx: 20 + (index % 20), cy: 20 + Math.floor(index / 20), w: 1, h: 1 })),
};
assert(
  !shouldScanWithDictionary(denseUnknown, "electrical", { entries: [{ code: "L1", symbol: { abbr: "L1" } }] }),
  "dense CAD sheets without electrical identity must not be scanned",
);
assert(
  pagesToScan([denseUnknown], "electrical", { entries: [] }).length === 0,
  "empty-gating fallback must not pull architectural or unlabeled dense sheets",
);

const electrical = {
  kind: "drawing",
  sheetId: "E110",
  discipline: "electrical",
  tokens: [{ text: "E110", x: 88, y: 92 }],
  paths: Array.from({ length: 20 }, () => ({ cx: 30, cy: 30, w: 0.5, h: 0.5 })),
};
assert(pagesToScan([denseUnknown, electrical], "electrical", { entries: [] }).length === 1, "electrical sheets still scan");

const densePlan = { page: 50, paths: Array.from({ length: 400 }, () => ({ cx: 10, cy: 10 })) };
const sparsePlan = { page: 51, paths: Array.from({ length: 12 }, () => ({ cx: 10, cy: 10 })) };
const alreadyHydrated = { page: 52, paths: [], rasterPaths: [{ cx: 1, cy: 1 }] };
const needing = pagesNeedingRaster([densePlan, sparsePlan, alreadyHydrated], { maxPages: 10 });
assert(needing.length === 1 && needing[0].page === 51, "only sparse unhydrated pages are rasterized");
assert(pagesNeedingRaster(Array.from({ length: 20 }, (_, index) => ({
  page: index + 1,
  paths: [],
})), { maxPages: 6 }).length === 6, "raster page count is capped");

const started = Date.now();
const recovered = recoverMissedLegendSymbols({
  page: 50,
  tokens: [],
  paths: Array.from({ length: 400 }, (_, index) => ({
    cx: 10 + (index % 20),
    cy: 10 + Math.floor(index / 20),
    w: 0.4,
    h: 0.4,
    kind: "rect",
  })),
}, {
  entries: Array.from({ length: 30 }, (_, index) => ({
    code: `T${index}`,
    prototype: { cx: 10, cy: 10, w: 0.4, h: 0.4, kind: "rect" },
    symbol: { id: `t${index}`, label: `Type ${index}`, category: "Receptacles" },
  })),
}, { deadline: Date.now() - 1 });
assert(Array.isArray(recovered) && recovered.length === 0, "expired recovery deadline returns immediately");
assert(Date.now() - started < 250, `expired recovery must not scan the sheet, took ${Date.now() - started}ms`);

if (!process.exitCode) console.log("AI takeoff crash-budget checks passed");
