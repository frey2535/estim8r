/**
 * True symbol fill regression — rejects universal fixed-size oval markers.
 *
 * Detection stays separate from paint. Paint must match measured geometry:
 * rect → rect, circle → ellipse extents from w/h, path → polygon.
 */
import {
  DEVICE_CHIP_R,
  displayDeviceOutline,
  ellipseRadiiFromOutline,
  markHasUncertainPaintBoundary,
  paintDeviceOutline,
} from "./deviceStyles.js";
import { circlePaintOutlineFromBody } from "./vectorSymbols.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const troffer = {
  id: "troffer",
  source: "ai",
  type: "count",
  symbol: "2x4",
  typeCode: "1",
  abbr: "1",
  x: 55,
  y: 30,
  symbolBodyLocation: { x: 55, y: 30 },
  outlineSource: "vector",
  outline: { kind: "rect", source: "vector", cx: 55, cy: 30, w: 1.2, h: 0.55, points: [] },
};

const pagePt = { width: 792, height: 612 };
// True 5.7pt-radius circle on that page → unequal percent extents.
const canDiameterPt = 5.7024;
const can = {
  id: "can",
  source: "ai",
  type: "count",
  symbol: "downlight",
  typeCode: "4",
  abbr: "4",
  x: 40,
  y: 22,
  symbolBodyLocation: { x: 40, y: 22 },
  outlineSource: "vector",
  outline: {
    kind: "circle",
    source: "vector",
    cx: 40,
    cy: 22,
    r: (canDiameterPt / pagePt.width) * 50,
    w: (canDiameterPt / pagePt.width) * 100,
    h: (canDiameterPt / pagePt.height) * 100,
    points: [],
  },
};

const polygonBody = {
  id: "poly",
  source: "ai",
  type: "count",
  symbol: "specialty-fixture",
  typeCode: "SF",
  x: 62,
  y: 28,
  symbolBodyLocation: { x: 62, y: 28 },
  outlineSource: "vector",
  outline: {
    kind: "path",
    source: "vector",
    cx: 62,
    cy: 28,
    w: 1.0,
    h: 0.7,
    points: [
      { x: 61.5, y: 27.7 },
      { x: 62.5, y: 27.6 },
      { x: 62.55, y: 28.35 },
      { x: 62.0, y: 28.45 },
      { x: 61.45, y: 28.2 },
    ],
  },
};

const unknown = {
  id: "unknown",
  source: "ai",
  type: "count",
  symbol: "duplex",
  typeCode: "R",
  x: 12,
  y: 12,
  outlineSource: "text",
  outline: { kind: "circle", source: "text", cx: 12, cy: 12, r: 0.26, w: 0.52, h: 0.52 },
};

const receptacleRect = {
  id: "recept-rect",
  source: "ai",
  type: "count",
  symbol: "duplex",
  typeCode: "R",
  abbr: "R",
  x: 18,
  y: 44,
  symbolBodyLocation: { x: 18, y: 44 },
  outlineSource: "vector",
  // Elongated cover plate — must NOT become a forced oval.
  outline: { kind: "rect", source: "vector", cx: 18, cy: 44, w: 0.55, h: 0.28, points: [] },
};

const paintTroffer = paintDeviceOutline(troffer);
const paintCan = paintDeviceOutline(can);
const paintPoly = paintDeviceOutline(polygonBody);
const paintUnknown = paintDeviceOutline(unknown);
const paintRecept = paintDeviceOutline(receptacleRect);

assert(paintTroffer?.kind === "rect", "rectangular fixture paints as rect, not oval");
assert(paintTroffer.w > paintTroffer.h, "troffer fill keeps fixture aspect");
assert(paintCan?.kind === "circle", "circular can paints as circle kind");
assert(paintPoly?.kind === "path", "irregular symbol paints as polygon path");
assert(paintUnknown === null, "unknown/text geometry is not given a substitute oval");
assert(markHasUncertainPaintBoundary(unknown), "unknown geometry is flagged for review");
assert(paintRecept?.kind === "rect", "elongated receptacle body stays a rect — no forced oval");

