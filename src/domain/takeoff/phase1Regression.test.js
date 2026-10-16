import { buildAiMarks } from "./aiTakeoff.js";
import { formatAccuracyReport, scoreDetections, scoreTakeoffAccuracy } from "./accuracyHarness.js";
import { legendHoverData } from "./legendHover.js";
import { bidDeviceMarks } from "./detectionRecord.js";
import { stressZoomPan } from "./takeoffQuality.js";
import { paletteForTrade } from "./trades.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const electrical = paletteForTrade("electrical");
const body = (cx, cy) => ({ cx, cy, w: 0.55, h: 0.7, kind: "rect", source: "vector" });
const wall = (cx, cy, w, h) => ({ cx, cy, w, h, kind: "line", source: "vector" });

const page = {
  page: 1,
  kind: "drawing",
  discipline: "electrical",
  title: "POWER FLOOR PLAN",
  sheetId: "E110",
  tokens: [
    { text: "POWER", x: 70, y: 88 },
    { text: "FLOOR", x: 76, y: 88 },
    { text: "PLAN", x: 82, y: 88 },
    { text: "E110", x: 88, y: 92 },
    { text: "WP", x: 30.42, y: 40.18 },
    { text: "12", x: 31.3, y: 41.4 },
  ],
  paths: [
    body(30, 40),
    body(46, 40),
    wall(58, 40, 14, 0.16),
    wall(58, 40, 0.16, 12),
  ],
};
const fixture = {
  groundTruthIndependence: "manual",
  drawingSymbols: [
    { id: "legend:wp", abbr: "WP", label: "Weatherproof receptacle", takeoffCategory: "Receptacles", source: "legend", page: 1 },
  ],
  pages: [page],
  groundTruth: [
    { sheet: 1, type: "WP", x: 30.42, y: 40.18, cx: 30, cy: 40, w: 0.55, h: 0.7, source: "manual", placementMeasured: true },
    { sheet: 1, type: "WP", x: 46, y: 40, cx: 46, cy: 40, w: 0.55, h: 0.7, source: "manual", placementMeasured: true, note: "unlabeled repeat" },
  ],
};

const score = scoreTakeoffAccuracy(fixture);
console.log(formatAccuracyReport(score));
assert(score.independence === "manual", "regression labels are manual");
assert(score.truth === 2, "regression case labels the tagged symbol and the unlabeled repeat");
assert(score.found === 1 && score.falseNegatives === 1, "current detector finds the tagged WP and misses the unlabeled repeat");
assert(score.classificationAccuracy === 1, "the found WP keeps the legend type");
assert(score.falsePositives === 0, "the wall crossing is not an extra bid device");
assert(score.claimPermitted === false, "a missed symbol blocks any accuracy claim");
const wallHits = bidDeviceMarks(buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: fixture.drawingSymbols,
  pages: [{ ...page, paths: [wall(58, 40, 14, 0.16), wall(58, 40, 0.16, 12)], tokens: page.tokens.filter((token) => token.text !== "WP") }],
  maxHomeruns: 4,
}).marks).filter((mark) => Math.hypot(mark.x - 58, mark.y - 40) < 2);
assert(wallHits.length === 0, `wall intersection was accepted as a device (${wallHits.length})`);

const circuitHighlight = scoreDetections({
  marks: [{ type: "count", sheet: 1, typeCode: "WP", x: 31.3, y: 41.4 }],
  groundTruth: [fixture.groundTruth[0]],
  independence: "manual",
});
assert(circuitHighlight.found === 1, "a nearby circuit number still locates the device for review");
assert(circuitHighlight.failedMarkers.length === 1, "a highlight on the circuit number is not the symbol body");

const hover = legendHoverData({
  type: "count",
  typeCode: "WP",
  legendCode: "WP",
  legendEntryId: "legend:wp",
  legendLabel: "Weatherproof receptacle",
  legendSource: "legend",
}, fixture.drawingSymbols, { planType: "power" });
assert(hover.code === "WP" && hover.verified !== false, "hover stays bound to the WP legend entry");
const wrongHover = legendHoverData({
  type: "count",
  typeCode: "12",
  abbr: "12",
}, fixture.drawingSymbols, { planType: "power" });
assert(!wrongHover.code || wrongHover.code !== "WP", "a circuit number must not inherit the WP legend description");

const zoomed = stressZoomPan();
assert(zoomed.ok === true, "zoom and pan samples stay finite inside the sheet limits");

if (!process.exitCode) console.log("phase 1 regression checks passed");
