import { applyReviewDecision } from "./accuracyReview.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function changeReviewDeviceType(marks, current, symbol) {
  if (!current || !symbol) return marks || [];
  const typeCode = String(symbol.abbr || symbol.type || "").toUpperCase();
  return (marks || []).map((mark) => {
    if (mark.id !== current.id) return mark;
    return {
      ...mark,
      symbol: symbol.id,
      symbolLabel: symbol.label,
      abbr: symbol.abbr,
      typeCode,
      category: symbol.takeoffCategory || symbol.category || mark.category,
      layer: "device",
      reviewStatus: "accepted",
      requiresReview: false,
      reviewReason: "",
      correction: "type",
    };
  });
}

export function moveReviewMark(marks, current, point) {
  if (!current || !point) return marks || [];
  const x = clamp(point.x, 0, 100);
  const y = clamp(point.y, 0, 100);
  return (marks || []).map((mark) => {
    if (mark.id !== current.id) return mark;
    return {
      ...mark,
      x,
      y,
      symbolBodyLocation: { x, y },
      correction: mark.correction || "move",
    };
  });
}

export function resizeReviewBounds(marks, current, bounds = {}) {
  if (!current) return marks || [];
  const w = clamp(bounds.w ?? current.outline?.w ?? 0.7, 0.2, 2.4);
  const h = clamp(bounds.h ?? current.outline?.h ?? 0.7, 0.2, 2.4);
  return (marks || []).map((mark) => {
    if (mark.id !== current.id) return mark;
    const outline = {
      ...(mark.outline || {}),
      kind: mark.outline?.kind || "rect",
      source: mark.outline?.source === "text" ? "vector" : (mark.outline?.source || "vector"),
      w,
      h,
    };
    return {
      ...mark,
      outline,
      outlineSource: outline.source,
      symbolBodyBounds: {
        x: (Number(mark.x) || 0) - w / 2,
        y: (Number(mark.y) || 0) - h / 2,
        w,
        h,
        kind: outline.kind,
      },
      correction: "bounds",
    };
  });
}

export function createManualDeviceMark({
  sheet = 1,
  trade = "electrical",
  symbol,
  x = 50,
  y = 50,
  w = 0.7,
  h = 0.7,
} = {}) {
  const typeCode = String(symbol?.abbr || symbol?.type || "UNKNOWN").toUpperCase();
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "count",
    source: "manual",
    trade,
    sheet,
    x,
    y,
    symbolBodyLocation: { x, y },
    symbolBodyBounds: { x: x - w / 2, y: y - h / 2, w, h, kind: "rect" },
    outline: { kind: "rect", source: "vector", w, h },
    outlineSource: "vector",
    symbol: symbol?.id || "unknown",
    symbolLabel: symbol?.label || "Manual device",
    abbr: symbol?.abbr || "?",
    typeCode,
    category: symbol?.takeoffCategory || symbol?.category || "From drawing",
    layer: "device",
    reviewStatus: "accepted",
    requiresReview: false,
    correction: "manual-add",
    detectionSources: ["manual"],
  };
}

export function projectPrototypesFromCorrections(marks = []) {
  const out = [];
  for (const mark of marks || []) {
    if (mark.reviewStatus === "rejected") continue;
    if (!mark.correction && mark.source !== "manual") continue;
    if (mark.outlineSource === "text") continue;
    const w = Number(mark.outline?.w) || 0;
    const h = Number(mark.outline?.h) || 0;
    const long = Math.max(w, h);
    if (long < 0.35 || long > 2.2) continue;
    const code = String(mark.typeCode || mark.abbr || "").toUpperCase();
    if (!code || code === "UNKNOWN") continue;
    out.push({
      code,
      prototype: {
        cx: Number(mark.x) || 0,
        cy: Number(mark.y) || 0,
        w,
        h,
        kind: mark.outline?.kind || "rect",
        source: "vector",
        outline: mark.outline,
      },
    });
  }
  return out;
}

export function rejectReviewMark(marks, current) {
  return applyReviewDecision(marks, current, "rejected");
}
