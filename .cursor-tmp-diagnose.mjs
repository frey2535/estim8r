import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks } from "./src/domain/takeoff/aiTakeoff.js";
import { bidDeviceMarks } from "./src/domain/takeoff/detectionRecord.js";
import { deviceOutline, isUsablePaintOutline, maxFillExtent, maxExtractExtent, outlineExtent } from "./src/domain/takeoff/deviceStyles.js";
import { scoreTakeoffAccuracy, markTypeKey } from "./src/domain/takeoff/accuracyHarness.js";
import { normalizeTypeMark, shouldAcceptPlanToken } from "./src/domain/takeoff/symbolDetection.js";
import { paletteForTrade } from "./src/domain/takeoff/trades.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, "src/domain/takeoff/fixtures/pottsville-electrical.json"), "utf8"));
const electrical = paletteForTrade("electrical");
const result = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: fixture.drawingSymbols || [],
  pages: fixture.pages || [],
  maxHomeruns: 8,
});
const marks = bidDeviceMarks(result.marks);

function whyNullOutline(mark) {
  const source = String(mark?.outline?.source || mark?.outlineSource || "").toLowerCase();
  const trustedAiSource = source === "vector" || source === "raster" || source === "mixed";
  const origin = {
    x: Number(mark?.symbolBodyLocation?.x ?? mark?.x) || 0,
    y: Number(mark?.symbolBodyLocation?.y ?? mark?.y) || 0,
  };
  const maxExtent = maxFillExtent(mark);
  const usable = mark?.outline && isUsablePaintOutline(mark.outline, origin, maxExtent);
  if (mark?.source === "ai") {
    if (!trustedAiSource || !mark?.outline) return `ai: trusted=${trustedAiSource} hasOutline=${Boolean(mark?.outline)} source=${source}`;
    if (usable) return "ai: would paint (usable)";
    const extractOk = mark?.outline && isUsablePaintOutline(mark.outline, origin, maxExtractExtent(mark));
    const extent = mark?.outline ? outlineExtent(mark.outline) : 0;
    return `ai: not usable at paint cap (usable=${usable} extractOk=${extractOk} extent=${extent?.toFixed?.(3)} maxFill=${maxExtent}) source=${source}`;
  }
  if (usable) return "non-ai: usable outline";
  return "non-ai: falls through to generic (deviceOutline may still return generic)";
}

console.log("=== E110 sheet 50: bid marks with deviceOutline === null ===");
const e110Marks = marks.filter((m) => m.sheet === 50);
for (const mark of e110Marks) {
  const outline = deviceOutline(mark);
  if (outline !== null) continue;
  console.log(JSON.stringify({
    typeCode: mark.typeCode,
    outlineSource: mark.outlineSource,
    outline: mark.outline,
    symbol: mark.symbol,
    x: mark.x,
    y: mark.y,
    source: mark.source,
    why: whyNullOutline(mark),
  }));
}
console.log(`total E110 bid=${e110Marks.length} nullOutline=${e110Marks.filter((m) => deviceOutline(m) === null).length}`);

console.log("\n=== E210 sheet 52 type 3: marks vs accepted plan tokens ===");
const e210 = fixture.pages.find((p) => p.page === 52);
const lightingOpts = { planType: "lighting", paths: e210?.paths || [] };
const acceptedType3 = (e210?.tokens || []).filter((token) => {
  const code = normalizeTypeMark(token.text).toUpperCase();
  return code === "3" && shouldAcceptPlanToken(token, e210.tokens, lightingOpts);
});
const type3Marks = marks.filter((m) => m.sheet === 52 && String(m.typeCode || "") === "3");
console.log("accepted GT tokens for 3:", acceptedType3.map((t) => `${t.x},${t.y}`).join(" | "));
for (const token of acceptedType3) {
  const mark = type3Marks.find((m) => (
    Math.hypot(m.x - token.x, m.y - token.y) < 1.8
    || Math.hypot((m.labelLocation?.x ?? 999) - token.x, (m.labelLocation?.y ?? 999) - token.y) < 0.45
  )) || type3Marks[0];
  if (!mark) {
    console.log("NO MARK for token", token.x, token.y);
    continue;
  }
  const tagDist = Math.hypot(mark.x - token.x, mark.y - token.y);
  const bodyX = mark.symbolBodyLocation?.x ?? mark.x;
  const bodyY = mark.symbolBodyLocation?.y ?? mark.y;
  const geoDist = Math.hypot(bodyX - token.x, bodyY - token.y);
  const halfW = 0.9 / 2;
  const halfH = 0.9 / 2;
  const onGeometry = Math.abs(mark.x - token.x) <= halfW + 0.22 && Math.abs(mark.y - token.y) <= halfH + 0.22;
  const onTag = tagDist <= 0.28 && geoDist > 0.55;
  const bodyDistinct = geoDist > 0.45;
  const onTagOnly = onTag && bodyDistinct && !true;
  const vectorOnBody = mark.outlineSource === "vector" && geoDist <= 0.72 && !onTagOnly;
  const harnessOnGeometry = (onGeometry || vectorOnBody) && !onTagOnly;
  console.log(JSON.stringify({
    token: { x: token.x, y: token.y },
    mark: {
      x: mark.x,
      y: mark.y,
      body: { x: bodyX, y: bodyY },
      outlineSource: mark.outlineSource,
      labelLocation: mark.labelLocation,
    },
    tagDist: +tagDist.toFixed(3),
    geoDist: +geoDist.toFixed(3),
    onGeometry,
    onTag,
    onTagOnly,
    vectorOnBody,
    harnessOnGeometry,
    deviceOutlineNull: deviceOutline(mark) === null,
  }));
}

function e210LabeledTruth(page) {
  return (page?.tokens || []).filter((token) => {
    const code = normalizeTypeMark(token.text).toUpperCase();
    return /^(?:[1-4]|OS)$/.test(code) && shouldAcceptPlanToken(token, page.tokens, lightingOpts);
  }).map((token) => ({
    sheet: page.page,
    type: normalizeTypeMark(token.text).toUpperCase(),
    x: token.x,
    y: token.y,
    cx: token.x,
    cy: token.y,
    w: 0.9,
    h: 0.9,
    kind: "rect",
    tagOnSymbol: true,
    source: "plan-token",
  }));
}

console.log("\n=== pottsville-e210 labeled 1-4/OS accuracyHarness ===");
const labeledFixture = {
  ...fixture,
  pages: fixture.pages.filter((page) => page.page === 48 || page.page === 52),
  groundTruth: e210LabeledTruth(e210),
};
const score = scoreTakeoffAccuracy(labeledFixture);
console.log("markerAccuracy", (score.markerAccuracy * 100).toFixed(2) + "%");
console.log("failedMarkers", score.failedMarkers.map((item) => ({
  type: item.device.type,
  sheet: item.device.sheet,
  device: { x: item.device.x, y: item.device.y },
  mark: {
    x: item.mark.x,
    y: item.mark.y,
    outlineSource: item.mark.outlineSource,
    body: item.mark.symbolBodyLocation,
  },
  debug: item.debug,
  onGeometry: item.onGeometry,
})));
