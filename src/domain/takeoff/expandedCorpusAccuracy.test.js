import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCURACY_THRESHOLD,
  formatAccuracyReport,
  markTypeKey,
  scoreTakeoffAccuracy,
} from "./accuracyHarness.js";
import { reviewQueue } from "./accuracyReview.js";
import { buildAiMarks } from "./aiTakeoff.js";
import { reconcilePlanToSchedule } from "./countReconciliation.js";
import { uniquePlanReceptacleGlyphs } from "./legendGeometry.js";
import {
  isNonPlanSheetKind,
  isPlanInterior,
  isPlotStampToken,
  normalizeTypeMark,
  shouldAcceptPlanToken,
} from "./symbolDetection.js";
import {
  describeSheetCoverage,
  isApplicablePlanSheet,
  mergeReviewQueue,
  pagesCoverage,
} from "./sheetCoverage.js";
import { paletteForTrade } from "./trades.js";
import { isJunkGeometry } from "./vectorSymbols.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const soccer = JSON.parse(readFileSync(join(here, "fixtures/soccer-pavilion-electrical.json"), "utf8"));
const pottsville = JSON.parse(readFileSync(join(here, "fixtures/pottsville-electrical.json"), "utf8"));
const pottsvilleCover = JSON.parse(readFileSync(join(here, "fixtures/pottsville-cover.json"), "utf8"));

export const MISSING_CORPUS_CLASSES = [
  {
    id: "residential",
    reason: "No residential electrical drawing fixture is in the repo. Downloads-only PDFs are not imported.",
  },
  {
    id: "industrial",
    reason: "No dedicated industrial set. Pottsville E111 is a commercial pump-house sheet; only one printed WP has token ground truth.",
  },
  {
    id: "raster-scanned",
    reason: "No scanned or flattened page exists in fixtures. rasterReconcile.test.js uses synthetic rasterPaths only.",
  },
  {
    id: "low-quality",
    reason: "No low-quality or poor CAD-export fixture is in the repo.",
  },
];

function sliceFixture(fixture, pageNumbers, sheets) {
  const pages = new Set(pageNumbers);
  const keep = new Set(sheets);
  return {
    ...fixture,
    pages: (fixture.pages || []).filter((page) => pages.has(page.page)),
    groundTruth: (fixture.groundTruth || []).filter((device) => keep.has(device.sheet)),
  };
}

function pottsvilleTokenTruth(pages = [], allowed = new Set(["OS", "GFI", "GFI/WP", "WP"])) {
  const devices = [];
  for (const page of pages || []) {
    if (isNonPlanSheetKind(page.kind) || page.kind === "legend") continue;
    const tokens = page.tokens || [];
    for (const token of tokens) {
      if (!shouldAcceptPlanToken(token, tokens)) continue;
      const type = normalizeTypeMark(token.text).toUpperCase();
      if (!allowed.has(type)) continue;
      if (isPlotStampToken(token, tokens)) continue;
      devices.push({
        sheet: page.page,
        type,
        x: token.x,
        y: token.y,
        cx: token.x,
        cy: token.y,
        w: 0.9,
        h: 0.9,
        kind: "circle",
        tagOnSymbol: true,
        source: "plan-token",
      });
    }
  }
  return devices;
}

function e110ReceptacleTruth(page) {
  return uniquePlanReceptacleGlyphs(page?.paths || [], page?.tokens || []).map((path) => ({
    sheet: page.page,
    type: "R",
    x: path.cx,
    y: path.cy,
    cx: path.cx,
    cy: path.cy,
    w: path.w,
    h: path.h,
    kind: path.kind || "rect",
    source: "plan-glyph",
  }));
}

