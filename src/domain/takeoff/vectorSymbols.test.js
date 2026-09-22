import {
  DRAW_CLOSE,
  DRAW_CUBIC,
  DRAW_LINE,
  DRAW_MOVE,
  associateGeometry,
  candidatesFromConstructedPaths,
  classifySymbolGeometry,
  isSymbolSized,
  looksLikeTextGlyph,
  mergeOverlappingCandidates,
  parseDrawOps,
  placeOnSymbolGeometry,
  pointHitsOutline,
  scaleOutline,
} from "./vectorSymbols.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const rectOps = [
  DRAW_MOVE, 10, 10,
  DRAW_LINE, 12.2, 10,
  DRAW_LINE, 12.2, 11.1,
  DRAW_LINE, 10, 11.1,
  DRAW_CLOSE,
];
const parsedRect = parseDrawOps(rectOps);
assert(parsedRect.points.length === 4, "rectangle path keeps four corners");
assert(!parsedRect.hasCurves, "a rectangle is not a curve");

const identityPct = (x, y) => ({ x, y });
const rectCandidates = candidatesFromConstructedPaths([{
  ctm: [1, 0, 0, 1, 0, 0],
  drawOps: rectOps,
}], identityPct);
assert(rectCandidates.length === 1, "one closed rectangle becomes one candidate");
assert(rectCandidates[0].kind === "rect", `2x4-like path is a rect, got ${rectCandidates[0]?.kind}`);
assert(Math.abs(rectCandidates[0].w - 2.2) < 0.05, "rect width is the extracted path width");
assert(Math.abs(rectCandidates[0].h - 1.1) < 0.05, "rect height is the extracted path height");

const circleOps = [
  DRAW_MOVE, 20, 20.6,
  DRAW_CUBIC, 20, 20.93, 20.27, 21.2, 20.6, 21.2,
  DRAW_CUBIC, 20.93, 21.2, 21.2, 20.93, 21.2, 20.6,
  DRAW_CUBIC, 21.2, 20.27, 20.93, 20, 20.6, 20,
  DRAW_CUBIC, 20.27, 20, 20, 20.27, 20, 20.6,
  DRAW_CLOSE,
];
const circleCandidates = candidatesFromConstructedPaths([{
  ctm: [1, 0, 0, 1, 0, 0],
  drawOps: circleOps,
}], identityPct);
assert(circleCandidates.length === 1, "four-curve closed path is one candidate");
assert(circleCandidates[0].kind === "circle", `can-like path is a circle from geometry, got ${circleCandidates[0]?.kind}`);
assert(circleCandidates[0].r > 0.4 && circleCandidates[0].r < 0.8, "circle radius comes from the path bbox");

assert(!isSymbolSized({ w: 18, h: 12, cx: 50, cy: 50 }), "room-sized boxes are not symbols");
assert(!isSymbolSized({ w: 0.05, h: 0.05, cx: 10, cy: 10 }), "specks are not symbols");
assert(isSymbolSized({ w: 2.1, h: 1.05, cx: 20, cy: 20 }), "a 2x4-sized box is a symbol");

const wall = classifySymbolGeometry(
  [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 0.2 }, { x: 0, y: 0.2 }],
  { w: 20, h: 0.2, cx: 10, cy: 0.1, minX: 0, minY: 0, maxX: 20, maxY: 0.2 },
);
assert(!isSymbolSized({ w: 20, h: 0.2, cx: 10, cy: 0.1 }), "a wall line is not a fixture");
assert(wall == null || !isSymbolSized({ w: wall.w, h: wall.h, cx: wall.cx, cy: wall.cy }), "classified walls stay rejected");

const tagged = associateGeometry({ x: 12.6, y: 10.5 }, rectCandidates);
assert(tagged && tagged.kind === "rect", "type tag binds to the nearby extracted rectangle");
assert(associateGeometry({ x: 80, y: 80 }, rectCandidates) == null, "a far tag does not steal geometry");

const glyph = {
  kind: "path",
  cx: 12.6,
  cy: 10.5,
  w: 0.55,
  h: 0.7,
  r: 0.35,
  points: [
    { x: 12.32, y: 10.15 },
    { x: 12.88, y: 10.15 },
    { x: 12.88, y: 10.85 },
    { x: 12.32, y: 10.85 },
  ],
  outline: { kind: "path", source: "vector", w: 0.55, h: 0.7, points: [] },
};
assert(looksLikeTextGlyph(glyph, { text: "1E", x: 12.6, y: 10.5 }), "a letter-sized path on the tag is a text glyph");
const snapped = placeOnSymbolGeometry({ text: "1E", x: 12.6, y: 10.5 }, [glyph, ...rectCandidates]);
assert(snapped && snapped.kind === "rect", "placement skips the text glyph and lands on the fixture body");
assert(Math.abs(snapped.cx - rectCandidates[0].cx) < 0.05, "marker center is the extracted symbol, not the type tag");
const farSnap = placeOnSymbolGeometry({ text: "1E", x: 15.8, y: 10.6 }, rectCandidates);
assert(farSnap && farSnap.kind === "rect", "a slightly farther type tag still binds to the symbol body");

const merged = mergeOverlappingCandidates([
  ...rectCandidates,
  { ...rectCandidates[0], cx: rectCandidates[0].cx + 0.05, cy: rectCandidates[0].cy },
]);
assert(merged.length === 1, "overlapping detections of the same outline merge");

const scaled = scaleOutline(rectCandidates[0].outline, 1.45, { x: rectCandidates[0].cx, y: rectCandidates[0].cy });
assert(scaled.w > rectCandidates[0].outline.w, "selected outline enlarges the extracted shape");
assert(pointHitsOutline(rectCandidates[0].outline, { x: rectCandidates[0].cx, y: rectCandidates[0].cy }, { x: rectCandidates[0].cx, y: rectCandidates[0].cy }), "the extracted fill is selectable");
assert(!pointHitsOutline(rectCandidates[0].outline, { x: rectCandidates[0].cx, y: rectCandidates[0].cy }, { x: 40, y: 40 }), "hit stays on the extracted outline");

if (!process.exitCode) console.log("vector symbol checks passed");
