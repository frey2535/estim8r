const REFERENCE_RE = /^(?:R\d{1,3}(?:\.\d+)?|\d{1,3}\.\d+|[A-Z]{1,3}\d{1,2}\.\d{2}[A-Z]?|\d{1,3}\/[A-Z][A-Z0-9.\-]*)\b/i;
const CAN_RE = /downlight|can\s*light|recessed\s*can|\bdl\b|\bcan-?\d|\d\s*["”]\s*can\b|canlight|(?:^|[\s,;])can(?:[\s,]|$)/i;
const BARE_TYPE_RE = /^(?:\d{1,2}[a-z]?|[a-z])$/i;
const LEGEND_HEADER_RE = /^(?:electrical\s+|lighting\s+|power\s+|device\s+|symbol\s+)?legend$|^abbreviations?$/i;
const NOTE_WORD_RE = /^(see|schedule|sched|title|qty|quantity|refer)$/i;
const NON_PLAN_KIND_RE = /legend|schedule|^spec$|oneline|riser|detail/i;
const CIRCUIT_TAG_RE = /^(?:LN|LP|PP|RP|H|P|L|EM)\d{1,2}$/i;
const TAGGED_EQUIP_RE = /^(VF|EF)(?:[- ]?\d+)?$/i;

export function normalizeTypeMark(text) {
  return String(text || "")
    .trim()
    .replace(/^['"‘’“”`]+|['"‘’“”`]+$/g, "")
    .replace(/^type\s+/i, "")
    .replace(/[.,;:()]+$/g, "")
    .replace(/^[()]+/, "");
}

export function taggedEquipmentCode(text) {
  const match = normalizeTypeMark(text).match(TAGGED_EQUIP_RE);
  return match ? match[1].toUpperCase() : "";
}

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
  if (y >= 64 && x <= 28) return false;
  return x >= 7 && x <= 76 && y >= 10 && y <= 88;
}

export function isZoneNoteContext(token, tokens = []) {
  if (isQuotedTypeMark(token?.text)) return false;
  if (!isBareTypeCode(token?.text) && !/^\d{1,2}$/.test(normalizeTypeMark(token?.text))) return false;
  return (tokens || []).some((other) => {
    if (other === token) return false;
    const dx = Math.abs((Number(other.x) || 0) - (Number(token?.x) || 0));
    const dy = Math.abs((Number(other.y) || 0) - (Number(token?.y) || 0));
    if (dx > 10 || dy > 0.85) return false;
    return /^(all|work|this|zone|designated|alternate|base|bid)$/i.test(normalizeTypeMark(other.text));
  });
}

export function isNotesClusterToken(token, tokens = []) {
  return (tokens || []).some((other) => {
    if (other === token) return false;
    if (!/^(?:notes?|general)$/i.test(normalizeTypeMark(other.text))) return false;
    const dx = (Number(token?.x) || 0) - (Number(other.x) || 0);
    const dy = (Number(token?.y) || 0) - (Number(other.y) || 0);
    return dx >= -4 && dx <= 24 && dy >= -2 && dy <= 36;
  });
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
  return BARE_TYPE_RE.test(normalizeTypeMark(text));
}

export function isQuotedTypeMark(text) {
  return /^['"‘’“”`].+['"‘’“”`]$/.test(String(text || "").trim());
}

export function isUnquotedCircuitBesideQuotedType(token, tokens = []) {
  if (isQuotedTypeMark(token?.text)) return false;
  const code = normalizeTypeMark(token?.text);
  if (!/^\d{1,2}[A-Z]?$/i.test(code)) return false;
  return (tokens || []).some((other) => {
    if (!isQuotedTypeMark(other.text)) return false;
    if (normalizeTypeMark(other.text).toUpperCase() !== code.toUpperCase()) return false;
    const dist = Math.hypot((Number(other.x) || 0) - (Number(token?.x) || 0), (Number(other.y) || 0) - (Number(token?.y) || 0));
    return dist > 0.35 && dist < 8;
  });
}

export function isCircuitCalloutToken(token, tokens = []) {
  const text = normalizeTypeMark(token?.text);
  if (!text) return false;
  if (isQuotedTypeMark(token?.text)) return false;
  if (CIRCUIT_TAG_RE.test(text) && !TAGGED_EQUIP_RE.test(text)) return true;
  if (!/^\d{1,2}[A-Z]?$/i.test(text)) return false;
  return (tokens || []).some((other) => {
    if (other === token) return false;
    const dx = Math.abs((Number(other.x) || 0) - (Number(token?.x) || 0));
    const dy = Math.abs((Number(other.y) || 0) - (Number(token?.y) || 0));
    if (dx > 2.4 || dy > 1.2) return false;
    const nearby = normalizeTypeMark(other.text);
    return CIRCUIT_TAG_RE.test(nearby) || nearby === "-";
  });
}

export function isSheetGridTick(token) {
  const text = normalizeTypeMark(token?.text);
  if (!/^(?:[A-Z]|\d{1,2})$/i.test(text)) return false;
  const x = Number(token?.x) || 0;
  const y = Number(token?.y) || 0;
  return x <= 6.6 || y <= 9.2 || (x >= 64.2 && x <= 68.2 && y <= 56);
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
  const marked = { ...token, text: normalizeTypeMark(token.text) };
  if (!marked.text) return false;
  if (isReferenceCallout(marked.text) || isReferenceCallout(token.text)) return false;
  if (hasReferenceNeighbor(token, tokens) || hasReferenceNeighbor(marked, tokens)) return false;
  if (isTitleBlockLetter(token) || isTitleBlockLetter(marked)) return false;
  if (isLegendClusterToken(token, tokens) || isLegendClusterToken(marked, tokens)) return false;
  if (isScheduleNoteContext(token, tokens) || isScheduleNoteContext(marked, tokens)) return false;
  if (isCircuitCalloutToken(token, tokens)) return false;
  if (isSheetGridTick(token)) return false;
  if (isNotesClusterToken(token, tokens)) return false;
  if (isZoneNoteContext(token, tokens)) return false;
  if (isUnquotedCircuitBesideQuotedType(token, tokens)) return false;
  if (/^EM$/i.test(marked.text) && (tokens || []).some((other) => {
    const dx = Math.abs((Number(other.x) || 0) - (Number(token?.x) || 0));
    const dy = Math.abs((Number(other.y) || 0) - (Number(token?.y) || 0));
    return dx < 4 && dy < 2.2 && /^(?:E\/M|1E|2E|3E|EMERGENCY)$/i.test(normalizeTypeMark(other.text));
  })) return false;
  if (isBareTypeCode(marked.text) && !isPlanInterior(token)) return false;
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