const kinds = new Set([paintTroffer.kind, paintCan.kind, paintPoly.kind]);
assert(kinds.size === 3, "different symbol shapes produce different fill geometries");

const measuredTroffer = displayDeviceOutline(troffer);
const measuredCan = displayDeviceOutline(can);
assert(measuredTroffer && measuredCan, "measured bodies exist for size comparison");
assert(
  Math.abs(measuredTroffer.w - measuredCan.w) > 0.2
    || Math.abs(measuredTroffer.h - measuredCan.h) > 0.2,
  "fills are not a universal same-size marker",
);

const canRadii = ellipseRadiiFromOutline(measuredCan);
assert(
  Math.abs(canRadii.rx - measuredCan.w / 2) < 1e-9
    && Math.abs(canRadii.ry - measuredCan.h / 2) < 1e-9,
  "circle fill uses measured w/h ellipse radii, not a single fixed r",
);
const cssRx = (canRadii.rx / 100) * pagePt.width;
const cssRy = (canRadii.ry / 100) * pagePt.height;
assert(Math.abs(cssRx - cssRy) / Math.max(cssRx, cssRy) < 0.02,
  "PDF circle with unequal percent extents renders circular on the page");

// Forced equal percent radii would oval on screen — reject that pattern.
const badOval = ellipseRadiiFromOutline({ kind: "circle", r: 0.36, w: 0.72, h: 0.72 });
const badCssRx = (badOval.rx / 100) * pagePt.width;
const badCssRy = (badOval.ry / 100) * pagePt.height;
assert(Math.abs(badCssRx - badCssRy) / Math.max(badCssRx, badCssRy) > 0.1,
  "equal percent w=h correctly diagnosed as screen-oval on landscape (why we preserve extents)");

// circlePaintOutlineFromBody must not collapse extents.
const promoted = circlePaintOutlineFromBody({
  kind: "rect",
  source: "vector",
  cx: 40,
  cy: 22,
  w: 0.64,
  h: 0.62,
}, null);
assert(promoted?.kind === "circle", "near-square can rect may promote to circle");
assert(Math.abs(promoted.w - 0.64) < 1e-9 && Math.abs(promoted.h - 0.62) < 1e-9,
  "promotion preserves asymmetric percent extents");

const forced = circlePaintOutlineFromBody({
  kind: "rect",
  source: "vector",
  cx: 18,
  cy: 44,
  w: 0.55,
  h: 0.28,
}, "circle");
assert(forced === null, "forced circle hint alone cannot oval an elongated rect");

// Reject generic fixed chip radius as the AI paint size for measured bodies.
assert(paintCan && ellipseRadiiFromOutline(paintCan).rx > DEVICE_CHIP_R,
  "measured can fill is larger than the legacy fixed chip radius");
assert(!(paintTroffer.w === paintCan.w && paintTroffer.h === paintCan.h),
  "troffer and can fills do not share identical dimensions");


const wideMeasuredFixture = {
  ...troffer,
  id: "wide-native",
  outline: { kind: "rect", source: "vector", cx: 55, cy: 30, w: 2.4, h: 0.7, points: [] },
};
const fullNativeFill = paintDeviceOutline(wideMeasuredFixture);
assert(fullNativeFill?.kind === "rect", "large trusted fixture keeps its rectangular CAD perimeter");
assert(fullNativeFill?.w > 2.3 && fullNativeFill?.h > 0.65,
  "trusted fixture is not reduced to the legacy 1.65-percent chip");
const unsafeRoomSized = { ...wideMeasuredFixture, outline: { kind: "rect", source: "vector", cx: 55, cy: 30, w: 12, h: 8, points: [] } };
assert(paintDeviceOutline(unsafeRoomSized) === null, "room-sized geometry must never be painted as a symbol");

if (!process.exitCode) console.log("true symbol fill checks passed");
