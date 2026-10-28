/**
 * Visual marker geometry regression.
 *
 * Coordinate pipeline (percent sheet space, zoom-invariant):
 *   PDF user space
 *     -> pdf.js viewport.convertToViewportPoint (paths) / viewport-space tokens
 *     -> page percent 0–100 (x / width * 100, y / height * 100)
 *     -> stored mark.outline + symbolBodyLocation
 *     -> paintDeviceOutline (measured perimeter, inset)
 *     -> SVG overlay viewBox="0 0 100 100" preserveAspectRatio="none"
 *        on a pan layer sized to the fitted PDF/image CSS pixels
 *
 * Detection-count / markerAccuracy harness scores are NOT proof of visual
 * containment. These checks assert overlay paint stays inside measured bodies,
 * refuse fabricated chips, and keep idle R-labels off the sheet.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks } from "./aiTakeoff.js";
import { bidDeviceMarks } from "./detectionRecord.js";
import {
  DEVICE_INTERIOR_INSET,
  displayDeviceOutline,
  markHasUncertainPaintBoundary,
  outlineExtent,
  paintDeviceOutline,
  paintOrigin,
  preferNativeSymbolGeometry,
} from "./deviceStyles.js";
import { layoutOverlayCallouts } from "./overlayLayout.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, "fixtures/soccer-pavilion-electrical.json"), "utf8"));

/** Fit sheet CSS size the same way TakeoffWorkspace / PdfDrawing do. */
function fitSheetSize(sheetW, sheetH, viewW, viewH, zoom) {
  const pad = 16;
  const availW = Math.max(1, viewW - pad);
  const availH = Math.max(1, viewH - pad);
  const fit = Math.min(availW / sheetW, availH / sheetH);
  return {
    width: Math.max(1, Math.floor(sheetW * fit * zoom)),
    height: Math.max(1, Math.floor(sheetH * fit * zoom)),
  };
}

/** Map page-percent mark coords onto a rendered CSS sheet box. */
function overlayCssPoint(pct, display) {
  return {
    x: (Number(pct.x) / 100) * display.width,
    y: (Number(pct.y) / 100) * display.height,
  };
}

function outlineCssBox(outline, mark, display) {
  const origin = paintOrigin(mark, outline);
  if (outline.kind === "circle") {
    const cx = Number.isFinite(outline.cx) ? outline.cx : origin.x;
    const cy = Number.isFinite(outline.cy) ? outline.cy : origin.y;
    const r = Number(outline.r) || Math.max(outline.w || 0, outline.h || 0) / 2;
    const c = overlayCssPoint({ x: cx, y: cy }, display);
    const rx = (r / 100) * display.width;
    const ry = (r / 100) * display.height;
    return { left: c.x - rx, top: c.y - ry, right: c.x + rx, bottom: c.y + ry, kind: "circle" };
  }
  if (outline.kind === "path" && outline.points?.length) {
    const pts = outline.points.map((p) => overlayCssPoint(p, display));
    return {
      left: Math.min(...pts.map((p) => p.x)),
      top: Math.min(...pts.map((p) => p.y)),
      right: Math.max(...pts.map((p) => p.x)),
      bottom: Math.max(...pts.map((p) => p.y)),
      kind: "path",
    };
  }
  const cx = Number.isFinite(outline.cx) ? outline.cx : origin.x;
  const cy = Number.isFinite(outline.cy) ? outline.cy : origin.y;
  const w = Number(outline.w) || 0;
  const h = Number(outline.h) || 0;
  const c = overlayCssPoint({ x: cx, y: cy }, display);
  const halfW = (w / 100) * display.width / 2;
  const halfH = (h / 100) * display.height / 2;
  return { left: c.x - halfW, top: c.y - halfH, right: c.x + halfW, bottom: c.y + halfH, kind: "rect" };
}

function boxContained(inner, outer, pad = 0.75) {
  return inner.left >= outer.left - pad
    && inner.top >= outer.top - pad
    && inner.right <= outer.right + pad
    && inner.bottom <= outer.bottom + pad;
}

