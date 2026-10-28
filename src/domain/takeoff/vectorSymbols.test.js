import {
  DRAW_CLOSE,
  DRAW_CUBIC,
  DRAW_LINE,
  DRAW_QUAD,
  DRAW_MOVE,
  associateGeometry,
  assignExclusiveGeometry,
  candidatesFromConstructedPaths,
  circlePaintOutlineFromBody,
  drawOpsExtentPoints,
  classifySymbolGeometry,
  containsPoint,
  isJunkGeometry,
  isPlausibleSymbolForHint,
  isSymbolSized,
  isAdjacentThinFixtureBar,
  looksLikeExtractedCanRect,
  looksLikeRecessedCanBody,
  looksLikeTextGlyph,
  mergeOverlappingCandidates,
  parseDrawOps,
  placeOnSymbolGeometry,
  pointHitsOutline,
  scaleOutline,
  shapeHintFromLabel,
  tagAdjacentToSymbolBody,
  tagOnSymbolGeometry,
  transformedMinMaxBounds,
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

const rotatedBounds = transformedMinMaxBounds([0, 0, 2, 1], [0, 1, -1, 0, 10, 20], identityPct);
assert(rotatedBounds && Math.abs(rotatedBounds.w - 1) < 1e-9 && Math.abs(rotatedBounds.h - 2) < 1e-9, "90-degree rotated PDF minMax retains full symbol extent");
assert(rotatedBounds && Math.abs(rotatedBounds.cx - 9.5) < 1e-9 && Math.abs(rotatedBounds.cy - 21) < 1e-9, "rotated minMax center follows transformed corners");
const shearedBounds = transformedMinMaxBounds([0, 0, 2, 1], [1, 0, 1, 1, 0, 0], identityPct);
assert(shearedBounds && Math.abs(shearedBounds.w - 3) < 1e-9, "sheared PDF minMax includes off-diagonal corners");
const fallbackRotated = candidatesFromConstructedPaths([{ ctm: [0, 1, -1, 0, 10, 20], drawOps: [], minMax: [0, 0, 2, 1] }], identityPct);
assert(fallbackRotated.length === 1 && Math.abs(fallbackRotated[0].w - 1) < 1e-9, "rotated fallback produces correctly sized symbol candidate");

const archedOps = [DRAW_MOVE, 30, 30, DRAW_QUAD, 31, 32, 32, 30, DRAW_LINE, 30, 30, DRAW_CLOSE];
const archedPoints = drawOpsExtentPoints(archedOps);
assert(Math.max(...archedPoints.map((p) => p.y)) > 30.9, "quadratic control point contributes visible curve height");
const archedCandidates = candidatesFromConstructedPaths([{ drawOps: archedOps }], identityPct);
assert(archedCandidates.length === 1 && archedCandidates[0].h > 0.9, "curved symbol bounds include the arc, not just its endpoints");
const cubicExtent = drawOpsExtentPoints([DRAW_MOVE, 0, 0, DRAW_CUBIC, 0, 2, 2, 2, 2, 0]);
assert(Math.max(...cubicExtent.map((p) => p.y)) > 1.4, "cubic curve extent includes its curved ink");

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
const farSnap = placeOnSymbolGeometry({ text: "1E", x: 13.4, y: 10.6 }, rectCandidates);
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
const shifted = { kind: "rect", w: 1.2, h: 0.8, cx: 22, cy: 31 };
assert(pointHitsOutline(shifted, { x: 5, y: 5 }, { x: 22.1, y: 31 }), "the hit box uses the painted outline center");
assert(!pointHitsOutline(shifted, { x: 5, y: 5 }, { x: 5, y: 5 }), "a stored origin away from the ink is not the click target");
const roomWall = { kind: "path", points: [{ x: 20, y: 80 }, { x: 60, y: 80 }, { x: 60, y: 50 }, { x: 20, y: 50 }] };
assert(pointHitsOutline(roomWall, { x: 40, y: 65 }, { x: 19.9, y: 65 }, 0.2), "the visible wall stroke is selectable");
assert(!pointHitsOutline(roomWall, { x: 40, y: 65 }, { x: 19.4, y: 65 }, 0.2), "empty space beside the wall is not selected");

assert(shapeHintFromLabel("Type 1 2x4 LED surface troffer") === "rect", "schedule troffer text is a rectangle hint");
assert(shapeHintFromLabel("Type 2 8 inch recessed downlight") === "circle", "schedule downlight text is a circle hint");
assert(isJunkGeometry({ w: 0.1, h: 0.08, cx: 10, cy: 10 }), "hatch scraps are not fixture bodies");
assert(isJunkGeometry({ w: 3.79, h: 0.65, cx: 55, cy: 12 }), "building bars are not fixture bodies");
assert(isPlausibleSymbolForHint({ w: 0.63, h: 0.97, kind: "rect" }, "rect"), "a 2x4-sized hatch is a troffer body");
assert(!isPlausibleSymbolForHint({ w: 3.79, h: 0.65, kind: "rect" }, "circle"), "a downlight tag does not bind to a roof outline");

const scrap = { kind: "rect", cx: 12.4, cy: 10.1, w: 0.14, h: 0.19, outline: { kind: "rect", w: 0.14, h: 0.19 } };
const type1e = { text: "1E", x: 12.05, y: 10.55 };
const assigned = assignExclusiveGeometry([type1e], [scrap, ...rectCandidates], { shapeHintFor: () => "rect" });
assert(assigned.get(type1e) === rectCandidates[0], "exclusive assign prefers the troffer over a hatch scrap");
assert(placeOnSymbolGeometry({ text: "'2'", x: 53.4, y: 14.3 }, [{
  kind: "rect", cx: 55.7, cy: 12.9, w: 3.79, h: 0.65, outline: { kind: "rect", w: 3.79, h: 0.65 },
}], { shapeHint: "circle" }) == null, "circle-hint devices stay on the tag when only a building bar is nearby");
const tagCan = tagOnSymbolGeometry({ text: "'2'", x: 53.4, y: 14.3 }, { shapeHint: "circle" });
assert(tagCan?.kind === "circle" && Math.abs(tagCan.cx - 53.4) < 0.01 && Math.abs(tagCan.cy - 14.3) < 0.01, "can/OS/GFI fills sit on the type mark, not beside it");
assert(tagCan.r <= 0.3, "tag-on-symbol can fills stay small");
const tagTroffer = tagOnSymbolGeometry({ text: "'1'", x: 25.7, y: 22.1 }, { shapeHint: "rect" });
assert(tagTroffer?.kind === "rect" && tagTroffer.cx === 25.7 && tagTroffer.cy === 22.1, "quoted type 1 stays on the printed mark when no body extracts");

// Pottsville E210 type-3 regression: printed "3" at (69.549,77.862) beside the
// genuine thin fixture bar (69.825,77.442 / 0.201×0.548). Digit ink, a foreign
// rect, and a neighboring can must stay rejected; the bar must associate.
const type3Token = { text: "3", x: 69.549, y: 77.862 };
const type3DigitGlyph = {
  kind: "path",
  cx: 69.547,
  cy: 78.144,
  w: 0.152,
  h: 0.196,
  outline: { kind: "path", source: "vector", w: 0.152, h: 0.196, points: [] },
};
const type3FixtureBar = {
  kind: "rect",
  cx: 69.825,
  cy: 77.442,
  w: 0.201,
  h: 0.548,
  outline: { kind: "rect", source: "vector", w: 0.201, h: 0.548, points: [] },
};
const neighborCan = {
  kind: "circle",
  cx: 70.148,
  cy: 78.562,
  w: 0.726,
  h: 0.959,
  r: 0.48,
  outline: { kind: "circle", source: "vector", w: 0.726, h: 0.959, r: 0.48, points: [] },
};
const neighborRect = {
  kind: "rect",
  cx: 70.337,
  cy: 77.168,
  w: 0.628,
  h: 0.503,
  outline: { kind: "rect", source: "vector", w: 0.628, h: 0.503, points: [] },
};
assert(looksLikeTextGlyph(type3DigitGlyph, type3Token), "type-3 digit path is a text glyph");
assert(!looksLikeTextGlyph(type3FixtureBar, type3Token), "type-3 fixture bar is not a text glyph");
assert(isAdjacentThinFixtureBar(type3Token, type3FixtureBar), "type-3 fixture bar matches adjacent thin-bar geometry");
assert(tagAdjacentToSymbolBody(type3Token, type3FixtureBar), "type-3 tag is adjacent to its fixture bar");
assert(!isAdjacentThinFixtureBar(type3Token, neighborRect), "foreign rect is not an adjacent thin fixture bar");
assert(!tagAdjacentToSymbolBody(type3Token, neighborRect), "type-3 tag is not adjacent to the foreign rect");
assert(
  associateGeometry(type3Token, [type3DigitGlyph, neighborCan, neighborRect], { shapeHint: "rect" }) == null,
  "rect-hint type 3 does not bind to a neighboring can circle or foreign rect",
);
const type3Place = placeOnSymbolGeometry(type3Token, [type3DigitGlyph, neighborCan, neighborRect], { shapeHint: "rect" });
assert(type3Place == null, "type 3 with only neighbor bodies falls through to tag-on-symbol placement");
assert(
  associateGeometry(
    type3Token,
    [type3DigitGlyph, type3FixtureBar, neighborCan, neighborRect],
    { shapeHint: "rect" },
  ) === type3FixtureBar,
  "rect-hint type 3 binds the adjacent thin fixture bar, not digit ink or neighbors",
);
assert(
  placeOnSymbolGeometry(
    type3Token,
    [type3DigitGlyph, type3FixtureBar, neighborCan, neighborRect],
    { shapeHint: "rect" },
  ) === type3FixtureBar,
  "type 3 places on the extracted E210 fixture bar",
);
// Soccer E1.01 FP path: a horizontal hatch scrap near "'1E'" must not qualify as
// a thin fixture bar or outrank the real troffer body at (38.183,26.481).
const soccerScrap = {
  kind: "rect",
  cx: 36.815,
  cy: 25.811,
  w: 0.504,
  h: 0.2,
  outline: { kind: "rect", source: "vector", w: 0.504, h: 0.2, points: [] },
};
const soccerTroffer = {
  kind: "rect",
  cx: 38.183,
  cy: 26.481,
  w: 0.802,
  h: 1.25,
  outline: { kind: "rect", source: "vector", w: 0.802, h: 1.25, points: [] },
};
const soccerFpTag = { text: "'1E'", x: 37.052, y: 25.655 };
assert(!isAdjacentThinFixtureBar(soccerFpTag, soccerScrap), "horizontal Soccer hatch scrap is not a thin fixture bar");
assert(tagAdjacentToSymbolBody(soccerFpTag, soccerTroffer), "Soccer FP tag is adjacent to its troffer body");
assert(
  associateGeometry(soccerFpTag, [soccerScrap, soccerTroffer], { shapeHint: "rect" }) === soccerTroffer,
  "Soccer 1E binds the troffer body, not the horizontal scrap",
);
// Oversized corridor scrap beside a second type-3 tag must not win association.
const type3TokenB = { text: "3", x: 69.048, y: 79.524 };
const type3MidBar = {
  kind: "rect",
  cx: 68.786,
  cy: 79.423,
  w: 0.331,
  h: 0.548,
  outline: { kind: "rect", source: "vector", w: 0.331, h: 0.548, points: [] },
};
const type3RoomScrap = {
  kind: "rect",
  cx: 68.153,
  cy: 79.509,
  w: 1.614,
  h: 0.634,
  outline: { kind: "rect", source: "vector", w: 1.614, h: 0.634, points: [] },
};
assert(isAdjacentThinFixtureBar(type3TokenB, type3MidBar), "mid-width vertical type-3 bar is an adjacent fixture bar");
assert(
  associateGeometry(type3TokenB, [type3RoomScrap, type3MidBar], { shapeHint: "rect" }) === type3MidBar,
  "type 3 prefers its fixture bar over an oversized room scrap",
);
const type3Tag = tagOnSymbolGeometry(type3Token, { shapeHint: "rect" });
assert(type3Tag && Math.abs(type3Tag.cx - type3Token.x) < 0.01 && Math.abs(type3Tag.cy - type3Token.y) < 0.01, "type 3 fill stays on the printed tag when no body extracts");
assert(
  associateGeometry(type3Token, [neighborCan], { shapeHint: "circle" }) === neighborCan
  || placeOnSymbolGeometry(type3Token, [neighborCan], { shapeHint: "circle" }) === neighborCan,
  "circle-hint devices may still bind to a nearby can body",
);
// Runtime often flips type 3 to circle via legend seed kind; that bind is not
// adjacent to the printed tag and must be rejected by the lighting demotion
// (aiTakeoff), leaving tag-on-symbol placement for E210 3@52 when the bar is absent.
assert(!tagAdjacentToSymbolBody(type3Token, neighborCan), "type-3 tag is not adjacent to the neighboring can");
assert(!containsPoint(neighborCan, type3Token), "type-3 tag does not sit inside the neighboring can");
assert(
  associateGeometry(type3Token, [type3FixtureBar, neighborCan], { shapeHint: "rect" }) === type3FixtureBar,
  "rect-hint prefers the adjacent thin bar over a neighboring circle",
);

// Tag sitting beside a real 2x4 body must still associate (Soccer troffer case).
const trofferBeside = {
  kind: "rect",
  cx: 21.05,
  cy: 36.525,
  w: 2.1,
  h: 1.05,
  outline: { kind: "rect", source: "vector", w: 2.1, h: 1.05, points: [] },
};
const trofferTag = { text: "1E", x: 21.05, y: 35.75 };
assert(tagAdjacentToSymbolBody(trofferTag, trofferBeside), "tag beside a 2x4 is adjacent to that body");
assert(
  associateGeometry(trofferTag, [trofferBeside], { shapeHint: "rect" }) === trofferBeside,
  "rect-hint still binds a tag that sits on the long edge of its troffer",
);

// Soccer E1.01 side-tagged fixtures: tag sits ~0.6–0.8 beyond the AABB on one
// axis while staying in the body's vertical/horizontal band. Cardinal-edge
// adjacency must accept these; the prior flat pad=0.35 rejected all 7 type 1E.
const soccer1eBody = {
  kind: "rect",
  cx: 26.369,
  cy: 18.431,
  w: 0.627,
  h: 0.972,
  outline: { kind: "rect", source: "vector", w: 0.627, h: 0.972, points: [] },
};
const soccer1eTag = { text: "1E", x: 25.464, y: 18.095 };
assert(tagAdjacentToSymbolBody(soccer1eTag, soccer1eBody), "Soccer 1E side tag is adjacent to its troffer body");
assert(
  associateGeometry(soccer1eTag, [soccer1eBody], { shapeHint: "rect" }) === soccer1eBody,
  "Soccer 1E rect-hint binds the side-tagged fixture body, not the printed tag",
);
const soccer3eBody = {
  kind: "rect",
  cx: 23.869,
  cy: 27.742,
  w: 1.04,
  h: 0.628,
  outline: { kind: "rect", source: "vector", w: 1.04, h: 0.628, points: [] },
};
const soccer3eTag = { text: "3E", x: 22.575, y: 27.394 };
assert(tagAdjacentToSymbolBody(soccer3eTag, soccer3eBody), "Soccer 3E side tag is adjacent to its body");
assert(
  associateGeometry(soccer3eTag, [soccer3eBody], { shapeHint: "rect" }) === soccer3eBody,
  "Soccer 3E rect-hint binds the side-tagged body",
);

const soccerCanRect = {
  kind: "rect",
  cx: 35.0,
  cy: 29.11,
  w: 0.64,
  h: 0.62,
  outline: { kind: "rect", source: "vector", w: 0.64, h: 0.62, points: [] },
};
const soccerCanTag = { text: "4", x: 35.0, y: 29.11 };
assert(looksLikeExtractedCanRect(soccerCanRect), "near-square extracted can rects are recognized for paint");
assert(!looksLikeRecessedCanBody(soccerCanRect), "extracted can rects do not trigger unlabeled circle can recovery");
const canPerimeter = circlePaintOutlineFromBody(soccerCanRect, "circle");
assert(canPerimeter?.kind === "circle" && Math.abs(canPerimeter.r - 0.31) < 0.01, "square can rect promotes to a full circle perimeter");
assert(Math.abs(canPerimeter.w - 0.64) < 1e-9 && Math.abs(canPerimeter.h - 0.62) < 1e-9, "can promotion preserves measured percent extents");
assert(circlePaintOutlineFromBody({ kind: "rect", cx: 1, cy: 1, w: 0.9, h: 0.3 }, "circle") === null, "forced circle hint cannot oval an elongated rect");

const distantTroffer = {
  kind: "rect",
  cx: 29.163 + 1.70,
  cy: 18.072,
  w: 1.35,
  h: 0.70,
  outline: { kind: "rect", source: "vector", w: 1.35, h: 0.70, points: [] },
};
const type1Tag = { text: "1", x: 29.163, y: 18.072 };
assert(tagAdjacentToSymbolBody(type1Tag, distantTroffer), "side-tagged 2x4 remains edge-adjacent at ~1.7″");
assert(
  placeOnSymbolGeometry(type1Tag, [distantTroffer], { shapeHint: "rect", farRadius: 2.05 }) === distantTroffer,
  "explicit rect farRadius reaches a 2x4 body beyond the primary associate radius",
);

if (!process.exitCode) console.log("vector symbol checks passed");
