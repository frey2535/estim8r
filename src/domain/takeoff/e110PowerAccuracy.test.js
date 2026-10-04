import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks } from "./aiTakeoff.js";
import { deviceOutline } from "./deviceStyles.js";
import { isHatchTickCluster, isStairHatchTick, looksLikeHexNoteGlyph, looksLikeUnlabeledReceptacleGlyph, nearHexNoteGlyph } from "./legendGeometry.js";
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
const e110 = (fixture.pages || []).find((page) => page.page === 50);
const electrical = paletteForTrade("electrical");
const result = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: fixture.drawingSymbols || [],
  pages: fixture.pages || [],
  maxHomeruns: 8,
});

const marks = (result.marks || []).filter((mark) => mark.type === "count" || mark.type === "drop");
const e110Marks = marks.filter((mark) => mark.sheet === 50);
const byType = (code) => e110Marks.filter((mark) => String(mark.typeCode || "").toUpperCase() === code);
const bySymbol = (id) => e110Marks.filter((mark) => mark.symbol === id);

function visibleText(page, pattern) {
  return (page?.tokens || []).filter((token) => pattern.test(normalizeTypeMark(token.text))).length;
}

function visibleReceptacleGlyphs(page) {
  const paths = page?.paths || [];
  return paths.filter((path) => (
    looksLikeUnlabeledReceptacleGlyph(path)
    && !isHatchTickCluster(path, paths)
    && !isStairHatchTick(path, paths)
    && !looksLikeHexNoteGlyph(path)
    && !nearHexNoteGlyph(path, paths)
    && isPlanInterior({ x: path.cx, y: path.cy })
    && path.cy <= 74
  ));
}

const receptacleGlyphs = visibleReceptacleGlyphs(e110);
const visible = {
  receptacles: receptacleGlyphs.length,
  wp: visibleText(e110, /^WP$/i),
  sp: visibleText(e110, /^SP$/i),
  gfi: visibleText(e110, /^GFI(?:\/WP)?$/i),
  os: visibleText(e110, /^OS$/i),
};
const glyphsOnMark = receptacleGlyphs.filter((glyph) => e110Marks.some((mark) => Math.hypot(mark.x - glyph.cx, mark.y - glyph.cy) < 0.45)).length;
const found = {
  receptacles: byType("R").length + bySymbol("duplex").filter((mark) => mark.typeCode !== "R").length,
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
console.log(`receptacles visible=${visible.receptacles} found=${found.receptacles} onGlyph=${glyphsOnMark}`);
console.log(`WP visible=${visible.wp} found=${found.wp}`);
console.log(`SP visible=${visible.sp} found=${found.sp}`);
console.log(`GFI visible=${visible.gfi} found=${found.gfi}`);
console.log(`OS visible=${visible.os} found=${found.os}`);
console.log(`E110 total=${e110Marks.length} hexFP=${hexMarked.length} lightingOnPower=${lightingOnPower.length} hatchBand=${hatchBand.length} maxExtent=${maxExtent.toFixed(2)}`);
console.log(`E001=${legendMarks.length} cover=${coverMarks.length} WP_on_glyph=${wpOnGlyph.length}/${found.wp}`);

assert(legendMarks.length === 0, `legend E001 must stay 0, got ${legendMarks.length}`);
assert(coverMarks.length === 0, `cover must stay 0, got ${coverMarks.length}`);
assert(found.wp >= visible.wp, `WP recall: found ${found.wp} of ${visible.wp} printed tags`);
assert(found.sp >= visible.sp, `SP recall: found ${found.sp} of ${visible.sp} printed tags`);
assert(glyphsOnMark >= Math.ceil(visible.receptacles * 0.99), `receptacle glyphs on-mark ${glyphsOnMark}/${visible.receptacles}`);
assert(found.gfi === visible.gfi, `GFI on E110 should match printed tags, found ${found.gfi} visible ${visible.gfi}`);
assert(found.os === visible.os, `OS on E110 should match printed tags, found ${found.os} visible ${visible.os}`);
assert(found.receptacles >= Math.floor(visible.receptacles * 0.85), `unlabeled receptacle recall: found ${found.receptacles} of ${visible.receptacles} glyphs`);
assert(lightingOnPower.length === 0, `lighting types / site poles must not mark a power sheet, got ${lightingOnPower.length}`);
assert(hexMarked.length === 0, `hex notes must not get text chips, got ${hexMarked.length}`);
assert(hatchBand.length === 0, `stair/hatch ticks must not become marks, got ${hatchBand.length}`);
assert(maxExtent <= 1.65, `fills must stay Beam-tight, max extent ${maxExtent}`);
assert(wpOnGlyph.length >= Math.min(3, found.wp), `WP fills must sit on the printed glyph, ${wpOnGlyph.length}/${found.wp}`);
assert(!(e110?.tokens || []).some((token) => (
  /^TYP\.?$/i.test(normalizeTypeMark(token.text))
  && e110Marks.some((mark) => Math.hypot(mark.x - token.x, mark.y - token.y) < 0.2 && mark.typeCode === "TYP")
)), "TYP. is not a counted device");
assert((e110?.tokens || []).filter((token) => normalizeTypeMark(token.text) === "WP").every((token) => shouldAcceptPlanToken(token, e110.tokens)), "every printed WP tag is eligible");

if (!process.exitCode) console.log("e110 power glyph accuracy checks passed");
