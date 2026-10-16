import { buildAiMarks } from "./aiTakeoff.js";
import { bidDeviceMarks, isReviewOnlyMark } from "./detectionRecord.js";
import { legendHoverData } from "./legendHover.js";
import {
  LABEL_AUTHORITY,
  MIN_INDEPENDENT_TRUTH,
  canClaimThreshold,
  inferLabelAuthority,
  inspectGroundTruth,
} from "./labeledTruth.js";
import { normalizeTypeMark, taggedEquipmentCode } from "./symbolDetection.js";
import { paletteForTrade } from "./trades.js";
import { isWallOrArchitecturalMark } from "./vectorSymbols.js";

export const ACCURACY_THRESHOLD = 0.99;
export { LABEL_AUTHORITY, MIN_INDEPENDENT_TRUTH, inferLabelAuthority, inspectGroundTruth };

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

function typesMatch(markType, deviceType, mark) {
  return markType === typeKey(deviceType)
    || (typeKey(deviceType) === "GFI/WP" && markType === "GFI")
    || (typeKey(deviceType) === "GFI" && mark?.symbol === "gfci")
    || (typeKey(deviceType) === "OS" && (mark?.symbol === "occ" || mark?.abbr === "OS"))
    || (typeKey(deviceType) === "VF" && mark?.symbol === "vf")
    || (typeKey(deviceType) === "EF" && mark?.symbol === "ef");
}

function nearestTruth(mark, truth, used, requireType) {
  let best = null;
  let bestDist = Infinity;
  const markType = markTypeKey(mark);
  for (let index = 0; index < truth.length; index += 1) {
    if (used?.has(index)) continue;
    const device = truth[index];
    if (device.sheet !== mark.sheet) continue;
    if (requireType && !typesMatch(markType, device.type, mark)) continue;
    const dist = Math.hypot(mark.x - device.x, mark.y - device.y);
    const geoDist = Math.hypot(mark.x - (device.cx ?? device.x), mark.y - (device.cy ?? device.y));
    const nearest = Math.min(dist, geoDist);
    if (nearest < bestDist) {
      best = { index, device, dist, geoDist };
      bestDist = nearest;
    }
  }
  return best && bestDist <= 3.1 ? { ...best, bestDist } : null;
}

