import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatAccuracyReport, scoreTakeoffAccuracy } from "./accuracyHarness.js";
import { LABEL_AUTHORITY, pottsvilleTokenTruth } from "./labeledTruth.js";
import { stressZoomPan, takeoffPerformanceBudget } from "./takeoffQuality.js";
import { sheetPinchViewport, TAKEOFF_MAX_ZOOM, TAKEOFF_MIN_ZOOM } from "../../lib/sheetViewport.js";

const here = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
  return JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));
}

function summarize(name, fixture, options = {}) {
  const score = scoreTakeoffAccuracy(fixture, options);
  return {
    name,
    labelAuthority: score.labelAuthority,
    truth: score.truth,
    found: score.found,
    falsePositives: score.falsePositives,
    typedFalsePositives: score.typedFalsePositives,
    falseNegatives: score.falseNegatives,
    detectionRecall: score.detectionRecall,
    detectionPrecision: score.detectionPrecision,
    typedPrecision: score.typedPrecision,
    worstTypeRecall: score.worstTypeRecall,
    classificationAccuracy: score.classificationAccuracy,
    markerAccuracy: score.markerAccuracy,
    hoverAccuracy: score.hoverAccuracy,
    wallFalsePositives: score.wallFalsePositives,
    unresolvedCount: score.unresolvedCount,
    canClaimThreshold: score.canClaimThreshold,
    meetsDetection: score.meetsDetection,
    typeRecalls: score.typeRecalls,
    missed: score.unmatchedTruth.slice(0, 12).map((item) => `${item.type}@${item.sheet}`),
    extras: score.extraMarks.slice(0, 8).map((mark) => `${mark.typeCode || mark.abbr}@${mark.sheet}`),
    wrongHovers: (score.wrongHovers || []).length,
    failedMarkers: (score.failedMarkers || []).length,
    report: formatAccuracyReport(score),
  };
}

export function zoomCrashRegressions() {
  const budget = takeoffPerformanceBudget({
    width: 2592,
    height: 1944,
    pathCount: 12_000,
    zoom: 4,
    memoryMb: 90,
  });
  const pinch = sheetPinchViewport({
    startZoom: 1,
    startDistance: 80,
    startPan: { x: 0, y: 0 },
    startMid: { x: 400, y: 300 },
    currentDistance: 640,
    currentMid: { x: 420, y: 310 },
    viewportRect: { left: 0, top: 0, width: 1200, height: 800 },
    minZoom: TAKEOFF_MIN_ZOOM,
    maxZoom: TAKEOFF_MAX_ZOOM,
  });
  const stress = stressZoomPan({ zoom: 1, pan: { x: 12, y: -8 } });
  return {
    budgetOk: Boolean(budget.ok),
    pinchFinite: Number.isFinite(pinch.zoom) && Number.isFinite(pinch.pan.x) && Number.isFinite(pinch.pan.y),
    pinchInRange: pinch.zoom >= TAKEOFF_MIN_ZOOM && pinch.zoom <= TAKEOFF_MAX_ZOOM,
    stressOk: Boolean(stress.ok),
    ok: Boolean(budget.ok && Number.isFinite(pinch.zoom) && stress.ok),
  };
}

export function collectTakeoffBaseline() {
  const soccer = loadFixture("soccer-pavilion-electrical.json");
  const pottsville = loadFixture("pottsville-electrical.json");
  const stub = {
    ...loadFixture("takeoff-upgrade-labeled.json"),
    labelAuthority: LABEL_AUTHORITY.SYNTHETIC,
  };
  const allowed = new Set(["OS", "GFI", "GFI/WP", "WP"]);
  const cases = [
    summarize("soccer-pavilion-independent", {
      ...soccer,
      labelAuthority: LABEL_AUTHORITY.INDEPENDENT,
    }),
    summarize("pottsville-os-wp-derived-tokens", {
      ...pottsville,
      groundTruth: pottsvilleTokenTruth(pottsville.pages, allowed),
      labelAuthority: LABEL_AUTHORITY.DERIVED_TOKENS,
    }, { scoreTypes: allowed }),
    summarize("synthetic-wp-stub", stub),
  ];
  return {
    generatedAt: "phase-2",
    zoom: zoomCrashRegressions(),
    cases,
    independent: cases.filter((item) => item.labelAuthority === LABEL_AUTHORITY.INDEPENDENT),
    anyThresholdClaim: cases.some((item) => item.canClaimThreshold),
  };
}

/**
 * @param {any} baseline
 */
export function formatBaselineMarkdown(baseline) {
  const lines = [
    "# Phase 2 takeoff baseline",
    "",
    "No 99% claim is permitted unless an independently labeled drawing meets recall, per-type recall, precision, classification, and marker placement.",
    "",
  ];
  for (const item of baseline.cases) {
    lines.push(`## ${item.name}`);
    lines.push("");
    lines.push("```");
    lines.push(item.report);
    lines.push("```");
    lines.push("");
  }
  lines.push("## Zoom / pan regression");
  lines.push("");
  lines.push(JSON.stringify(baseline.zoom, null, 2));
  lines.push("");
  return lines.join("\n");
}
