import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks } from "./aiTakeoff.js";
import { bidDeviceMarks, isReviewOnlyMark } from "./detectionRecord.js";
import { isJunkGeometry } from "./vectorSymbols.js";
import { isPlanInterior, normalizeTypeMark, shouldAcceptPlanToken } from "./symbolDetection.js";
import { paletteForTrade } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const fixture = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/pottsville-electrical.json"),
  "utf8",
));
const e210 = (fixture.pages || []).find((page) => page.page === 52);
const electrical = paletteForTrade("electrical");
const result = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: fixture.drawingSymbols || [],
  pages: fixture.pages || [],
  maxHomeruns: 8,
});
const bid = bidDeviceMarks(result.marks).filter((mark) => mark.sheet === 52);
const review = (result.marks || []).filter((mark) => mark.sheet === 52 && isReviewOnlyMark(mark));
const lightingOpts = { planType: "lighting", paths: e210?.paths || [] };

function type2CanBodies(page) {
  const raw = (page?.paths || []).filter((path) => {
    if (isJunkGeometry(path) || !isPlanInterior({ x: path.cx, y: path.cy })) return false;
    if ((path.cx || 0) > 64 || (path.cy || 0) < 12) return false;
    const w = Number(path.w) || 0;
    const h = Number(path.h) || 0;
    return Math.abs(w - 0.595) <= 0.05 && Math.abs(h - 0.722) <= 0.05;
  });
  const unique = [];
  for (const path of raw) {
    if (unique.some((other) => Math.hypot(other.cx - path.cx, other.cy - path.cy) < 0.3)) continue;
    const printedTwo = (page?.tokens || []).some((token) => (
      normalizeTypeMark(token.text) === "2"
      && shouldAcceptPlanToken(token, page.tokens, lightingOpts)
      && Math.hypot((Number(token.x) || 0) - path.cx, (Number(token.y) || 0) - path.cy) <= 0.7
    ));
    const printedOne = (page?.tokens || []).some((token) => (
      normalizeTypeMark(token.text) === "1"
      && Math.hypot((Number(token.x) || 0) - path.cx, (Number(token.y) || 0) - path.cy) <= 0.7
    ));
    if (!printedTwo || printedOne) continue;
    unique.push({ sheet: 52, type: "2", x: path.cx, y: path.cy, cx: path.cx, cy: path.cy, w: path.w, h: path.h });
  }
  return unique;
}

