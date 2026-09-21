const REFERENCE_RE = /^(?:R\d{1,3}(?:\.\d+)?|\d{1,3}\.\d+|[A-Z]{1,3}\d{1,2}\.\d{2}[A-Z]?|\d{1,3}\/[A-Z][A-Z0-9.\-]*)\b/i;
const CAN_RE = /downlight|can\s*light|recessed\s*can|\bdl\b|\bcan-?\d|\d\s*["”]\s*can\b|canlight|(?:^|[\s,;])can(?:[\s,]|$)/i;
const BARE_TYPE_RE = /^(?:\d{1,2}[a-z]?|[a-z])$/i;

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
  return (tokens || []).some((other) => {
    if (other === token) return false;
    const dx = (Number(other.x) || 0) - (Number(token.x) || 0);
    const dy = (Number(other.y) || 0) - (Number(token.y) || 0);
    if (Math.hypot(dx, dy) > 2.5) return false;
    const text = String(other.text || "").trim();
    return /^R$/i.test(text) || /^R\d+/i.test(text) || isReferenceCallout(text);
  });
}

export function isBareTypeCode(text) {
  const compact = String(text || "").trim().replace(/^type\s+/i, "");
  return BARE_TYPE_RE.test(compact);
}

export function shouldAcceptPlanToken(token, tokens = []) {
  if (!token) return false;
  if (isReferenceCallout(token.text)) return false;
  if (hasReferenceNeighbor(token, tokens)) return false;
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