function markLooksLikeWall(mark) {
  const bounds = mark?.symbolBodyBounds || mark?.outline || {};
  return isWallOrArchitecturalMark({
    w: bounds.w,
    h: bounds.h,
    r: bounds.r,
    kind: bounds.kind || mark?.outline?.kind,
  });
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
  const counts = bidDeviceMarks(result.marks);
  const unresolvedCandidates = (result.marks || []).filter((mark) => (
    (mark.type === "count" || mark.type === "drop") && isReviewOnlyMark(mark)
  ));
  const truth = fixture.groundTruth || [];
  const inspect = inspectGroundTruth(truth);
  const labelAuthority = inferLabelAuthority(fixture);
  const used = new Set();
  const matches = [];
  for (const mark of counts) {
    const best = nearestTruth(mark, truth, used, true);
    if (!best) continue;
    used.add(best.index);
    const halfW = Math.max(Number(best.device.w) || 0, 0.35) / 2;
    const halfH = Math.max(Number(best.device.h) || 0, 0.35) / 2;
    const onGeometry = Math.abs(mark.x - (best.device.cx ?? best.device.x)) <= halfW + 0.22
      && Math.abs(mark.y - (best.device.cy ?? best.device.y)) <= halfH + 0.22;
    const closerToBody = best.geoDist + 0.12 <= best.dist;
    const neighbor = truth.some((other) => {
      if (other === best.device || other.sheet !== best.device.sheet) return false;
      const otherTag = Math.hypot(mark.x - other.x, mark.y - other.y);
      const otherBody = Math.hypot(mark.x - (other.cx ?? other.x), mark.y - (other.cy ?? other.y));
      return (otherTag + 0.28 < best.dist && otherBody + 0.28 < best.geoDist);
    });
    const onTag = best.dist <= 0.28 && best.geoDist > 0.55;
    const tagIsSymbol = Boolean(best.device.tagOnSymbol) && best.dist <= 0.45;
    const bodyDistinct = Math.hypot((best.device.cx ?? best.device.x) - best.device.x, (best.device.cy ?? best.device.y) - best.device.y) > 0.45;
    const onTagOnly = onTag && bodyDistinct && !best.device.tagOnSymbol;
    const vectorOnBody = mark.outlineSource === "vector" && best.geoDist <= 0.72 && !neighbor && !onTagOnly;
    const hover = legendHoverData(mark, fixture.drawingSymbols || []);
    const hoverOk = Boolean(hover?.code) && typesMatch(typeKey(hover.code), best.device.type, mark);
    matches.push({
      mark,
      device: best.device,
      onGeometry: (onGeometry || closerToBody || vectorOnBody || tagIsSymbol) && !neighbor && !onTagOnly,
      hoverOk,
      hover,
      debug: {
        geoDist: best.geoDist,
        tagDist: best.dist,
        neighbor,
        onTagOnly,
        src: mark.outlineSource,
      },
    });
  }
  const byType = {};
  for (const device of truth) {
    const key = typeKey(device.type);
    if (!byType[key]) byType[key] = { truth: 0, found: 0 };
    byType[key].truth += 1;
  }
  for (const match of matches) {
    const key = typeKey(match.device.type);
    byType[key].found += 1;
  }
  let classifiedWrong = 0;
  for (const mark of counts) {
    if (matches.some((item) => item.mark === mark)) continue;
    if (nearestTruth(mark, truth, null, false)) classifiedWrong += 1;
  }
  const extraMarks = counts.filter((mark) => !matches.some((item) => item.mark === mark));
  const typedExtra = options.scoreTypes
    ? extraMarks.filter((mark) => options.scoreTypes.has(markTypeKey(mark)))
    : extraMarks;
  const falsePositives = extraMarks.length;
  const typedFalsePositives = typedExtra.length;
  const falseNegatives = truth.length - matches.length;
  const placedOnGeometry = matches.filter((item) => item.onGeometry).length;
  const hoverCorrect = matches.filter((item) => item.hoverOk).length;
  const detectionRecall = truth.length ? matches.length / truth.length : 1;
  const detectionPrecision = counts.length ? matches.length / counts.length : 1;
  const typedPrecision = (matches.length + typedFalsePositives)
    ? matches.length / (matches.length + typedFalsePositives)
    : 1;
  const markerAccuracy = matches.length ? placedOnGeometry / matches.length : 1;
  const hoverAccuracy = matches.length ? hoverCorrect / matches.length : 1;
  const classificationAccuracy = (matches.length + classifiedWrong)
    ? matches.length / (matches.length + classifiedWrong)
    : (truth.length ? 0 : 1);
  const typeRecalls = Object.fromEntries(Object.entries(byType).map(([key, row]) => [
    key,
    { ...row, recall: row.truth ? row.found / row.truth : 1 },
  ]));
  const worstTypeRecall = Math.min(1, ...Object.values(typeRecalls).map((row) => row.recall));
  const metricsMeet = inspect.ready
    && detectionRecall >= ACCURACY_THRESHOLD
    && worstTypeRecall >= ACCURACY_THRESHOLD
    && detectionPrecision >= ACCURACY_THRESHOLD
    && classificationAccuracy >= ACCURACY_THRESHOLD
    && markerAccuracy >= ACCURACY_THRESHOLD;
  const claimAllowed = canClaimThreshold(labelAuthority, inspect);
  const meetsDetection = claimAllowed && metricsMeet;
  const meetsMarkers = claimAllowed && matches.length > 0 && markerAccuracy >= ACCURACY_THRESHOLD;
  return {
    summary: result.summary,
    deviceCount: result.deviceCount,
    truth: truth.length,
    found: matches.length,
    falsePositives,
    typedFalsePositives,
    falseNegatives,
    counts: counts.length,
    detectionRecall,
    detectionPrecision,
    typedPrecision,
    worstTypeRecall,
    markerAccuracy,
    hoverAccuracy,
    classificationAccuracy,
    classifiedWrong,
    typeRecalls,
    labelAuthority,
    groundTruthReady: inspect.ready,
    claimAllowed,
    canClaimThreshold: claimAllowed && metricsMeet,
    meetsDetection,
    meetsMarkers,
    unmatchedTruth: truth.filter((_, index) => !used.has(index)),
    extraMarks,
    typedExtraMarks: typedExtra,
    failedMarkers: matches.filter((item) => !item.onGeometry),
    wrongHovers: matches.filter((item) => !item.hoverOk),
    wallFalsePositives: extraMarks.filter(markLooksLikeWall).length,
    unresolvedCandidates,
    unresolvedCount: unresolvedCandidates.length,
  };
}

export function formatAccuracyReport(score) {
  const types = Object.entries(score.typeRecalls || {})
    .map(([key, row]) => `${key} ${row.found}/${row.truth} (${(row.recall * 100).toFixed(1)}%)`)
    .join(", ");
  const claim = score.canClaimThreshold
    ? "99% claim supported by independently labeled drawings"
    : "99% CLAIM NOT PERMITTED";
  return [
    `label authority ${score.labelAuthority || "none"}`,
    `detection recall ${(score.detectionRecall * 100).toFixed(2)}% (${score.found}/${score.truth})`,
    `worst type ${(score.worstTypeRecall * 100).toFixed(2)}%`,
    `precision ${(score.detectionPrecision * 100).toFixed(2)}% (FP ${score.falsePositives})`,
    `typed precision ${((score.typedPrecision ?? score.detectionPrecision) * 100).toFixed(2)}% (typed FP ${score.typedFalsePositives ?? score.falsePositives})`,
    `classification ${(score.classificationAccuracy * 100).toFixed(2)}% (wrong type ${score.classifiedWrong || 0})`,
    `false negatives ${score.falseNegatives ?? Math.max(0, score.truth - score.found)}`,
    `ground truth ${score.truth > 0 && score.groundTruthReady !== false ? "present" : "MISSING — no accuracy claim permitted"}`,
    `marker accuracy ${(score.markerAccuracy * 100).toFixed(2)}%`,
    `hover accuracy ${((score.hoverAccuracy ?? 0) * 100).toFixed(2)}%`,
    `wall extras ${score.wallFalsePositives || 0}`,
    `unresolved review ${score.unresolvedCount || 0}`,
    claim,
    types,
  ].join("\n");
}