function e210Type2CanTruth(page) {
  const lightingOpts = { planType: "lighting", paths: page?.paths || [] };
  const unique = [];
  for (const path of page?.paths || []) {
    if (isJunkGeometry(path) || !isPlanInterior({ x: path.cx, y: path.cy })) continue;
    if ((path.cx || 0) > 64 || (path.cy || 0) < 12) continue;
    const w = Number(path.w) || 0;
    const h = Number(path.h) || 0;
    if (Math.abs(w - 0.595) > 0.05 || Math.abs(h - 0.722) > 0.05) continue;
    if (unique.some((other) => Math.hypot(other.cx - path.cx, other.cy - path.cy) < 0.3)) continue;
    const printedTwo = (page?.tokens || []).some((token) => (
      normalizeTypeMark(token.text) === "2"
      && shouldAcceptPlanToken(token, page.tokens, lightingOpts)
      && Math.hypot((Number(token.x) || 0) - path.cx, (Number(token.y) || 0) - path.cy) <= 0.7
    ));
    const printedOne = (page?.tokens || []).some((token) => (
      normalizeTypeMark(token.text) === "1"
      && Math.hypot((Number(token.x) || 0) - path.cx, (Number(token.y) || 0) - path.cy) <= 0.7
    ));
    if (!printedTwo || printedOne) continue;
    unique.push({
      sheet: page.page,
      type: "2",
      x: path.cx,
      y: path.cy,
      cx: path.cx,
      cy: path.cy,
      w: path.w,
      h: path.h,
      kind: path.kind || "rect",
      source: "printed-2-can",
    });
  }
  return unique;
}

function e210LabeledTruth(page) {
  const lightingOpts = { planType: "lighting", paths: page?.paths || [] };
  return (page?.tokens || []).filter((token) => {
    const code = normalizeTypeMark(token.text).toUpperCase();
    return /^(?:[1-4]|OS)$/.test(code) && shouldAcceptPlanToken(token, page.tokens, lightingOpts);
  }).map((token) => ({
    sheet: page.page,
    type: normalizeTypeMark(token.text).toUpperCase(),
    x: token.x,
    y: token.y,
    cx: token.x,
    cy: token.y,
    w: 0.9,
    h: 0.9,
    kind: "rect",
    tagOnSymbol: true,
    source: "plan-token",
  }));
}

function filterScoreToTruthTypes(score, truth) {
  const types = new Set(truth.map((device) => markTypeKey({ typeCode: device.type })));
  const extraMarks = (score.extraMarks || []).filter((mark) => types.has(markTypeKey(mark)));
  const counts = score.found + extraMarks.length;
  return {
    ...score,
    extraMarks,
    falsePositives: extraMarks.length,
    counts,
    detectionPrecision: counts ? score.found / counts : 1,
  };
}

function assertCoverageHonest(pages, marks, label) {
  const coverage = pagesCoverage(pages, marks, { trade: "electrical" });
  for (const sheet of coverage.sheets) {
    if (!sheet.applicable) {
      assert(sheet.complete === true, `${label} non-plan ${sheet.sheet} must not stay incomplete`);
      continue;
    }
    assert(!(sheet.complete && sheet.unscannedCount > 0), `${label} sheet ${sheet.sheet} cannot be complete with unscanned regions`);
    if (sheet.deviceCount === 0) {
      assert(sheet.complete === false, `${label} sheet ${sheet.sheet} is not complete just because nothing was detected`);
      assert(/not complete/i.test(describeSheetCoverage(sheet)), `${label} empty applicable sheet stays unresolved`);
    }
  }
  return coverage;
}

