import { looksLikeCoverOrRendering, looksLikeElectricalPlan, looksLikeIndexPage } from "./drawing-docs.js";
import { tradeFromSheetId } from "./sheetDiscipline.js";
import { isNonPlanSheetKind } from "./symbolDetection.js";
import { isScannedOrSparsePage } from "./takeoffQuality.js";

export function shouldExtractRaster(recorded) {
  if (!recorded) return false;
  if (looksLikeCoverOrRendering(recorded) || looksLikeIndexPage(recorded)) return false;
  if (isNonPlanSheetKind(recorded.kind) || recorded.kind === "spec") return false;
  const fromId = tradeFromSheetId(recorded.sheetId);
  if (fromId && fromId !== "electrical") return false;
  if (recorded.discipline === "electrical"
    || fromId === "electrical"
    || looksLikeElectricalPlan(recorded)) return true;
  return isScannedOrSparsePage(recorded) && Boolean(recorded.forceRaster);
}

export function persistableAiPages(pages) {
  return (pages || []).map((page) => {
    const { pdfPage, ...rest } = page || {};
    return rest;
  });
}
