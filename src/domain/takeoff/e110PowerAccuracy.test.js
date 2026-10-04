import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks } from "./aiTakeoff.js";
import { bidDeviceMarks } from "./detectionRecord.js";
import { deviceOutline } from "./deviceStyles.js";
import { looksLikeUnlabeledReceptacleGlyph, uniquePlanReceptacleGlyphs } from "./legendGeometry.js";
import { normalizeTypeMark, shouldAcceptPlanToken } from "./symbolDetection.js";
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
const e110 = (fixture.pages || []).find((page) => page.page === 50);
const electrical = paletteForTrade("electrical");
const result = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: fixture.drawingSymbols || [],
  pages: fixture.pages || [],
  maxHomeruns: 8,
});

const marks = bidDeviceMarks(result.marks);
const reviewMarks = (result.marks || []).filter((mark) => mark.layer === "review" || String(mark.typeCode || "").toUpperCase() === "UNKNOWN");
const e110Marks = marks.filter((mark) => mark.sheet === 50);
const byType = (code) => e110Marks.filter((mark) => String(mark.typeCode || "").toUpperCase() === code);

function visibleText(page, pattern) {
  return (page?.tokens || []).filter((token) => pattern.test(normalizeTypeMark(token.text))).length;
}

function receptacleGlyphTruth(page) {
  return uniquePlanReceptacleGlyphs(page?.paths || [], page?.tokens || [])
    .map((path) => ({ cx: path.cx, cy: path.cy, w: path.w, h: path.h }));
}

