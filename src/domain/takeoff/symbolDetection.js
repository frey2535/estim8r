const REFERENCE_RE = /^(?:R\d{1,3}(?:\.\d+)?|\d{1,3}\.\d+|[A-Z]{1,3}\d{1,2}\.\d{2}[A-Z]?|\d{1,3}\/[A-Z][A-Z0-9.\-]*)\b/i;
const CAN_RE = /downlight|can\s*light|recessed\s*can|\bdl\b|\bcan-?\d|\d\s*["”]\s*can\b|canlight|(?:^|[\s,;])can(?:[\s,]|$)/i;
const BARE_TYPE_RE = /^(?:\d{1,2}[a-z]?|[a-z])$/i;
const LEGEND_HEADER_RE = /^(?:electrical\s+|lighting\s+|power\s+|device\s+|symbol\s+)?legend$|^abbreviations?$/i;
const NOTE_WORD_RE = /^(see|schedule|sched|title|qty|quantity|refer)$/i;
const NON_PLAN_KIND_RE = /legend|schedule|^spec$/i;

export function isReferenceCallout(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (/^REV(?:ISION)?\b/i.test(raw)) return true;
  if (REFERENCE_RE.test(raw)) return true;
  return false;
}

export function isCanDeviceText(...parts) {
  return CAN_RE.test(parts.filter(Boolean).join(" "));
}

export function isPlanInterior(token) {
  const x = Number(token?.x);
  const y = Number(token?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= 7 && x <= 76 && y >= 10 && y <= 88;
}

export function hasReferenceNeighbor(token, tokens = []) {
  const self = String(token?.text || "").trim();
  return (tokens || []).some((other) => {
    if (other === token) return false;
    const dx = (Number(other.x) || 0) - (Number(token.x) || 0);
    const dy = (Number(other.y) || 0) - (Number(token.y) || 0);
    const dist = Math.hypot(dx, dy);
    if (dist < 0.15 || dist > 2.5) return false;
    const text = String(other.text || "").trim();
    if (/^R$/i.test(text)) return /^\d/.test(self) || isReferenceCallout(self);
    return /^R\d+/i.test(text) || isReferenceCallout(text);
  });
}

export function isBareTypeCode(text) {
  const compact = String(text || "").trim().replace(/^type\s+/i, "");
  return BARE_TYPE_RE.test(compact);
}

export function isTitleBlockLetter(token) {
  const x = Number(token?.x) || 0;
  const y = Number(token?.y) || 0;
  const text = String(token?.text || "").trim();
  if (text.length > 6) return false;
  return (x >= 72 && y >= 82)
    || (x >= 86 && y >= 55)
    || (x >= 86 && y <= 16)
    || y >= 95
    || x >= 93;
}

export function isLegendHeaderText(text) {
  return LEGEND_HEADER_RE.test(String(text || "").trim());
}

export function isLegendClusterToken(token, tokens = []) {
  return (tokens || []).some((other) => {
    if (other === token) return false;
    if (!isLegendHeaderText(other.text)) return false;
    const dx = (Number(token?.x) || 0) - (Number(other.x) || 0);
    const dy = (Number(token?.y) || 0) - (Number(other.y) || 0);
    return dx >= -10 && dx <= 46 && dy >= -1.5 && dy <= 42;
  });
}

export function isScheduleNoteContext(token, tokens = []) {
  if (!isBareTypeCode(token?.text)) return false;
  return (tokens || []).some((other) => {
    if (other === token) return false;
    const dx = Math.abs((Number(other.x) || 0) - (Number(token?.x) || 0));
    const dy = Math.abs((Number(other.y) || 0) - (Number(token?.y) || 0));
    if (dx > 14 || dy > 1.8) return false;
    return NOTE_WORD_RE.test(String(other.text || "").trim());
  });
}

export function isNonPlanSheetKind(kind) {
  return NON_PLAN_KIND_RE.test(String(kind || ""));
}

export function isPersistedPlanDetection(mark, pageKinds = {}) {
  if (!mark) return false;
  if (mark.type !== "count" && mark.type !== "drop") return false;
  if (mark.source === "legend") return false;
  if (isNonPlanSheetKind(pageKinds[mark.sheet])) return false;
  return true;
}

export function persistedPlanDeviceCount(marks, pageKinds = {}) {
  return (marks || []).filter((mark) => isPersistedPlanDetection(mark, pageKinds)).length;
}

export function shouldAcceptPlanToken(token, tokens = []) {
  if (!token) return false;
  if (isReferenceCallout(token.text)) return false;
  if (hasReferenceNeighbor(token, tokens)) return false;
  if (isTitleBlockLetter(token)) return false;
  if (isLegendClusterToken(token, tokens)) return false;
  if (isScheduleNoteContext(token, tokens)) return false;
  if (isBareTypeCode(token.text) && !isPlanInterior(token)) return false;
  return true;
}

export function resolveCanSymbol(symbols) {
  const list = symbols || [];
  return list.find((item) => item.id === "downlight")
    || list.find((item) => item.id === "can-6")
    || list.find((item) => item.id === "can-4")
    || list.find((item) => /can|downlight/i.test(`${item.id} ${item.label} ${item.abbr}`))
    || null;
}

export function snapFillToDevice(token, kind = "rect") {
  const x = Number(token?.x) || 0;
  const y = Number(token?.y) || 0;
  const dx = 50 - x;
  const dy = 48 - y;
  const len = Math.hypot(dx, dy) || 1;
  const step = kind === "circle" ? 0.8 : 0.95;
  return {
    x: x + (dx / len) * step,
    y: y + (dy / len) * step,
  };
}

export function fixtureSizeFromWholeToken(text) {
  const compact = String(text || "")
    .toLowerCase()
    .replace(/[′’'`"]/g, "")
    .replace(/[×✕✖]/g, "x")
    .replace(/[^a-z0-9x]+/g, "");
  const whole = compact.match(/^(\d{1,2})x(\d{1,2})$/);
  if (!whole) return "";
  return `${Number(whole[1])}x${Number(whole[2])}`;
}