function runCase(name, fixture, options = {}) {
  const raw = scoreTakeoffAccuracy(fixture);
  const score = options.filterTypes ? filterScoreToTruthTypes(raw, fixture.groundTruth) : raw;
  console.log(`\n${name}\n${formatAccuracyReport(score)}`);
  if (score.unmatchedTruth.length) {
    console.log("missed", score.unmatchedTruth.slice(0, 8).map((item) => `${item.type}@${item.sheet}:${item.x},${item.y}`).join(" "));
  }
  if (score.extraMarks.length) {
    console.log("extra", score.extraMarks.slice(0, 8).map((item) => `${item.typeCode}@${item.sheet}:${Number(item.x).toFixed(1)},${Number(item.y).toFixed(1)}`).join(" "));
  }
  if (score.failedMarkers.length) {
    console.log("marker-on-text", score.failedMarkers.slice(0, 8).map((item) => `${item.device.type}@${item.device.sheet}`).join(" "));
  }
  assert(score.truth >= (options.minTruth || 1), `${name} must use real ground truth, got ${score.truth}`);
  assert(score.unmatchedTruth.length === 0, `${name} missed ${score.unmatchedTruth.length} devices`);
  assert(score.falsePositives === 0, `${name} extra/wrong-type ${score.falsePositives}`);
  if (options.requirePlacement !== false) {
    assert(score.markerAccuracy >= ACCURACY_THRESHOLD, `${name} marker-on-text/bad highlight ${(score.markerAccuracy * 100).toFixed(2)}%`);
    assert(score.failedMarkers.length === 0, `${name} has ${score.failedMarkers.length} markers off symbol body`);
  }
  return score;
}

assert(soccer.groundTruth.every((device) => device.type && Number.isFinite(device.cx) && Number.isFinite(device.w)), "Soccer GT already has type and symbol-body bounds");
assert(soccer.source.project !== pottsville.source.project, "Soccer and Pottsville are different firms");

const soccerFull = runCase("soccer-full commercial vector", soccer);
const soccerSite = runCase("soccer-site E0.01", sliceFixture(soccer, [47, 48], [48]));
const soccerLighting = runCase("soccer-lighting dense E1.01", sliceFixture(soccer, [47, 50], [50]));
const soccerPower = runCase("soccer-power E2.01", sliceFixture(soccer, [47, 51], [51]));

const e110 = pottsville.pages.find((page) => page.page === 50);
const e210 = pottsville.pages.find((page) => page.page === 52);
const e111 = pottsville.pages.find((page) => page.page === 51);
const pottsvilleOsWp = runCase("pottsville-os-wp different firm", {
  ...pottsville,
  groundTruth: pottsvilleTokenTruth(pottsville.pages),
}, { filterTypes: true });
const pottsvillePowerGlyphs = runCase("pottsville-e110 power glyphs", {
  ...pottsville,
  pages: pottsville.pages.filter((page) => page.page === 48 || page.page === 50),
  groundTruth: e110ReceptacleTruth(e110),
}, { filterTypes: true });
const pottsvilleCans = runCase("pottsville-e210 type-2 cans", {
  ...pottsville,
  pages: pottsville.pages.filter((page) => page.page === 48 || page.page === 52),
  groundTruth: e210Type2CanTruth(e210),
}, { filterTypes: true });
const pottsvilleLabeled = runCase("pottsville-e210 labeled 1-4/OS", {
  ...pottsville,
  pages: pottsville.pages.filter((page) => page.page === 48 || page.page === 52),
  groundTruth: e210LabeledTruth(e210),
}, { filterTypes: true, requirePlacement: false });

assert(soccerFull.found === 129 && soccerFull.falsePositives === 0, "Soccer Pavilion regression stays 129/129 FP 0");
assert(soccerSite.found === 2 && soccerSite.falsePositives === 0, "Site plan uses the two real GFI/WP bodies already in Soccer GT");
assert(soccerLighting.found === 95, "Soccer lighting sheet keeps its 95 fixture GT");
assert(soccerPower.found === 32, "Soccer power sheet keeps its 32 device GT");
assert(pottsvilleOsWp.found === 15 && pottsvilleOsWp.falsePositives === 0, "Pottsville OS+WP regression stays 15/15");
assert(pottsvillePowerGlyphs.found === 8, "E110 receptacle glyphs stay 8/8");
assert(pottsvilleCans.found === 12 && pottsvilleCans.falsePositives === 0, "E210 type-2 cans stay 12/12 extra2 0");
assert(pottsvilleLabeled.found === pottsvilleLabeled.truth && pottsvilleLabeled.falsePositives === 0, `E210 labeled 1-4/OS stay ${pottsvilleLabeled.found}/${pottsvilleLabeled.truth}`);
assert(pottsvilleLabeled.found >= 23, "E210 labeled plan types stay at least the previous 23");

