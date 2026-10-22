import {
  isNonPlanSheetKind,
  isPlotStampToken,
  normalizeTypeMark,
  shouldAcceptPlanToken,
} from "./symbolDetection.js";

export const LABEL_AUTHORITY = {
  NONE: "none",
  SYNTHETIC: "synthetic",
  DERIVED_TOKENS: "derived-tokens",
  INDEPENDENT: "independent",
  INCOMPLETE: "incomplete",
};

export const MIN_INDEPENDENT_TRUTH = 8;

/**
 * @param {any} truth
 */
export function inspectGroundTruth(truth = []) {
  const rows = Array.isArray(truth) ? truth : [];
  const incomplete = [];
  let withBody = 0;
  for (const [index, device] of rows.entries()) {
    const hasClass = Boolean(device?.type);
    const hasSheet = Number.isFinite(Number(device?.sheet));
    const hasPosition = (Number.isFinite(Number(device?.x)) && Number.isFinite(Number(device?.y)))
      || (Number.isFinite(Number(device?.cx)) && Number.isFinite(Number(device?.cy)));
    const hasBody = Number.isFinite(Number(device?.w)) && Number.isFinite(Number(device?.h))
      && Number.isFinite(Number(device?.cx ?? device?.x))
      && Number.isFinite(Number(device?.cy ?? device?.y));
    if (hasBody) withBody += 1;
    if (!hasClass || !hasSheet || !hasPosition) {
      incomplete.push({ index, type: device?.type, sheet: device?.sheet });
    }
  }
  return {
    count: rows.length,
    incomplete,
    withBody,
    ready: rows.length > 0 && incomplete.length === 0,
    quantityReady: rows.length > 0,
  };
}

/**
 * @param {any} fixture
 */
export function inferLabelAuthority(fixture = {}) {
  if (fixture.labelAuthority) return fixture.labelAuthority;
  if (fixture.source?.labelAuthority) return fixture.source.labelAuthority;
  const truth = fixture.groundTruth || [];
  if (!truth.length) return LABEL_AUTHORITY.NONE;
  const inspect = inspectGroundTruth(truth);
  if (!inspect.ready) return LABEL_AUTHORITY.INCOMPLETE;
  if (truth.length < MIN_INDEPENDENT_TRUTH) return LABEL_AUTHORITY.SYNTHETIC;
  if (truth.every((device) => (
    device.source === "plan-token"
    || device.source === "plan-glyph"
    || device.source === "printed-2-can"
  ))) return LABEL_AUTHORITY.DERIVED_TOKENS;
  if (inspect.withBody === truth.length) return LABEL_AUTHORITY.INDEPENDENT;
  return LABEL_AUTHORITY.INCOMPLETE;
}

/**
 * @param {any} authority
 * @param {any} inspect
 */
export function canClaimThreshold(authority, inspect) {
  return authority === LABEL_AUTHORITY.INDEPENDENT
    && inspect.ready
    && inspect.count >= MIN_INDEPENDENT_TRUTH
    && inspect.withBody === inspect.count;
}

/**
 * @param {any} pages
 * @param {any} allowed
 * @param {any} "GFI"
 * @param {any} "GFI/WP"
 * @param {any} "WP"]
 */
export function pottsvilleTokenTruth(pages = [], allowed = new Set(["OS", "GFI", "GFI/WP", "WP"])) {
  const devices = [];
  for (const page of pages || []) {
    if (isNonPlanSheetKind(page.kind) || page.kind === "legend") continue;
    const tokens = page.tokens || [];
    for (const token of tokens) {
      if (!shouldAcceptPlanToken(token, tokens)) continue;
      const type = normalizeTypeMark(token.text).toUpperCase();
      if (!allowed.has(type)) continue;
      if (isPlotStampToken(token, tokens)) continue;
      devices.push({
        sheet: page.page,
        type,
        x: token.x,
        y: token.y,
        cx: token.x,
        cy: token.y,
        w: 0.9,
        h: 0.9,
        kind: type === "1" || type === "3" ? "rect" : "circle",
        tagOnSymbol: true,
        source: "plan-token",
      });
    }
  }
  return devices;
}