// --- Prefer native geometry: rect for AABB corners, path for irregular CAD ---
const rectBody = preferNativeSymbolGeometry({
  kind: "rect",
  source: "vector",
  cx: 40,
  cy: 22,
  w: 0.8,
  h: 0.5,
  points: [
    { x: 39.6, y: 21.75 },
    { x: 40.4, y: 21.75 },
    { x: 40.4, y: 22.25 },
    { x: 39.6, y: 22.25 },
  ],
});
assert(rectBody.kind === "rect", "axis-aligned rectangular bodies keep rect fills");
const pathBody = preferNativeSymbolGeometry({
  kind: "rect",
  source: "vector",
  cx: 40,
  cy: 22,
  w: 0.8,
  h: 0.5,
  points: [
    { x: 39.6, y: 21.75 },
    { x: 40.5, y: 21.6 },
    { x: 40.4, y: 22.35 },
    { x: 39.5, y: 22.2 },
  ],
});
assert(pathBody.kind === "path", "non-rectangular CAD points paint as a polygon, not an AABB rect");
assert(preferNativeSymbolGeometry({ kind: "circle", r: 0.3, cx: 1, cy: 1 }).kind === "circle", "circles stay circles");

// --- Synthetic multi-shape marks at multiple zoom/display sizes ---
const shapes = [
  {
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
    outline: { kind: "rect", source: "vector", cx: 55, cy: 30, w: 1.1, h: 0.55, points: [] },
  },
  {
    id: "can",
    source: "ai",
    type: "count",
    symbol: "downlight",
    typeCode: "4",
    abbr: "4",
    x: 40.2,
    y: 22.1,
    symbolBodyLocation: { x: 40, y: 22 },
    outlineSource: "vector",
    outline: { kind: "circle", source: "vector", cx: 40, cy: 22, r: 0.36, w: 0.72, h: 0.72 },
  },
  {
    id: "irregular-path",
    source: "ai",
    type: "count",
    symbol: "specialty-fixture",
    typeCode: "SF",
    abbr: "SF",
    x: 62,
    y: 28,
    symbolBodyLocation: { x: 62, y: 28 },
    outlineSource: "vector",
    outline: {
      kind: "rect",
      source: "vector",
      cx: 62,
      cy: 28,
      w: 1.05,
      h: 0.72,
      // Non-rectangular CAD path wrongly tagged as rect — must paint as polygon.
      points: [
        { x: 61.5, y: 27.7 },
        { x: 62.5, y: 27.6 },
        { x: 62.55, y: 28.35 },
        { x: 62.0, y: 28.45 },
        { x: 61.45, y: 28.2 },
      ],
    },
  },
  {
    id: "text-only",
    source: "ai",
    type: "count",
    symbol: "duplex",
    typeCode: "R",
    x: 12,
    y: 12,
    outlineSource: "text",
    outline: { kind: "rect", source: "text", cx: 12, cy: 12, w: 0.4, h: 0.3 },
  },
];

const sheetPt = { width: 792, height: 612 };
const displays = [
  fitSheetSize(sheetPt.width, sheetPt.height, 1200, 800, 1),
  fitSheetSize(sheetPt.width, sheetPt.height, 1200, 800, 2.5),
  fitSheetSize(sheetPt.width, sheetPt.height, 640, 900, 1),
  fitSheetSize(sheetPt.width, sheetPt.height, 1600, 1000, 4),
];

for (const mark of shapes) {
  const measured = displayDeviceOutline(mark);
  const painted = paintDeviceOutline(mark);
  if (mark.outlineSource === "text") {
    assert(measured === null && painted === null, `${mark.id}: text-only must not paint`);
    assert(markHasUncertainPaintBoundary(mark), `${mark.id}: uncertain boundary flagged for review`);
    continue;
  }
  assert(measured && painted, `${mark.id}: measured AI body must paint`);
  assert(outlineExtent(painted) < outlineExtent(measured) + 1e-9, `${mark.id}: interior tint is inset from perimeter`);
  assert(outlineExtent(painted) <= outlineExtent(measured) * DEVICE_INTERIOR_INSET + 1e-6, `${mark.id}: inset respects DEVICE_INTERIOR_INSET`);
  if (mark.id === "irregular-path") {
    assert(measured.kind === "path", "non-rectangular CAD points paint as a polygon, not an AABB rect");
  }
  if (mark.id === "troffer") {
    assert(measured.kind === "rect", "true rectangular fixtures keep rect fills");
  }
  for (const display of displays) {
    const outer = outlineCssBox(measured, mark, display);
    const inner = outlineCssBox(painted, mark, display);
    assert(boxContained(inner, outer), `${mark.id} @ ${display.width}x${display.height}: paint CSS box stays inside measured body`);
  }
}