const cans = type2CanBodies(e210);
const type2Marks = bid.filter((mark) => String(mark.typeCode || "") === "2");
const labeledPlan = (e210?.tokens || []).filter((token) => {
  const code = normalizeTypeMark(token.text).toUpperCase();
  return /^(?:[1-4]|OS)$/.test(code) && shouldAcceptPlanToken(token, e210.tokens, lightingOpts);
});
const used = new Set();
let matchedCans = 0;
for (const mark of type2Marks) {
  let best = -1;
  let bestDist = 0.7;
  cans.forEach((can, index) => {
    if (used.has(index)) return;
    const dist = Math.hypot(mark.x - can.cx, mark.y - can.cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  if (best >= 0) {
    used.add(best);
    matchedCans += 1;
  }
}
const extraType2 = type2Marks.filter((mark) => (
  !cans.some((can) => Math.hypot(mark.x - can.cx, mark.y - can.cy) < 0.7)
  && !labeledPlan.some((token) => (
    normalizeTypeMark(token.text) === "2"
    && Math.hypot((mark.labelLocation?.x ?? mark.x) - token.x, (mark.labelLocation?.y ?? mark.y) - token.y) < 0.45
  ))
));
const missedCans = cans.filter((_, index) => !used.has(index));
const labeledFound = labeledPlan.filter((token) => bid.some((mark) => {
  const code = normalizeTypeMark(token.text).toUpperCase();
  const same = String(mark.typeCode || "").toUpperCase() === code
    || (code === "OS" && mark.symbol === "occ");
  if (!same) return false;
  return Math.hypot(mark.x - token.x, mark.y - token.y) < 1.8
    || Math.hypot((mark.labelLocation?.x ?? 999) - token.x, (mark.labelLocation?.y ?? 999) - token.y) < 0.45;
}));
const legendStripBid = bid.filter((mark) => mark.y >= 29.8 && mark.y <= 31.6 && /^(?:[1-9])$/.test(String(mark.typeCode || "")));
const type1Bid = bid.filter((mark) => String(mark.typeCode || "") === "1");

console.log(`E210 fixture-level type2 cans ${matchedCans}/${cans.length} extra2=${extraType2.length} missed=${missedCans.length}`);
console.log(`E210 labeled plan 1-4/OS ${labeledFound.length}/${labeledPlan.length} type1Bid=${type1Bid.length} legendStrip=${legendStripBid.length} review=${review.length}`);
if (missedCans.length) {
  console.log("missed cans", missedCans.map((can) => `${can.cx.toFixed(2)},${can.cy.toFixed(2)}`).join(" "));
}
if (extraType2.length) {
  console.log("extra2", extraType2.map((mark) => `${mark.x.toFixed(2)},${mark.y.toFixed(2)} ${mark.outlineSource}`).join(" | "));
}

assert(legendStripBid.length === 0, `fixture legend strip is not schedule qty, got ${legendStripBid.length}`);
assert(labeledFound.length === labeledPlan.length, `printed plan lighting types must be marked, ${labeledFound.length}/${labeledPlan.length}`);
assert(matchedCans >= Math.floor(cans.length * 0.7), `type 2 can-body recall ${matchedCans}/${cans.length}`);
assert(extraType2.length === 0, `type 2 extras must be 0 against can coordinates, got ${extraType2.length}`);
assert(type1Bid.length <= labeledPlan.filter((token) => normalizeTypeMark(token.text) === "1").length + 2, `type 1 bid copies stay near printed plan 1s, got ${type1Bid.length}`);
assert((result.marks || []).filter((mark) => mark.sheet === 1 && (mark.type === "count" || mark.type === "drop")).length === 0, "cover stays 0");
assert((result.marks || []).filter((mark) => mark.sheet === 48 && (mark.type === "count" || mark.type === "drop")).length === 0, "E001 stays 0");
assert(!bid.some((mark) => /^(PC|208|EF)$/i.test(String(mark.typeCode || "")) || mark.symbol === "photocell" || mark.symbol === "ef"), `lighting-sheet PC/208V/EF are not bid devices, got ${bid.filter((mark) => /^(PC|208|EF)$/i.test(String(mark.typeCode || "")) || mark.symbol === "ef").map((mark) => mark.typeCode).join(",")}`);
const acceptedType3 = labeledPlan.filter((token) => normalizeTypeMark(token.text) === "3");
const extraType3 = bid.filter((mark) => String(mark.typeCode || "") === "3" && !acceptedType3.some((token) => (
  Math.hypot(mark.x - token.x, mark.y - token.y) < 1.8
  || Math.hypot((mark.labelLocation?.x ?? 999) - token.x, (mark.labelLocation?.y ?? 999) - token.y) < 0.45
)));
assert(extraType3.length === 0, `type 3 extras that are not the accepted plan 3 must not bid, got ${extraType3.length}`);
const leftoverCan = (result.marks || []).find((mark) => mark.sheet === 52 && Math.hypot(mark.x - 58.74, mark.y - 81.86) < 0.7);
assert(leftoverCan && String(leftoverCan.typeCode || "").toUpperCase() === "F1", `can at 58.74,81.86 takes the printed F1 tag, got ${leftoverCan?.typeCode}`);
const printedCanTags = (e210?.tokens || []).filter((token) => /^(L1|F1|X1|L3|L5A|L5B|OS)$/i.test(normalizeTypeMark(token.text)));
const typedPrinted = printedCanTags.filter((token) => (result.marks || []).some((mark) => (
  mark.sheet === 52
  && String(mark.typeCode || "").toUpperCase() === normalizeTypeMark(token.text).toUpperCase()
  && (Math.hypot(mark.x - token.x, mark.y - token.y) < 1.8 || Math.hypot((mark.labelLocation?.x ?? 999) - token.x, (mark.labelLocation?.y ?? 999) - token.y) < 0.45)
)));
assert(typedPrinted.length >= 8, `printed L1/F1/OS/X1 tags next to bodies stay typed, got ${typedPrinted.length}/${printedCanTags.length}`);

if (!process.exitCode) console.log("e210 lighting fixture-level checks passed");
