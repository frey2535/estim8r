import { buildAiMarks } from "./aiTakeoff.js";
import { normalizeTypeMark, taggedEquipmentCode } from "./symbolDetection.js";
import { paletteForTrade } from "./trades.js";

export const ACCURACY_THRESHOLD = 0.99;

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
  const counts = (result.marks || []).filter((mark) => mark.type === "count" || mark.type === "drop");
  const truth = fixture.groundTruth || [];
  const used = new Set();
  const matches = [];
  for (const mark of counts) {
    let best = null;
    let bestDist = Infinity;
    const markType = markTypeKey(mark);
    for (let index = 0; index < truth.length; index += 1) {
      if (used.has(index)) continue;
      const device = truth[index];
      if (device.sheet !== mark.sheet) continue;
      const sameType = markType === typeKey(device.type)
        || (typeKey(device.type) === "GFI/WP" && markType === "GFI")
        || (typeKey(device.type) === "GFI" && mark.symbol === "gfci")
        || (typeKey(device.type) === "OS" && (mark.symbol === "occ" || mark.abbr === "OS"))
        || (typeKey(device.type) === "VF" && mark.symbol === "vf")
        || (typeKey(device.type) === "EF" && mark.symbol === "ef");
      if (!sameType) continue;
      const dist = Math.hypot(mark.x - device.x, mark.y - device.y);
      const geoDist = Math.hypot(mark.x - (device.cx ?? device.x), mark.y - (device.cy ?? device.y));
      const nearest = Math.min(dist, geoDist);
      if (nearest < bestDist) {
        best = { index, device, dist, geoDist };
        bestDist = nearest;
      }
    }
    if (best && bestDist <= 3.1) {
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
      matches.push({
        mark,
        device: best.device,
        onGeometry: (onGeometry || closerToBody || vectorOnBody || tagIsSymbol) && !neighbor && !onTagOnly,
        debug: {
          geoDist: best.geoDist,
          tagDist: best.dist,
          neighbor,
          onTagOnly,
          src: mark.outlineSource,
        },
      });
    }
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
  const falsePositives = counts.length - matches.length;
  const placedOnGeometry = matches.filter((item) => item.onGeometry).length;
  const detectionRecall = truth.length ? matches.length / truth.length : 1;
  const detectionPrecision = counts.length ? matches.length / counts.length : 1;
  const markerAccuracy = matches.length ? placedOnGeometry / matches.length : 1;
  const typeRecalls = Object.fromEntries(Object.entries(byType).map(([key, row]) => [
    key,
    { ...row, recall: row.truth ? row.found / row.truth : 1 },
  ]));
  const worstTypeRecall = Math.min(1, ...Object.values(typeRecalls).map((row) => row.recall));
  return {
    summary: result.summary,
    deviceCount: result.deviceCount,
    truth: truth.length,
    found: matches.length,
    falsePositives,
    counts: counts.length,
    detectionRecall,
    detectionPrecision,
    worstTypeRecall,
    markerAccuracy,
    typeRecalls,
    meetsDetection: worstTypeRecall >= ACCURACY_THRESHOLD && detectionPrecision >= ACCURACY_THRESHOLD,
    meetsMarkers: markerAccuracy >= ACCURACY_THRESHOLD,
    unmatchedTruth: truth.filter((_, index) => !used.has(index)),
    extraMarks: counts.filter((mark) => !matches.some((item) => item.mark === mark)),
    failedMarkers: matches.filter((item) => !item.onGeometry),
  };
}

export function formatAccuracyReport(score) {
  const types = Object.entries(score.typeRecalls)
    .map(([key, row]) => `${key} ${row.found}/${row.truth} (${(row.recall * 100).toFixed(1)}%)`)
    .join(", ");
  return [
    `detection recall ${(score.detectionRecall * 100).toFixed(2)}% (${score.found}/${score.truth})`,
    `worst type ${(score.worstTypeRecall * 100).toFixed(2)}%`,
    `precision ${(score.detectionPrecision * 100).toFixed(2)}% (FP ${score.falsePositives})`,
    `marker accuracy ${(score.markerAccuracy * 100).toFixed(2)}%`,
    types,
  ].join("\n");
}
