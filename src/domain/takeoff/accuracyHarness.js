import { buildAiMarks } from "./aiTakeoff.js";
import { bidDeviceMarks, isReviewOnlyMark } from "./detectionRecord.js";
import { normalizeTypeMark, taggedEquipmentCode } from "./symbolDetection.js";
import { paletteForTrade } from "./trades.js";

export const ACCURACY_THRESHOLD = 0.99;
export const LOCATION_MATCH_RADIUS = 3.1;

const CALLOUT_SOURCES = new Set([
  "quoted-type",
  "occupancy",
  "receptacle",
  "fan",
  "site-receptacle",
]);
const DETECTOR_SOURCES = new Set([
  "plan-token",
  "plan-glyph",
  "printed-2-can",
  "detector-glyph",
  "detector-derived",
  "detector-can",
]);

function typeKey(value) {
  const tagged = taggedEquipmentCode(value);
  if (tagged) return tagged;
  const text = normalizeTypeMark(value).toUpperCase();
  if (text === "GFIWP" || text === "WPGFI" || text === "GFI/WP") return "GFI/WP";
  return text;
}

export function markTypeKey(mark) {
  return typeKey(mark?.typeCode || mark?.abbr || mark?.symbol || "");
}

export function paintedPoint(mark) {
  const x = Number(mark?.symbolBodyLocation?.x ?? mark?.x);
  const y = Number(mark?.symbolBodyLocation?.y ?? mark?.y);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function bodyCenter(device) {
  const x = Number(device?.cx ?? device?.x);
  const y = Number(device?.cy ?? device?.y);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function tagPoint(device) {
  return {
    x: Number(device?.x) || 0,
    y: Number(device?.y) || 0,
  };
}

export function classifyGroundTruth(fixture = {}) {
  const declared = fixture.groundTruthIndependence || fixture.labelMethod;
  if (declared === "manual" || declared === "drawing-callout" || declared === "detector-derived" || declared === "unspecified") {
    return declared;
  }
  const truth = fixture.groundTruth || [];
  if (!truth.length) return "absent";
  const sources = truth.map((device) => device.source || device.labelMethod || "");
  if (sources.every((source) => source === "manual")) return "manual";
  if (sources.some((source) => DETECTOR_SOURCES.has(source))) return "detector-derived";
  if (sources.every((source) => CALLOUT_SOURCES.has(source))) return "drawing-callout";
  return "unspecified";
}

function ratio(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

function typeRelation(mark, deviceType) {
  const markType = markTypeKey(mark);
  if (markType && markType === deviceType) return "exact";
  const alias = (deviceType === "GFI/WP" && markType === "GFI")
    || (deviceType === "GFI" && mark?.symbol === "gfci" && markType !== "GFI")
    || (deviceType === "OS" && mark?.symbol === "occ" && markType !== "OS")
    || (deviceType === "VF" && mark?.symbol === "vf" && markType !== "VF")
    || (deviceType === "EF" && mark?.symbol === "ef" && markType !== "EF");
  return alias ? "alias" : "wrong";
}

export function placementMeasurable(device) {
  if (device?.placementMeasured === false) return false;
  if (device?.placementMeasured === true) return true;
  const body = bodyCenter(device);
  const tag = tagPoint(device);
  return Math.hypot(body.x - tag.x, body.y - tag.y) > 0.2;
}

export function markerOnSymbolBody(mark, device) {
  const point = paintedPoint(mark);
  const body = bodyCenter(device);
  const halfW = Math.max(Number(device?.w) || 0, 0.35) / 2;
  const halfH = Math.max(Number(device?.h) || 0, 0.35) / 2;
  return Math.abs(point.x - body.x) <= halfW + 0.15
    && Math.abs(point.y - body.y) <= halfH + 0.15;
}

function sheetOf(mark) {
  return Number(mark?.sheet ?? mark?.page);
}

export function scoreDetections({ marks = [], groundTruth = [], unresolvedMarks = [], independence = "unspecified", coverageComplete = false } = {}) {
  const counts = bidDeviceMarks(marks);
  const truth = groundTruth || [];
  const pairs = [];
  counts.forEach((mark, markIndex) => {
    const point = paintedPoint(mark);
    truth.forEach((device, deviceIndex) => {
      if (Number(device.sheet) !== sheetOf(mark)) return;
      const body = bodyCenter(device);
      const tag = tagPoint(device);
      const geoDist = Math.hypot(point.x - body.x, point.y - body.y);
      const tagDist = Math.hypot(point.x - tag.x, point.y - tag.y);
      const dist = Math.min(geoDist, tagDist);
      if (dist <= LOCATION_MATCH_RADIUS) {
        pairs.push({ mark, markIndex, device, deviceIndex, dist, geoDist, tagDist });
      }
    });
  });
  pairs.sort((a, b) => a.dist - b.dist || a.markIndex - b.markIndex);
  const usedMarks = new Set();
  const usedDevices = new Set();
  const matches = [];
  for (const pair of pairs) {
    if (usedMarks.has(pair.markIndex) || usedDevices.has(pair.deviceIndex)) continue;
    usedMarks.add(pair.markIndex);
    usedDevices.add(pair.deviceIndex);
    const relation = typeRelation(pair.mark, typeKey(pair.device.type));
    const measurable = placementMeasurable(pair.device);
    const onGeometry = measurable ? markerOnSymbolBody(pair.mark, pair.device) : null;
    matches.push({ ...pair, relation, measurable, onGeometry });
  }
  const doubleCounts = [];
  const extraMarks = [];
  counts.forEach((mark, markIndex) => {
    if (usedMarks.has(markIndex)) return;
    const point = paintedPoint(mark);
    const duplicate = matches.some((match) => (
      Number(match.device.sheet) === sheetOf(mark)
      && Math.hypot(point.x - bodyCenter(match.device).x, point.y - bodyCenter(match.device).y) <= LOCATION_MATCH_RADIUS
    ));
    if (duplicate) doubleCounts.push(mark);
    else extraMarks.push(mark);
  });
  const byType = {};
  for (const device of truth) {
    const key = typeKey(device.type) || "(blank)";
    if (!byType[key]) byType[key] = { truth: 0, located: 0, found: 0 };
    byType[key].truth += 1;
  }
  for (const match of matches) {
    const key = typeKey(match.device.type) || "(blank)";
    byType[key].located += 1;
    if (match.relation === "exact") byType[key].found += 1;
  }
  const typeRecalls = Object.fromEntries(Object.entries(byType).map(([key, row]) => [
    key,
    { ...row, recall: ratio(row.found, row.truth), locationRecall: ratio(row.located, row.truth) },
  ]));
  const recallValues = Object.values(typeRecalls).map((row) => row.recall).filter((value) => value != null);
  const placed = matches.filter((match) => match.measurable && match.onGeometry);
  const placementMeasured = matches.filter((match) => match.measurable).length;
  const exact = matches.filter((match) => match.relation === "exact").length;
  const aliasMatches = matches.filter((match) => match.relation === "alias").length;
  const detectionRecall = ratio(matches.length, truth.length);
  const detectionPrecision = ratio(matches.length, counts.length);
  const classificationAccuracy = ratio(exact, matches.length);
  const markerAccuracy = ratio(placed.length, placementMeasured);
  const worstTypeRecall = recallValues.length ? Math.min(...recallValues) : null;
  const manual = independence === "manual";
  const measured = manual && truth.length > 0
    && detectionRecall != null
    && detectionPrecision != null
    && classificationAccuracy != null
    && worstTypeRecall != null;
  const meetsDetection = measured
    && detectionRecall >= ACCURACY_THRESHOLD
    && detectionPrecision >= ACCURACY_THRESHOLD
    && classificationAccuracy >= ACCURACY_THRESHOLD
    && worstTypeRecall >= ACCURACY_THRESHOLD;
  const meetsMarkers = measured
    && placementMeasured === matches.length
    && placementMeasured > 0
    && markerAccuracy != null
    && markerAccuracy >= ACCURACY_THRESHOLD;
  const unresolvedCandidates = unresolvedMarks || [];
  return {
    independence,
    truth: truth.length,
    found: matches.length,
    classified: exact,
    falsePositives: extraMarks.length + doubleCounts.length,
    falseNegatives: truth.length - matches.length,
    doubleCounts: doubleCounts.length,
    aliasMatches,
    counts: counts.length,
    detectionRecall,
    symbolRecall: detectionRecall,
    detectionPrecision,
    classificationAccuracy,
    worstTypeRecall,
    markerAccuracy,
    placementMeasured,
    placementUnmeasured: matches.length - placementMeasured,
    typeRecalls,
    meetsDetection,
    meetsMarkers,
    claimPermitted: meetsDetection && meetsMarkers && unresolvedCandidates.length === 0 && coverageComplete === true,
    unmatchedTruth: truth.filter((_, index) => !usedDevices.has(index)),
    extraMarks,
    duplicateMarks: doubleCounts,
    failedMarkers: matches.filter((match) => match.measurable && !match.onGeometry),
    unresolvedCandidates,
    unresolvedCount: unresolvedCandidates.length,
    matches,
  };
}

export function scoreTakeoffAccuracy(fixture, options = {}) {
  const electrical = paletteForTrade("electrical");
  const result = buildAiMarks({
    trade: "electrical",
    symbols: electrical.symbols,
    drawingSymbols: fixture.drawingSymbols || [],
    pages: fixture.pages || [],
    maxHomeruns: 8,
    conduit: options.conduit,
  });
  const unresolvedCandidates = (result.marks || []).filter((mark) => (
    (mark.type === "count" || mark.type === "drop") && isReviewOnlyMark(mark)
  ));
  const independence = classifyGroundTruth(fixture);
  const scored = scoreDetections({
    marks: result.marks || [],
    groundTruth: fixture.groundTruth || [],
    unresolvedMarks: unresolvedCandidates,
    independence,
    coverageComplete: options.coverageComplete === true,
  });
  return {
    summary: result.summary,
    deviceCount: result.deviceCount,
    ...scored,
  };
}

function percent(value) {
  if (value == null || Number.isNaN(value)) return "unmeasured";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatAccuracyReport(score) {
  const types = Object.entries(score.typeRecalls || {})
    .map(([key, row]) => `${key} ${row.found}/${row.truth} exact (${percent(row.recall)})`)
    .join(", ");
  return [
    `independence ${score.independence || "unspecified"}`,
    `symbol recall ${percent(score.detectionRecall)} (${score.found}/${score.truth})`,
    `classification ${percent(score.classificationAccuracy)} (${score.classified ?? 0} exact, ${score.aliasMatches || 0} alias)`,
    `worst type ${percent(score.worstTypeRecall)}`,
    `precision ${percent(score.detectionPrecision)} (FP ${score.falsePositives}, double-counts ${score.doubleCounts || 0})`,
    `false negatives ${score.falseNegatives ?? 0}`,
    `marker accuracy ${percent(score.markerAccuracy)} (${score.placementMeasured || 0} measured, ${score.placementUnmeasured || 0} unmeasured)`,
    `ground truth ${score.truth > 0 ? score.independence || "present" : "MISSING — no accuracy claim permitted"}`,
    `accuracy claim ${score.claimPermitted ? "permitted" : "not permitted"}`,
    `unresolved review ${score.unresolvedCount || 0}`,
    types,
  ].join("\n");
}