const electrical = paletteForTrade("electrical");
const soccerMarks = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: soccer.drawingSymbols || [],
  pages: soccer.pages,
  maxHomeruns: 8,
});
const coverMarks = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [],
  pages: [{ ...pottsvilleCover, page: pottsvilleCover.page || 1 }],
  maxHomeruns: 8,
});
const coverDevices = (coverMarks.marks || []).filter((mark) => mark.type === "count" || mark.type === "drop");
assert(coverDevices.length === 0, `cover stays 0, got ${coverDevices.length}`);
assert(!isApplicablePlanSheet(pottsvilleCover, { trade: "electrical" }), "cover is not an applicable plan sheet");

const soccerCoverage = assertCoverageHonest(soccer.pages, soccerMarks.marks, "soccer");
assert(soccerCoverage.sheets.filter((sheet) => sheet.applicable).length === 3, "Soccer applicable plans are site + lighting + power");
assert(soccerCoverage.incomplete >= 1, "Soccer applicable sheets still report unscanned regions");
const siteCoverage = soccerCoverage.sheets.find((sheet) => sheet.sheet === 48);
assert(siteCoverage && siteCoverage.complete === false && siteCoverage.unscannedCount > 0, "site plan is not complete just because two GFI/WP were found");

const pottsvilleCoverage = assertCoverageHonest(pottsville.pages, buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: pottsville.drawingSymbols || [],
  pages: pottsville.pages,
  maxHomeruns: 8,
}).marks, "pottsville");
assert(pottsvilleCoverage.sheets.find((sheet) => sheet.sheet === 48)?.applicable === false, "E001 legend is not an applicable plan");

const queue = mergeReviewQueue(reviewQueue(soccerMarks.marks, 50), soccerCoverage, 50);
assert(queue.some((item) => item.requiresReview || item.type === "coverage"), "review queue still includes uncertain marks or unscanned regions");
const reconcile = reconcilePlanToSchedule({
  marks: soccerMarks.marks,
  pages: soccer.pages,
  trade: "electrical",
});
assert(typeof reconcile.persistedCount === "number", "count reconciliation still runs");
assert(reconcile.rows.every((row) => row.persistedCount === row.planCount), "schedule qty is never copied into the plan count");

const e111Truth = pottsvilleTokenTruth([e111]);
console.log(`\nE111 pump-house documented GT: ${e111Truth.length} printed WP. Remaining E111 devices have no coordinate ground truth.`);
assert(e111Truth.length === 1 && e111Truth[0].type === "WP", "E111 only contributes the one printed WP already in Pottsville OS+WP");

console.log("\nCorpus classes with real fixtures:");
console.log("- lighting: Soccer E1.01 (95) · Pottsville E210 cans 12 / labeled 23");
console.log("- power: Soccer E2.01 (32) · Pottsville E110 glyphs 8");
console.log("- site: Soccer E0.01 (2 GFI/WP)");
console.log("- commercial / different firms: Soccer Pavilion vs MCFD Pottsville");
console.log("- vector: both extracted path fixtures");
console.log("- dense: Soccer lighting 95 devices on one sheet");

console.log("\nSkipped classes (no real fixture / no coordinate GT):");
for (const gap of MISSING_CORPUS_CLASSES) {
  console.log(`SKIP ${gap.id}: ${gap.reason}`);
}
assert(MISSING_CORPUS_CLASSES.length === 4, "missing classes stay documented instead of faking fixtures");
assert(!MISSING_CORPUS_CLASSES.some((item) => item.fixture), "do not attach fake fixtures to skipped classes");

if (!process.exitCode) console.log("\nexpanded corpus accuracy checks passed");
