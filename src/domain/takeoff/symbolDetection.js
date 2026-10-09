const REFERENCE_RE = /^(?:R\d{1,3}(?:\.\d+)?|\d{1,3}\.\d+|[A-Z]{1,3}\d{1,2}\.\d{2}[A-Z]?|\d{1,3}\/[A-Z][A-Z0-9.\-]*)\b/i;
const CAN_RE = /downlight|can\s*light|recessed\s*can|\bdl\b|\bcan-?\d|\d\s*["”]\s*can\b|canlight|(?:^|[\s,;])can(?:[\s,]|$)/i;
const BARE_TYPE_RE = /^(?:\d{1,2}[a-z]?|[a-z])$/i;
const LEGEND_HEADER_RE = /^(?:electrical\s+|lighting\s+|power\s+|device\s+|symbol\s+)?legend$|^abbreviations?$/i;
const NOTE_WORD_RE = /^(see|schedule|sched|title|qty|quantity|refer)$/i;
const NON_PLAN_KIND_RE = /legend|schedule|^spec$|oneline|riser|detail|cover|rendering|photo|^title$|index|comcheck|perspective|^other$/i;
const CIRCUIT_TAG_RE = /^(?:LN|LP|PP|RP|H|L|EM)\d{1,2}$|^P\d{2}$/i;
const LIGHTING_FIXTURE_CODE_RE = /^(?:[FLX]\d{1,2}[A-Z]?|L\d{1,2}[A-Z]?|OS|[1-4]E?)$/i;
const TAGGED_EQUIP_RE = /^(VF|EF)(?:[- ]?\d+)?$/i;
const POWER_DEVICE_RE = /^(?:gfi(?:\/wp)?|wp|os|vs|sp|spr|r|p[1-9]|db|doorbell|facp|ef|vf|ts|sw|cam)$/i;

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

export function isPlotStampToken(token, tokens = []) {
  const x = Number(token?.x);
  const y = Number(token?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || y < 60) return false;
  return (tokens || []).some((other) => {
    if (other === token) return false;
    const dy = Math.abs((Number(other.y) || 0) - y);
    const dx = Math.abs((Number(other.x) || 0) - x);
    if (dx > 16 || dy > 15) return false;
    if ((Number(other.y) || 0) < 76) return false;
    const text = String(other.text || "");
    return /autodesk|docs:\/\//i.test(text) || /^\d{1,2}:\d{2}:\d{2}$/.test(text);
  });
}

export function isPlanInterior(token) {
  const x = Number(token?.x);
  const y = Number(token?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= 7 && x <= 76 && y >= 10 && y <= 88;
}

export function isNotesOrTitleBand(token) {
  const x = Number(token?.x);
  if (!Number.isFinite(x)) return false;
  return x >= 78;
}

export function isLightingFixtureCode(text) {
  return LIGHTING_FIXTURE_CODE_RE.test(normalizeTypeMark(text));
}

export function isAbbreviationJunkType(value) {
  return /^(AC|FFE|ELEC|EL|MECH|ARCH|GEN|PNL)$/i.test(normalizeTypeMark(value));
}

export function isZoneNoteContext(token, tokens = []) {
  if (isQuotedTypeMark(token?.text)) return false;
  if (!isBareTypeCode(token?.text) && !/^\d{1,2}$/.test(normalizeTypeMark(token?.text))) return false;
  return (tokens || []).some((other) => {
    if (other === token) return false;
    const dx = Math.abs((Number(other.x) || 0) - (Number(token?.x) || 0));
    const dy = Math.abs((Number(other.y) || 0) - (Number(token?.y) || 0));
    if (dx > 10 || dy > 0.85) return false;
    return /^(all|work|this|zone|designated|alternate|base|bid|off|office|room|rm|toilet|stor|storage|mech|corridor|corr)$/i.test(normalizeTypeMark(other.text));
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
    if (/^E\d{2,3}[A-Z]?$/i.test(normalizeTypeMark(text)) && /^\d{1,2}$/.test(normalizeTypeMark(self))) return true;
    return /^R\d+/i.test(text) || isReferenceCallout(text);
  });
}

export function isBareTypeCode(text) {
  return BARE_TYPE_RE.test(normalizeTypeMark(text));
}

export function isPowerDeviceCode(text) {
  return POWER_DEVICE_RE.test(normalizeTypeMark(text));
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

export function isFixtureLegendStripToken(token, tokens = []) {
  if (isQuotedTypeMark(token?.text)) return false;
  const code = normalizeTypeMark(token?.text);
  if (!/^[1-9]$/.test(code)) return false;
  const y = Number(token?.y) || 0;
  const row = (tokens || []).filter((other) => (
    !isQuotedTypeMark(other.text)
    && /^[1-9]$/.test(normalizeTypeMark(other.text))
    && Math.abs((Number(other.y) || 0) - y) <= 0.45
  ));
  if (row.length < 5) return false;
  const codes = new Set(row.map((item) => normalizeTypeMark(item.text)));
  if (codes.size < 5) return false;
  const xs = row.map((item) => Number(item.x) || 0);
  return Math.max(...xs) - Math.min(...xs) >= 8;
}

export function hasNearbyFixtureBody(token, paths = []) {
  const x = Number(token?.x) || 0;
  const y = Number(token?.y) || 0;
  return (paths || []).some((path) => {
    const long = Math.max(Number(path?.w) || 0, Number(path?.h) || 0);
    const short = Math.min(Number(path?.w) || 0, Number(path?.h) || 0);
    const aspect = long / (short || 1e-9);
    if (long < 0.45 || long > 1.05 || aspect > 1.55) return false;
    return Math.hypot((Number(path.cx) || 0) - x, (Number(path.cy) || 0) - y) <= 0.55;
  });
}

function nearbyCompactBody(token, paths = []) {
  const x = Number(token?.x) || 0;
  const y = Number(token?.y) || 0;
  let best = null;
  let bestDist = 1.2;
  for (const path of paths || []) {
    const long = Math.max(Number(path?.w) || 0, Number(path?.h) || 0, (Number(path?.r) || 0) * 2);
    const short = Math.min(Number(path?.w) || long, Number(path?.h) || long, (Number(path?.r) || 0) * 2 || long);
    if (long < 0.16 || long > 1.65 || short < 0.12) continue;
    if (long / (short || 1e-9) > 2.8) continue;
    const dist = Math.hypot((Number(path.cx) || 0) - x, (Number(path.cy) || 0) - y);
    if (dist < bestDist) {
      best = path;
      bestDist = dist;
    }
  }
  return best;
}

function tokenInsideBody(token, path) {
  if (!path) return false;
  const dx = Math.abs((Number(token?.x) || 0) - (Number(path.cx) || 0));
  const dy = Math.abs((Number(token?.y) || 0) - (Number(path.cy) || 0));
  const hw = Math.max(Number(path.w) || 0, (Number(path.r) || 0) * 2) / 2;
  const hh = Math.max(Number(path.h) || 0, (Number(path.r) || 0) * 2) / 2;
  return dx <= Math.max(0.08, hw * 0.88) && dy <= Math.max(0.08, hh * 0.88);
}

function looksLikeNearbyKeynoteBody(path) {
  if (!path) return false;
  const w = Number(path.w) || 0;
  const h = Number(path.h) || 0;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const area = w * h;
  const aspect = long / (short || 1e-9);
  return area >= 0.18 && area <= 0.42 && long >= 0.40 && long <= 0.78 && short >= 0.32 && short <= 0.62 && aspect <= 1.85;
}

export function isOutsideSymbolNumber(token, tokens = [], paths = []) {
  const text = normalizeTypeMark(token?.text);
  if (!text || isQuotedTypeMark(token?.text)) return false;
  if (!/^\d{1,3}[A-Z]?$/i.test(text)) return false;
  if (isPowerDeviceCode(text) || isLightingFixtureCode(text)) return false;
  const body = nearbyCompactBody(token, paths);
  if (!body) return false;
  if (looksLikeNearbyKeynoteBody(body)) return true;
  const long = Math.max(Number(body.w) || 0, Number(body.h) || 0, (Number(body.r) || 0) * 2);
  if (tokenInsideBody(token, body)) return false;
  if (long <= 0.42) return true;
  return /^\d{1,2}$/.test(text) && long <= 0.78;
}

export function isCircuitCalloutToken(token, tokens = []) {
  const text = normalizeTypeMark(token?.text);
  if (!text) return false;
  if (isQuotedTypeMark(token?.text)) return false;
  if (/^L\d{1,2}[A-Z]?$/i.test(text)) {
    const paired = (tokens || []).some((other) => {
      if (other === token) return false;
      const dx = Math.abs((Number(other.x) || 0) - (Number(token?.x) || 0));
      const dy = Math.abs((Number(other.y) || 0) - (Number(token?.y) || 0));
      if (dx > 1.6 || dy > 0.7) return false;
      const nearby = normalizeTypeMark(other.text);
      return nearby === "-" || /^\d{2}$/.test(nearby);
    });
    if (!paired) return false;
  }
  if (CIRCUIT_TAG_RE.test(text) && !TAGGED_EQUIP_RE.test(text)) return true;
  if (!/^\d{1,2}[A-Z]?$/i.test(text)) return false;
  return (tokens || []).some((other) => {
    if (other === token) return false;
    const dx = Math.abs((Number(other.x) || 0) - (Number(token?.x) || 0));
    const dy = Math.abs((Number(other.y) || 0) - (Number(token?.y) || 0));
    if (dx > 2.4 || dy > 1.2) return false;
    const nearby = normalizeTypeMark(other.text);
    return (CIRCUIT_TAG_RE.test(nearby) && !isLightingFixtureCode(nearby)) || nearby === "-";
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

export function isTypContextToken(token, tokens = []) {
  const self = normalizeTypeMark(token?.text);
  if (isPowerDeviceCode(self)) return false;
  if (/^typ\.?$/i.test(self)) return true;
  return (tokens || []).some((other) => {
    if (other === token) return false;
    if (!/^typ\.?$/i.test(normalizeTypeMark(other.text))) return false;
    const dist = Math.hypot((Number(other.x) || 0) - (Number(token?.x) || 0), (Number(other.y) || 0) - (Number(token?.y) || 0));
    if (dist > 3.2) return false;
    return isBareTypeCode(token?.text) || /^\d{1,2}$/.test(self);
  });
}

export function isDigitCodeNoteToken(token, tokens = []) {
  const self = normalizeTypeMark(token?.text);
  if (/^(digit|code|keynote|hex|keycode)$/i.test(self)) return true;
  if (isPowerDeviceCode(self)) return false;
  if (!/^\d{1,2}$/.test(self) && !isBareTypeCode(self)) return false;
  return (tokens || []).some((other) => {
    if (other === token) return false;
    const nearby = normalizeTypeMark(other.text);
    if (!/^(digit|code|keynote|hex|keycode)$/i.test(nearby)) return false;
    return Math.hypot((Number(other.x) || 0) - (Number(token?.x) || 0), (Number(other.y) || 0) - (Number(token?.y) || 0)) <= 2.8;
  });
}

export function isKeyNoteNumberToken(token, tokens = []) {
  const text = normalizeTypeMark(token?.text);
  if (!/^\d{1,2}$/.test(text)) return false;
  const x = Number(token?.x) || 0;
  const y = Number(token?.y) || 0;
  const digits = (tokens || []).filter((other) => {
    if (!/^\d{1,2}$/.test(normalizeTypeMark(other.text))) return false;
    const dx = Math.abs((Number(other.x) || 0) - x);
    const dy = Math.abs((Number(other.y) || 0) - y);
    return dx <= 16 && dy <= 10;
  });
  if (digits.length < 8) return false;
  const xs = digits.map((item) => Number(item.x) || 0);
  const ys = digits.map((item) => Number(item.y) || 0);
  const xSpan = Math.max(...xs) - Math.min(...xs);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  return (xSpan < 9 && ySpan > 2.4) || (ySpan < 4.2 && xSpan > 5);
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
  if (mark.layer === "review" || mark.symbol === "unknown" || String(mark.typeCode || "").toUpperCase() === "UNKNOWN") return false;
  if (isNonPlanSheetKind(pageKinds[mark.sheet])) return false;
  return true;
}

export function persistedPlanDeviceCount(marks, pageKinds = {}) {
  return (marks || []).filter((mark) => isPersistedPlanDetection(mark, pageKinds)).length;
}

export function shouldAcceptPlanToken(token, tokens = [], options = {}) {
  if (!token) return false;
  const marked = { ...token, text: normalizeTypeMark(token.text) };
  if (!marked.text) return false;
  if (isReferenceCallout(marked.text) || isReferenceCallout(token.text)) return false;
  if (hasReferenceNeighbor(token, tokens) || hasReferenceNeighbor(marked, tokens)) return false;
  if (isTitleBlockLetter(token) || isTitleBlockLetter(marked)) return false;
  if (isPlotStampToken(token, tokens) || isPlotStampToken(marked, tokens)) return false;
  if (isLegendClusterToken(token, tokens) || isLegendClusterToken(marked, tokens)) return false;
  if (isFixtureLegendStripToken(token, tokens) || isFixtureLegendStripToken(marked, tokens)) return false;
  if (isScheduleNoteContext(token, tokens) || isScheduleNoteContext(marked, tokens)) return false;
  if (!options.sitePlan && (isNotesOrTitleBand(token) || isNotesOrTitleBand(marked))) return false;
  if (isCircuitCalloutToken(token, tokens)) {
    const lightingType = options.planType === "lighting" && isLightingFixtureCode(marked.text);
    if (!(lightingType && hasNearbyFixtureBody(token, options.paths))) return false;
  }
  if (
    options.planType === "lighting"
    && /^\d{1,2}$/.test(marked.text)
    && (tokens || []).some((other) => {
      if (other === token) return false;
      const dx = Math.abs((Number(other.x) || 0) - (Number(token?.x) || 0));
      const dy = Math.abs((Number(other.y) || 0) - (Number(token?.y) || 0));
      if (dx > 2.2 || dy > 2.2) return false;
      return /^(?:P|LP|PP|RP)\d{1,2}(?:-\d+)?$/i.test(normalizeTypeMark(other.text));
    })
    && !hasNearbyFixtureBody(token, options.paths)
  ) {
    return false;
  }
  if (isSheetGridTick(token)) return false;
  if (isNotesClusterToken(token, tokens)) return false;
  if (isZoneNoteContext(token, tokens)) return false;
  if (isTypContextToken(token, tokens) || isTypContextToken(marked, tokens)) return false;
  if (isDigitCodeNoteToken(token, tokens) || isDigitCodeNoteToken(marked, tokens)) return false;
  if (isKeyNoteNumberToken(token, tokens) || isKeyNoteNumberToken(marked, tokens)) return false;
  if (isUnquotedCircuitBesideQuotedType(token, tokens)) return false;
  if (isOutsideSymbolNumber(token, tokens, options.paths || [])) return false;
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
  return {
    x: Number(token?.x) || 0,
    y: Number(token?.y) || 0,
    kind,
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
