import { looksLikeCoverOrRendering, looksLikeElectricalPlan, looksLikeIndexPage } from "./drawing-docs.js";
import { isNonPlanSheetKind } from "./symbolDetection.js";

export const PLAN_COVERAGE_BOUNDS = { minX: 7, minY: 10, maxX: 76, maxY: 88 };
export const COVERAGE_COLS = 4;
export const COVERAGE_ROWS = 3;

export function coverageCells(bounds = PLAN_COVERAGE_BOUNDS) {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const cellW = width / COVERAGE_COLS;
  const cellH = height / COVERAGE_ROWS;
  const cells = [];
  for (let row = 0; row < COVERAGE_ROWS; row += 1) {
    for (let col = 0; col < COVERAGE_COLS; col += 1) {
      const minX = bounds.minX + col * cellW;
      const minY = bounds.minY + row * cellH;
      cells.push({
        col,
        row,
        minX,
        minY,
        maxX: minX + cellW,
        maxY: minY + cellH,
        x: minX + cellW / 2,
        y: minY + cellH / 2,
      });
    }
  }
  return cells;
}

export function isApplicablePlanSheet(page, options = {}) {
  if (!page) return false;
  const kind = page.kind || options.pageKinds?.[page.page];
  if (looksLikeCoverOrRendering(page) || looksLikeIndexPage(page)) return false;
  if (isNonPlanSheetKind(kind)) return false;
  const trade = options.trade || "electrical";
  if (trade === "electrical") return looksLikeElectricalPlan(page);
  return true;
}

export function planSheetCoverage(page, marks = [], options = {}) {
  const sheet = page?.page;
  const applicable = isApplicablePlanSheet(page, options);
  const confirmed = new Set(options.confirmedRegionIds || []);
  const devices = (marks || []).filter((mark) => (
    (mark.sheet || 1) === sheet
    && (mark.type === "count" || mark.type === "drop")
  ));
  const cells = coverageCells().map((cell) => {
    const hits = devices.filter((mark) => (
      mark.x >= cell.minX && mark.x < cell.maxX
      && mark.y >= cell.minY && mark.y < cell.maxY
    ));
    const id = `unscanned-${sheet}-${cell.col}-${cell.row}`;
    const scanned = hits.length > 0 || confirmed.has(id);
    return { ...cell, id, sheet, scanned, hitCount: hits.length };
  });
  const unscanned = applicable ? cells.filter((cell) => !cell.scanned) : [];
  const confirmedEmpty = Boolean(options.confirmedEmptySheets?.[sheet]);
  const complete = applicable
    ? unscanned.length === 0 && (devices.length > 0 || confirmedEmpty)
    : true;
  let reason = "analyzed";
  if (!applicable) reason = "not-applicable";
  else if (unscanned.length) reason = "unscanned-regions";
  else if (devices.length === 0 && !confirmedEmpty) reason = "empty-unconfirmed";
  return {
    sheet,
    applicable,
    cells,
    scannedCount: cells.filter((cell) => cell.scanned).length,
    unscannedCount: unscanned.length,
    deviceCount: devices.length,
    complete,
    reason,
    unresolvedRegions: unscanned.map((cell) => ({
      id: cell.id,
      type: "coverage",
      layer: "review",
      sheet,
      x: cell.x,
      y: cell.y,
      typeCode: "UNSCANNED",
      symbol: "unknown",
      symbolLabel: "Unscanned region",
      reviewReason: "unscanned-region",
      requiresReview: true,
      symbolBodyBounds: {
        x: cell.minX,
        y: cell.minY,
        w: cell.maxX - cell.minX,
        h: cell.maxY - cell.minY,
        kind: "rect",
      },
    })),
  };
}

export function pagesCoverage(pages = [], marks = [], options = {}) {
  const sheets = (pages || []).map((page) => planSheetCoverage(page, marks, options));
  return {
    sheets,
    incomplete: sheets.filter((sheet) => sheet.applicable && !sheet.complete).length,
    unscannedRegions: sheets.flatMap((sheet) => sheet.unresolvedRegions),
  };
}

export function mergeReviewQueue(queue = [], coverage, sheet) {
  const regions = (coverage?.unscannedRegions || coverage?.unresolvedRegions || [])
    .filter((region) => sheet == null || region.sheet === sheet);
  return [...queue, ...regions];
}

export function neighborQueueId(items, currentId, direction = 1) {
  if (!items?.length) return null;
  const index = items.findIndex((item) => item.id === currentId);
  const start = index < 0 ? 0 : index;
  return items[(start + direction + items.length) % items.length]?.id || null;
}

export function describeSheetCoverage(coverage) {
  if (!coverage) return "Sheet coverage has not been computed.";
  if (!coverage.applicable) return "This sheet is not an applicable plan sheet.";
  if (coverage.complete) return `Plan interior analyzed (${coverage.scannedCount} of ${coverage.cells.length} regions).`;
  if (coverage.reason === "empty-unconfirmed") {
    return "Sheet is not complete. Nothing was detected, and empty coverage has not been confirmed.";
  }
  return `Sheet is not complete. ${coverage.unscannedCount} region${coverage.unscannedCount === 1 ? "" : "s"} still need a look.`;
}
