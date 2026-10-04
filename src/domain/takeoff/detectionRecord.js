export const REVIEW_VISUAL_THRESHOLD = 0.72;
export const ACCEPT_VISUAL_THRESHOLD = 0.9;

const CIRCUIT_TAG_RE = /^(?:LN|LP|PP|RP|H|L|EM)\d{1,2}$|^P\d{2}$/i;

export function pointFromGeometry(geometry) {
  if (!geometry) return null;
  const x = Number(geometry.cx ?? geometry.x);
  const y = Number(geometry.cy ?? geometry.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function boundsFromGeometry(geometry) {
  if (!geometry) return null;
  const w = Number(geometry.w ?? geometry.outline?.w) || 0;
  const h = Number(geometry.h ?? geometry.outline?.h) || 0;
  const r = Number(geometry.r ?? geometry.outline?.r) || 0;
  const body = pointFromGeometry(geometry);
  if (!body) return null;
  return {
    x: body.x - (w || r * 2) / 2,
    y: body.y - (h || r * 2) / 2,
    w: w || r * 2,
    h: h || r * 2,
    kind: geometry.kind || geometry.outline?.kind || "rect",
  };
}

export function isReviewOnlyMark(mark) {
  if (!mark) return false;
  if (mark.layer === "review") return true;
  if (mark.symbol === "unknown" || String(mark.typeCode || "").toUpperCase() === "UNKNOWN") return true;
  return false;
}

export function bidDeviceMarks(marks = []) {
  return (marks || []).filter((mark) => (
    (mark?.type === "count" || mark?.type === "drop")
    && !isReviewOnlyMark(mark)
  ));
}

export function labelLocationFromToken(token) {
  if (!token || !Number.isFinite(Number(token.x)) || !Number.isFinite(Number(token.y))) return null;
  return { x: Number(token.x), y: Number(token.y) };
}

export function nearbyCircuitTag(token, tokens = []) {
  if (!token) return null;
  let best = null;
  let bestDist = 2.2;
  for (const other of tokens || []) {
    if (other === token) continue;
    const text = String(other.text || "").trim();
    if (!CIRCUIT_TAG_RE.test(text)) continue;
    const dist = Math.hypot((Number(other.x) || 0) - (Number(token.x) || 0), (Number(other.y) || 0) - (Number(token.y) || 0));
    if (dist < bestDist) {
      best = { x: Number(other.x) || 0, y: Number(other.y) || 0, text };
      bestDist = dist;
    }
  }
  return best;
}

export function attachDetectionRecord(mark, fields = {}) {
  const body = fields.symbolBodyLocation || pointFromGeometry(fields.geometry) || { x: Number(mark.x) || 0, y: Number(mark.y) || 0 };
  const sources = fields.detectionSources
    || [mark.matchedFrom, mark.outlineSource, fields.geometry?.source].filter(Boolean);
  const uniqueSources = [...new Set(sources)];
  const vectorScore = Number(fields.vectorMatchScore ?? (mark.outlineSource === "vector" ? (mark.geometryScore || 0.9) : 0));
  const legendScore = Number(fields.legendMatchScore ?? (mark.matchedFrom === "legend" || mark.matchedFrom === "legend-geometry" ? 0.85 : 0));
  const visualScore = Number(fields.visualMatchScore ?? (mark.matchedFrom === "plan-repeat" || mark.matchedFrom === "legend-geometry" ? (mark.geometryScore || 0.8) : 0));
  const textScore = Number(fields.textContextScore ?? (fields.labelLocation ? 0.7 : 0));
  const combined = Number.isFinite(Number(fields.combinedConfidence))
    ? Number(fields.combinedConfidence)
    : Math.max(vectorScore, legendScore, visualScore, textScore);
  const textOnly = uniqueSources.length > 0
    && uniqueSources.every((item) => item === "text" || item === "drawing")
    && !uniqueSources.includes("vector")
    && !uniqueSources.includes("raster")
    && mark.outlineSource !== "vector"
    && mark.outlineSource !== "raster";
  const requiresReview = fields.requiresReview != null
    ? Boolean(fields.requiresReview)
    : Boolean(mark.detectionAmbiguous || mark.confidence === "low" || mark.confidence === "medium" || textOnly);
  return {
    ...mark,
    x: body.x,
    y: body.y,
    symbolBodyLocation: body,
    symbolBodyBounds: fields.symbolBodyBounds || boundsFromGeometry(fields.geometry || { ...mark.outline, cx: body.x, cy: body.y, w: mark.outline?.w, h: mark.outline?.h, r: mark.outline?.r, kind: mark.outline?.kind }),
    labelLocation: fields.labelLocation || null,
    circuitTagLocation: fields.circuitTagLocation || null,
    visualMatchScore: visualScore,
    vectorMatchScore: vectorScore,
    legendMatchScore: legendScore,
    textContextScore: textScore,
    combinedConfidence: combined,
    detectionSources: uniqueSources,
    requiresReview,
    reviewReason: fields.reviewReason || mark.reviewReason || (textOnly ? "text-only-body" : requiresReview ? "needs-review" : ""),
  };
}

export function reviewCandidateMark({
  trade,
  sheet,
  geometry,
  label,
  reason,
  color = "#94a3b8",
  sources = [],
  scores = {},
}) {
  const body = pointFromGeometry(geometry) || (label ? { x: label.x, y: label.y } : null);
  if (!body) return null;
  return attachDetectionRecord({
    source: "ai",
    trade,
    type: "count",
    sheet,
    x: body.x,
    y: body.y,
    category: "From drawing",
    symbol: "unknown",
    symbolLabel: "Unknown / review",
    abbr: "?",
    typeCode: "UNKNOWN",
    color,
    matchedFrom: "review",
    outline: geometry?.outline || null,
    outlineSource: geometry?.outline?.source || geometry?.source || (label && !geometry ? "text" : "vector"),
    confidence: "low",
    reviewStatus: "pending",
    layer: "review",
    detectionAmbiguous: true,
  }, {
    geometry,
    symbolBodyLocation: body,
    labelLocation: label || null,
    detectionSources: sources.length ? sources : ["review"],
    visualMatchScore: scores.visual || 0,
    vectorMatchScore: scores.vector || 0,
    legendMatchScore: scores.legend || 0,
    textContextScore: scores.text || 0,
    requiresReview: true,
    reviewReason: reason || "low-confidence",
  });
}