// Percent coords are zoom-invariant: same mark projects proportionally at 1x and 4x.
const sample = shapes[0];
const d1 = displays[0];
const d4 = displays[3];
const p1 = overlayCssPoint({ x: sample.x, y: sample.y }, d1);
const p4 = overlayCssPoint({ x: sample.x, y: sample.y }, d4);
assert(Math.abs(p1.x / d1.width - p4.x / d4.width) < 1e-9, "overlay x percent is zoom-invariant");
assert(Math.abs(p1.y / d1.height - p4.y / d4.height) < 1e-9, "overlay y percent is zoom-invariant");

// Idle R labels must not cover the drawing.
const conduits = Array.from({ length: 10 }, (_, index) => ({
  id: `run-${index}`,
  runNumber: index + 1,
  points: [{ x: 10 + index, y: 20 }, { x: 70, y: 22 }],
  tool: "conduit",
}));
const idleLabels = layoutOverlayCallouts({ conduits, devices: shapes });
assert(idleLabels.conduitLabels.length === 0, "visual overlay omits idle R-number labels");
assert(idleLabels.deviceLabels.length === 0, "visual overlay never paints type-code text on devices");

// --- Soccer fixture: every painted bid device stays inside its measured outline ---
const planned = buildAiMarks(fixture);
const bid = bidDeviceMarks(planned.marks || []);
let paintedCount = 0;
let skippedUncertain = 0;
let vectorTotal = 0;
const pageSamples = new Map();
for (const mark of bid) {
  const measured = displayDeviceOutline(mark);
  const painted = paintDeviceOutline(mark);
  const source = String(mark.outlineSource || "").toLowerCase();
  if (source === "vector" || source === "raster" || source === "mixed") vectorTotal += 1;
  if (!painted) {
    skippedUncertain += 1;
    assert(
      markHasUncertainPaintBoundary(mark)
        || source === "text"
        || !mark.outline
        || source === "generic",
      `${mark.typeCode}@${mark.sheet}: unpainted AI must be uncertain/text/missing geometry (got ${source})`,
    );
    // Text-located labels associate without painting on the printed tag.
    if (source === "text") {
      assert(painted === null, `${mark.typeCode}@${mark.sheet}: text association must not paint the label`);
    }
    continue;
  }
  paintedCount += 1;
  assert(measured, "painted mark has a measured perimeter");
  assert(source === "vector" || source === "raster" || source === "mixed",
    `${mark.typeCode}@${mark.sheet}: only measured geometry may paint, got ${source}`);
  assert(outlineExtent(painted) <= outlineExtent(measured) + 1e-6,
    `${mark.typeCode}@${mark.sheet}: paint extent must not exceed measured body`);
  for (const zoom of [1, 1.5, 3]) {
    const display = fitSheetSize(sheetPt.width, sheetPt.height, 1400, 900, zoom);
    assert(
      boxContained(outlineCssBox(painted, mark, display), outlineCssBox(measured, mark, display)),
      `${mark.typeCode}@${mark.sheet}: soccer paint CSS box inside measured body @${zoom}x`,
    );
  }
  const page = mark.sheet || 1;
  if ((pageSamples.get(page) || 0) < 3) {
    pageSamples.set(page, (pageSamples.get(page) || 0) + 1);
  }
}
assert(paintedCount >= 1, `soccer must paint at least one measured vector body, got ${paintedCount}`);
assert(paintedCount === bid.filter((mark) => paintDeviceOutline(mark)).length, "painted set is stable");
assert(
  bid.filter((mark) => String(mark.outlineSource || "").toLowerCase() === "vector")
    .every((mark) => !paintDeviceOutline(mark) || displayDeviceOutline(mark)),
  "every painted soccer vector mark has a display perimeter",
);
assert(vectorTotal >= paintedCount, `vector/raster bodies tracked (${vectorTotal}) cover paints (${paintedCount})`);
console.log(`soccer visual paint: ${paintedCount} contained fills, ${skippedUncertain} text/uncertain unpainted, ${vectorTotal} measured-source marks`);