function matchGlyphs(marks, glyphs, radius = 0.45) {
  const used = new Set();
  let matched = 0;
  const extras = [];
  for (const mark of marks) {
    let best = -1;
    let bestDist = radius;
    glyphs.forEach((glyph, index) => {
      if (used.has(index)) return;
      const dist = Math.hypot(mark.x - glyph.cx, mark.y - glyph.cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    if (best >= 0) {
      used.add(best);
      matched += 1;
    } else {
      extras.push(mark);
    }
  }
  return {
    matched,
    extras,
    missed: glyphs.filter((_, index) => !used.has(index)),
  };
}

const receptacleGlyphs = receptacleGlyphTruth(e110);
const receptacleMatch = matchGlyphs(byType("R"), receptacleGlyphs);
const visible = {
  receptacles: receptacleGlyphs.length,
  wp: visibleText(e110, /^WP$/i),
  sp: visibleText(e110, /^SP$/i),
  gfi: visibleText(e110, /^GFI(?:\/WP)?$/i),
  os: visibleText(e110, /^OS$/i),
};
const found = {
  receptacles: receptacleMatch.matched,
  extraR: receptacleMatch.extras.length,
  missedR: receptacleMatch.missed.length,
  wp: byType("WP").length,
  sp: byType("SP").length + byType("SPR").length,
  gfi: byType("GFI").length + byType("GFI/WP").length,
  os: byType("OS").length,
};

const hexNotes = (e110?.tokens || []).filter((token) => {
  if (!/^\d{1,2}$/.test(normalizeTypeMark(token.text))) return false;
  return token.y >= 78 && token.y <= 84;
});
const hexMarked = e110Marks.filter((mark) => hexNotes.some((token) => (
  Math.hypot(mark.x - token.x, mark.y - token.y) < 0.45
  && /^(1|2|3|4|SP|WP)$/.test(String(mark.typeCode || ""))
  && mark.outlineSource === "text"
)));
const lightingOnPower = e110Marks.filter((mark) => /^(1|2|3|4)$/.test(String(mark.typeCode || "")) || mark.symbol === "site-pole");
const hatchBand = e110Marks.filter((mark) => mark.x >= 10 && mark.x <= 16 && mark.y >= 14 && mark.y <= 22);
const maxExtent = e110Marks.reduce((max, mark) => {
  const outline = deviceOutline(mark);
  return Math.max(max, Number(outline.w) || 0, Number(outline.h) || 0, (Number(outline.r) || 0) * 2);
}, 0);
const wpOnGlyph = byType("WP").filter((mark) => mark.outlineSource === "vector" || looksLikeUnlabeledReceptacleGlyph({
  cx: mark.x, cy: mark.y, w: mark.outline?.w, h: mark.outline?.h, kind: mark.outline?.kind || "rect",
}));
const legendMarks = marks.filter((mark) => mark.sheet === 48);
const coverMarks = marks.filter((mark) => mark.sheet === 1);

console.log("E110 visible vs found (drawing, not legend qty)");
console.log(`receptacles glyphs=${visible.receptacles} matched=${found.receptacles} extra=${found.extraR} missed=${found.missedR}`);
console.log(`WP visible=${visible.wp} found=${found.wp}`);
console.log(`SP visible=${visible.sp} found=${found.sp}`);
console.log(`GFI visible=${visible.gfi} found=${found.gfi}`);
console.log(`OS visible=${visible.os} found=${found.os}`);
console.log(`E110 total=${e110Marks.length} review=${reviewMarks.filter((mark) => mark.sheet === 50).length} hexFP=${hexMarked.length} lightingOnPower=${lightingOnPower.length} hatchBand=${hatchBand.length} maxExtent=${maxExtent.toFixed(2)}`);
console.log(`E001=${legendMarks.length} cover=${coverMarks.length} WP_on_glyph=${wpOnGlyph.length}/${found.wp}`);

assert(legendMarks.length === 0, `legend E001 must stay 0, got ${legendMarks.length}`);
assert(coverMarks.length === 0, `cover must stay 0, got ${coverMarks.length}`);
assert(found.wp >= visible.wp, `WP recall: found ${found.wp} of ${visible.wp} printed tags`);
assert(found.sp === visible.sp, `SP recall: found ${found.sp} of ${visible.sp} printed tags`);
assert(found.gfi === visible.gfi, `GFI on E110 should match printed tags, found ${found.gfi} visible ${visible.gfi}`);
assert(found.os === visible.os, `OS on E110 should match printed tags, found ${found.os} visible ${visible.os}`);
assert(found.missedR === 0, `every plan receptacle glyph must have a mark, missed ${found.missedR} of ${visible.receptacles}: ${receptacleMatch.missed.slice(0, 6).map((item) => `${item.cx.toFixed(2)},${item.cy.toFixed(2)}`).join(" ")}`);
assert(found.extraR === 0, `receptacle marks must sit on glyph coordinates, extra ${found.extraR}: ${receptacleMatch.extras.slice(0, 6).map((item) => `${item.x.toFixed(2)},${item.y.toFixed(2)}`).join(" ")}`);
assert(lightingOnPower.length === 0, `lighting types / site poles must not mark a power sheet, got ${lightingOnPower.length}`);
assert(hexMarked.length === 0, `hex notes must not get text chips, got ${hexMarked.length}`);
assert(hatchBand.length <= 4, `stair/hatch ticks must not become room-full of marks, got ${hatchBand.length}`);
assert(maxExtent <= 1.65, `fills must stay Beam-tight, max extent ${maxExtent}`);
assert(wpOnGlyph.length >= Math.min(3, found.wp), `WP fills must sit on the printed glyph, ${wpOnGlyph.length}/${found.wp}`);
assert(!(e110?.tokens || []).some((token) => (
  /^TYP\.?$/i.test(normalizeTypeMark(token.text))
  && e110Marks.some((mark) => Math.hypot(mark.x - token.x, mark.y - token.y) < 0.2 && mark.typeCode === "TYP")
)), "TYP. is not a counted device");
assert((e110?.tokens || []).filter((token) => normalizeTypeMark(token.text) === "WP").every((token) => shouldAcceptPlanToken(token, e110.tokens)), "every printed WP tag is eligible");

const e210 = (fixture.pages || []).find((page) => page.page === 52);
const e210Marks = marks.filter((mark) => mark.sheet === 52);
const lightingOpts = { planType: "lighting", paths: e210?.paths || [] };
const labeledLighting = (e210?.tokens || []).filter((token) => {
  const code = normalizeTypeMark(token.text).toUpperCase();
  return /^(?:[1-4]|OS)$/.test(code) && shouldAcceptPlanToken(token, e210.tokens, lightingOpts);
});
const lightingFound = labeledLighting.filter((token) => e210Marks.some((mark) => {
  const code = normalizeTypeMark(token.text).toUpperCase();
  const same = String(mark.typeCode || "").toUpperCase() === code
    || (code === "OS" && mark.symbol === "occ");
  if (!same) return false;
  return Math.hypot(mark.x - token.x, mark.y - token.y) < 1.8
    || Math.hypot((mark.labelLocation?.x ?? 999) - token.x, (mark.labelLocation?.y ?? 999) - token.y) < 0.45;
}));
const type1Count = e210Marks.filter((mark) => String(mark.typeCode || "") === "1").length;
const legendStripBid = e210Marks.filter((mark) => mark.y >= 29.8 && mark.y <= 31.6 && /^(?:[1-9])$/.test(String(mark.typeCode || "")));
console.log(`E210 labeled lighting ${lightingFound.length}/${labeledLighting.length} type1=${type1Count} legendStripBid=${legendStripBid.length}`);
assert(lightingFound.length === labeledLighting.length, `E210 labeled 1-4/OS must be marked from the plan, found ${lightingFound.length}/${labeledLighting.length}`);
assert(legendStripBid.length === 0, `E210 fixture-legend strip is not schedule qty, got ${legendStripBid.length}`);
assert(type1Count <= 6, `E210 type 1 must not invent a room-grid, got ${type1Count}`);

if (!process.exitCode) console.log("e110 power glyph accuracy checks passed");