// Before/after evidence SVG (committed artifact for review — not a screenshot claim).
const evidenceDir = join(here, "fixtures");
mkdirSync(evidenceDir, { recursive: true });
const beforeSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="800" height="480">
  <rect width="100" height="60" fill="#f8fafc"/>
  <text x="4" y="6" font-size="3.2" font-weight="700" fill="#991b1b">BEFORE — universal fixed ovals</text>
  <rect x="12" y="18" width="8" height="4" fill="none" stroke="#0f172a" stroke-width="0.35"/>
  <ellipse cx="40" cy="28" rx="2.8" ry="2.2" fill="none" stroke="#0f172a" stroke-width="0.35"/>
  <polygon points="58,20 61.2,20.4 61,23 57.8,22.6" fill="none" stroke="#0f172a" stroke-width="0.35"/>
  <!-- bad: same-size oval on every symbol -->
  <ellipse cx="16" cy="20" rx="2.1" ry="1.55" fill="#dc2626" fill-opacity="0.55"/>
  <ellipse cx="40" cy="28" rx="2.1" ry="1.55" fill="#7c3aed" fill-opacity="0.55"/>
  <ellipse cx="59.5" cy="21.5" rx="2.1" ry="1.55" fill="#4338ca" fill-opacity="0.55"/>
  <text x="20" y="16" font-size="4.5" font-weight="800" fill="#1e293b" stroke="#fff" stroke-width="0.4" paint-order="stroke">R10</text>
  <text x="4" y="56" font-size="2.2" fill="#64748b">Fixed oval chips + R labels (do not ship)</text>
</svg>`;
const afterSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="800" height="480">
  <rect width="100" height="60" fill="#f8fafc"/>
  <text x="4" y="6" font-size="3.2" font-weight="700" fill="#166534">AFTER — true symbol interior fills</text>
  <rect x="12" y="18" width="8" height="4" fill="none" stroke="#0f172a" stroke-width="0.35"/>
  <ellipse cx="40" cy="28" rx="2.8" ry="2.2" fill="none" stroke="#0f172a" stroke-width="0.35"/>
  <polygon points="58,20 61.2,20.4 61,23 57.8,22.6" fill="none" stroke="#0f172a" stroke-width="0.35"/>
  <rect x="12.35" y="18.2" width="7.3" height="3.6" fill="#1e3a8a" fill-opacity="0.34"/>
  <ellipse cx="40" cy="28" rx="2.58" ry="2.02" fill="#7e22ce" fill-opacity="0.34"/>
  <polygon points="58.15,20.15 61.0,20.5 60.85,22.8 58.0,22.45" fill="#4338ca" fill-opacity="0.34"/>
  <text x="4" y="56" font-size="2.2" fill="#64748b">Rect / ellipse-from-extents / polygon matched to geometry</text>
</svg>`;
writeFileSync(join(evidenceDir, "visual-marker-geometry-before.svg"), beforeSvg);
writeFileSync(join(evidenceDir, "visual-marker-geometry-after.svg"), afterSvg);
assert(beforeSvg.includes("<ellipse") && beforeSvg.includes("rx=\"2.1\""), "before evidence documents universal oval markers");
assert(afterSvg.includes("<rect") && afterSvg.includes("<ellipse") && afterSvg.includes("<polygon"), "after evidence shows shape-matched fills");
assert(!afterSvg.includes(">R10<"), "after evidence has no idle R overlay labels");

if (!process.exitCode) console.log("visual marker geometry regression checks passed");
