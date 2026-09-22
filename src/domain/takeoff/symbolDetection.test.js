import { paletteForTrade, symbolsOnDrawingForTrade } from "./trades.js";
import { buildAiMarks, legendDictionaryFromPages, matchTradeSymbol, shouldScan } from "./aiTakeoff.js";
import { layoutOverlayCallouts } from "./overlayLayout.js";
import { deviceOutline, hitTestDeviceFill } from "./deviceStyles.js";
import {
  isCanDeviceText,
  isLegendClusterToken,
  isReferenceCallout,
  isScheduleNoteContext,
  isTitleBlockLetter,
  persistedPlanDeviceCount,
  shouldAcceptPlanToken,
} from "./symbolDetection.js";
import { candidatesFromConstructedPaths, DRAW_CLOSE, DRAW_CUBIC, DRAW_LINE, DRAW_MOVE } from "./vectorSymbols.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(isReferenceCallout("R16.3"), "R16.3 is a revision/reference, not a fixture");
assert(isReferenceCallout("R34.3"), "R34.3 is a revision/reference, not a fixture");
assert(isReferenceCallout("16.3"), "decimal 16.3 is not a type code");
assert(isReferenceCallout("E1.01"), "sheet id is not a device");
assert(!isReferenceCallout("1E"), "type 1E stays a fixture type");
assert(!isReferenceCallout("GFI"), "GFI is a device");
assert(!shouldAcceptPlanToken({ text: "R16.3", x: 20, y: 20 }), "reject R16.3 on the sheet");
assert(!shouldAcceptPlanToken({ text: "3", x: 88, y: 12 }, [{ text: "R34", x: 86, y: 12 }]), "reject a digit hanging off R34.3");
assert(shouldAcceptPlanToken({ text: "1E", x: 24, y: 40 }), "accept a real type 1E on the plan");
assert(shouldAcceptPlanToken({ text: "R", x: 40, y: 50 }, [
  { text: "R", x: 40, y: 50 },
  { text: "GFI", x: 52, y: 48 },
]), "a legend type R on the plan is not a revision prefix");
assert(isTitleBlockLetter({ text: "E", x: 90, y: 90 }), "title-block E is chrome, not a device");
assert(isTitleBlockLetter({ text: "R", x: 88, y: 10 }), "revision-band R is chrome");
assert(!isTitleBlockLetter({ text: "LP", x: 72, y: 18 }), "a lighting panel on the plan is not title-block chrome");
assert(isLegendClusterToken({ text: "R", x: 10, y: 82 }, [
  { text: "LEGEND", x: 12, y: 78 },
  { text: "R", x: 10, y: 82 },
  { text: "DUPLEX", x: 16, y: 82 },
]), "inset legend rows are not plan devices");
assert(isScheduleNoteContext({ text: "1", x: 30, y: 10 }, [
  { text: "SEE", x: 18, y: 10 },
  { text: "TYPE", x: 24, y: 10 },
  { text: "1", x: 30, y: 10 },
  { text: "SCHEDULE", x: 38, y: 10 },
]), "SEE TYPE 1 SCHEDULE is a note, not a fixture");
assert(!isScheduleNoteContext({ text: "GFI", x: 40, y: 50 }, [{ text: "TYP", x: 44, y: 50 }]), "TYP next to a real device is not dropped");
assert(!shouldScan({ kind: "legend", tokens: Array.from({ length: 120 }, (_, index) => ({ text: `R${index}` })) }, "electrical"), "large legends are never counted as plan sheets");
assert(!shouldScan({ kind: "lighting-schedule", tokens: [{ text: "F1" }] }, "electrical"), "schedule sheets are never counted");
assert(isCanDeviceText("Type 2 6\" can"), "can copy is detected");
assert(isCanDeviceText("LED downlight"), "downlight copy is detected");
assert(!isCanDeviceText("Type 1 2x4 LED troffer"), "a troffer is not a can");

const electrical = paletteForTrade("electrical");
assert(matchTradeSymbol("R16.3", electrical.symbols) == null, "R16.3 does not match a light");
assert(matchTradeSymbol("R34.3", electrical.symbols) == null, "R34.3 does not match a light");
assert(matchTradeSymbol("2'-4\"", electrical.symbols) == null, "a dimension is not a 2x4");

const falsePos = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "1", type: "1", label: "Type 1 2x4 troffer", takeoffCategory: "Lighting", category: "From drawing" },
    { abbr: "1E", type: "1E", label: "Type 1E 2x4 emergency", takeoffCategory: "Lighting", category: "From drawing" },
    { abbr: "3", type: "3", label: "Type 3 2x4 troffer", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    page: 1,
    kind: "drawing",
    tokens: [
      { text: "ELECTRICAL LIGHTING PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "R16.3", x: 18, y: 8 },
      { text: "R34.3", x: 84, y: 16 },
      { text: "R", x: 82, y: 20 },
      { text: "34.3", x: 85, y: 20 },
      { text: "3", x: 86, y: 21 },
      { text: "1E", x: 22, y: 36 },
      { text: "GFI", x: 40, y: 50 },
    ],
  }],
});
const counts = falsePos.marks.filter((mark) => mark.type === "count");
assert(!counts.some((mark) => /R16|R34|16\.3|34\.3/i.test(`${mark.typeCode} ${mark.abbr} ${mark.x}`)), "revision callouts are not counted");
assert(!counts.some((mark) => mark.x >= 80 && mark.typeCode === "3"), "the 3 in R34.3 is not a type 3 fixture");
assert(counts.some((mark) => mark.typeCode === "1E"), "real type 1E on the plan is still counted");
assert(counts.some((mark) => mark.symbol === "gfci"), "receptacles stay selectable counts");
assert(counts.every((mark) => mark.outlineSource === "text" && mark.detectSource === "original-pdf"), "text-only counts stay visible and were read from the original PDF");
assert(counts.every((mark) => mark.reviewStatus === "pending"), "new AI counts stay in the accuracy review queue");

const canPaths = candidatesFromConstructedPaths([{
  ctm: [1, 0, 0, 1, 0, 0],
  drawOps: [
    DRAW_MOVE, 29.4, 40.55,
    DRAW_CUBIC, 29.4, 40.85, 29.65, 41.1, 29.95, 41.1,
    DRAW_CUBIC, 30.25, 41.1, 30.5, 40.85, 30.5, 40.55,
    DRAW_CUBIC, 30.5, 40.25, 30.25, 40, 29.95, 40,
    DRAW_CUBIC, 29.65, 40, 29.4, 40.25, 29.4, 40.55,
    DRAW_CLOSE,
  ],
}], (x, y) => ({ x, y }));
const cans = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "2", type: "2", label: "Type 2 6\" LED can downlight", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    page: 1,
    kind: "drawing",
    tokens: [
      { text: "ELECTRICAL LIGHTING PLAN", x: 80, y: 88 },
      { text: "E1.01", x: 92, y: 94 },
      { text: "2", x: 31.1, y: 40.5 },
      { text: "CAN", x: 32.2, y: 40.5 },
    ],
    paths: canPaths,
  }],
});
const canMark = cans.marks.find((mark) => mark.type === "count");
assert(canMark && /can|downlight/i.test(`${canMark.symbol} ${canMark.symbolLabel}`), `cans resolve to a can, got ${canMark?.symbol}`);
assert(canMark.outlineSource === "vector", "can fill comes from the extracted circle, not a generic glyph");
assert(deviceOutline(canMark).kind === "circle", "can lights use the extracted circular fill");
assert(Math.abs(canMark.x - canPaths[0].cx) < 0.05, "can count sits on the extracted symbol, not a nudged tag");
assert(deviceOutline({ symbol: "2x4", abbr: "2x4", symbolLabel: "2x4 troffer" }).kind === "rect", "2x4 troffers stay rectangular");

const trofferPaths = candidatesFromConstructedPaths([{
  ctm: [1, 0, 0, 1, 0, 0],
  drawOps: [
    DRAW_MOVE, 20, 36,
    DRAW_LINE, 22.1, 36,
    DRAW_LINE, 22.1, 37.05,
    DRAW_LINE, 20, 37.05,
    DRAW_CLOSE,
  ],
}], (x, y) => ({ x, y }));
const troffers = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "1E", type: "1E", label: "Type 1E 2x4 emergency", takeoffCategory: "Lighting", category: "From drawing" },
  ],
  pages: [{
    page: 1,
    kind: "drawing",
    tokens: [
      { text: "ELECTRICAL LIGHTING PLAN", x: 80, y: 88 },
      { text: "1E", x: 22.4, y: 36.5 },
    ],
    paths: trofferPaths,
  }],
});
const troffer = troffers.marks.find((mark) => mark.type === "count");
assert(troffer?.outlineSource === "vector" && deviceOutline(troffer).kind === "rect", "troffer fill is the extracted rectangle");
assert(Math.abs(deviceOutline(troffer).w - trofferPaths[0].w) < 0.05, "troffer width is the drawn outline, not a smaller generic box");

assert(hitTestDeviceFill(canMark, { x: canMark.x, y: canMark.y }), "every counted device is selectable");
assert(hitTestDeviceFill(troffer, { x: troffer.x, y: troffer.y }), "extracted troffers stay selectable");
const selected = deviceOutline(canMark, 0.55, { selected: true });
const idle = deviceOutline(canMark, 0.55);
assert(selected.r === idle.r, "selection does not enlarge the extracted outline");

assert(matchTradeSymbol("VF", electrical.symbols)?.id === "vf", "VF matches the electrical vent fan");
assert(matchTradeSymbol("EF", electrical.symbols)?.id === "ef", "EF matches the electrical exhaust fan");
assert(matchTradeSymbol("VENT FAN", electrical.symbols)?.id === "vf", "vent fan copy matches electrical");
assert(matchTradeSymbol("EXHAUST FAN", electrical.symbols)?.id === "ef", "exhaust fan copy matches electrical");

const fanPlan = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "VF", type: "VF", label: "Vent fan", takeoffCategory: "Equipment", category: "From drawing", source: "legend", page: 8 },
    { abbr: "EF", type: "EF", label: "Exhaust fan", takeoffCategory: "Equipment", category: "From drawing", source: "legend", page: 8 },
  ],
  pages: [
    {
      page: 2,
      kind: "drawing",
      tokens: [
        { text: "ELECTRICAL POWER PLAN", x: 80, y: 88 },
        { text: "E1.02", x: 92, y: 94 },
        { text: "VF", x: 22, y: 36 },
        { text: "VF", x: 40, y: 44 },
        { text: "EF", x: 28, y: 52 },
        { text: "GFI", x: 48, y: 50 },
      ],
    },
    {
      page: 8,
      kind: "legend",
      tokens: [
        { text: "ELECTRICAL LEGEND", x: 20, y: 12 },
        { text: "VF", x: 12, y: 20 },
        { text: "VENT", x: 18, y: 20 },
        { text: "FAN", x: 24, y: 20 },
        { text: "EF", x: 12, y: 24 },
        { text: "EXHAUST", x: 18, y: 24 },
        { text: "FAN", x: 28, y: 24 },
      ],
    },
  ],
});
const fanCounts = fanPlan.marks.filter((mark) => mark.type === "count");
const vfMarks = fanCounts.filter((mark) => mark.symbol === "vf");
const efMarks = fanCounts.filter((mark) => mark.symbol === "ef");
assert(vfMarks.length === 2, `VF on the plan is counted, got ${vfMarks.length}`);
assert(efMarks.length === 1, `EF on the plan is counted, got ${efMarks.length}`);
assert(vfMarks.every((mark) => mark.sheet === 2 && mark.trade === "electrical" && mark.category === "Equipment"), "VF counts are electrical equipment on the plan sheet");
assert(efMarks.every((mark) => mark.sheet === 2 && mark.trade === "electrical" && mark.category === "Equipment"), "EF counts are electrical equipment on the plan sheet");
assert(!fanCounts.some((mark) => mark.sheet === 8), "legend rows are not counted as plan devices");
const fanDropdown = symbolsOnDrawingForTrade("electrical", fanPlan.marks, { pageKinds: { 2: "drawing", 8: "legend" } });
assert(fanDropdown.some((item) => item.id === "vf") && fanDropdown.some((item) => item.id === "ef"), "Device/symbol dropdown lists VF and EF from the plan");
assert(!fanDropdown.some((item) => item.id === "2x4" || item.id === "downlight"), "dropdown stays drawing-only and does not invent extra types");
const fanOverlay = layoutOverlayCallouts({ devices: fanCounts, conduits: fanPlan.marks.filter((mark) => mark.tool === "conduit") });
assert(fanOverlay.deviceLabels.length === 0, "fan markers do not draw type-code text");

const glyphOps = [
  DRAW_MOVE, 22.2, 36.2,
  DRAW_LINE, 22.75, 36.2,
  DRAW_LINE, 22.75, 36.85,
  DRAW_LINE, 22.2, 36.85,
  DRAW_CLOSE,
];
const bodyOps = [
  DRAW_MOVE, 20, 36,
  DRAW_LINE, 22.1, 36,
  DRAW_LINE, 22.1, 37.05,
  DRAW_LINE, 20, 37.05,
  DRAW_CLOSE,
];
const mixedPaths = candidatesFromConstructedPaths([
  { ctm: [1, 0, 0, 1, 0, 0], drawOps: glyphOps },
  { ctm: [1, 0, 0, 1, 0, 0], drawOps: bodyOps },
], (x, y) => ({ x, y }));
const legendFirst = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: "R", type: "R", label: "Duplex receptacle", takeoffCategory: "Receptacles", category: "From drawing", source: "legend", page: 8 },
    { abbr: "1E", type: "1E", label: "Type 1E 2x4 emergency", takeoffCategory: "Lighting", category: "From drawing", source: "legend", page: 8 },
    { abbr: "E", type: "E", label: "Emergency light", takeoffCategory: "Lighting", category: "From drawing", source: "legend", page: 8 },
  ],
  pages: [
    {
      page: 2,
      kind: "drawing",
      tokens: [
        { text: "ELECTRICAL LIGHTING PLAN", x: 80, y: 88 },
        { text: "E1.01", x: 92, y: 94 },
        { text: "E", x: 90, y: 90 },
        { text: "R", x: 88, y: 12 },
        { text: "SEE", x: 18, y: 12 },
        { text: "TYPE", x: 24, y: 12 },
        { text: "1E", x: 30, y: 12 },
        { text: "SCHEDULE", x: 40, y: 12 },
        { text: "1E", x: 22.4, y: 36.5 },
        { text: "R", x: 40, y: 50 },
        { text: "GFI", x: 52, y: 48 },
        { text: "LEGEND", x: 10, y: 78 },
        { text: "R", x: 10, y: 82 },
        { text: "DUPLEX", x: 16, y: 82 },
        { text: "RECEPTACLE", x: 24, y: 82 },
        { text: "24", x: 48, y: 82 },
      ],
      paths: mixedPaths,
    },
    {
      page: 8,
      kind: "legend",
      tokens: [
        { text: "ELECTRICAL LEGEND", x: 20, y: 12 },
        { text: "E0.01", x: 92, y: 94 },
        { text: "R", x: 12, y: 20 },
        { text: "DUPLEX", x: 18, y: 20 },
        { text: "RECEPTACLE", x: 28, y: 20 },
        { text: "24", x: 50, y: 20 },
        { text: "1E", x: 12, y: 26 },
        { text: "2x4", x: 18, y: 26 },
        { text: "EMERGENCY", x: 26, y: 26 },
        { text: "E", x: 12, y: 32 },
        { text: "EMERGENCY", x: 18, y: 32 },
        { text: "LIGHT", x: 30, y: 32 },
        ...Array.from({ length: 90 }, (_, index) => ({ text: `NOTE ${index}`, x: 10, y: 10 + (index % 70) })),
      ],
    },
  ],
});
const legendCounts = legendFirst.marks.filter((mark) => mark.type === "count");
const type1e = legendCounts.filter((mark) => mark.typeCode === "1E");
const planR = legendCounts.filter((mark) => mark.typeCode === "R");
assert(!legendCounts.some((mark) => mark.sheet === 8), "legend rows and the printed qty 24 are not plan counts");
assert(!legendCounts.some((mark) => mark.x >= 86 || (mark.x >= 78 && mark.y >= 78)), "title-block letters are not markers");
assert(!legendCounts.some((mark) => mark.y <= 14 && /1E|2x4/i.test(`${mark.typeCode} ${mark.symbol}`)), "SEE TYPE 1E SCHEDULE is not a fixture");
assert(!legendCounts.some((mark) => mark.y >= 78 && mark.x <= 30), "inset legend rows on the plan are not counted");
assert(type1e.length === 1, `legend type 1E is found once on the plan, got ${type1e.length}`);
const fixtureBody = [...mixedPaths].sort((a, b) => (b.w * b.h) - (a.w * a.h))[0];
assert(Math.abs(type1e[0].x - fixtureBody.cx) < 0.08, "1E marker sits on the fixture geometry, not the type-tag glyph");
assert(type1e[0].outlineSource === "vector", "legend-matched 1E uses extracted geometry");
assert(planR.length === 1, `legend type R is found once on the plan, got ${planR.length}`);
assert(legendCounts.some((mark) => mark.symbol === "gfci"), "catalog GFI on the plan still counts");
assert(persistedPlanDeviceCount(legendFirst.marks, { 2: "drawing", 8: "legend" }) === legendCounts.length, "quote/estimate counts come from persisted plan detections");
assert(legendFirst.deviceCount === legendCounts.length, "AI deviceCount is the persisted drawing count, not the legend total");
assert(!/24/.test(legendFirst.summary) || legendFirst.deviceCount !== 24, "summary does not adopt the legend qty column");
const legendDict = legendDictionaryFromPages([
  { page: 8, kind: "legend", tokens: [{ text: "1E", x: 12, y: 26 }, { text: "2x4", x: 18, y: 26 }, { text: "R", x: 12, y: 20 }] },
], [
  { abbr: "1E", type: "1E", label: "Type 1E 2x4 emergency", takeoffCategory: "Lighting", category: "From drawing", source: "legend", page: 8 },
  { abbr: "R", type: "R", label: "Duplex receptacle", takeoffCategory: "Receptacles", category: "From drawing", source: "legend", page: 8 },
], electrical.symbols, "electrical");
assert(legendDict.entries.some((item) => item.code === "1E"), "legend dictionary records type 1E before the plan scan");
assert(legendDict.entries.some((item) => item.code === "R"), "legend dictionary records type R before the plan scan");
const legendDropdown = symbolsOnDrawingForTrade("electrical", legendFirst.marks, { pageKinds: { 2: "drawing", 8: "legend" } });
assert(legendDropdown.some((item) => item.id === "2x4" || item.id === "gfci"), "dropdown stays drawing-only");
assert(!legendDropdown.some((item) => String(item.id).startsWith("legend:")), "dropdown does not list legend-only rows");
assert(legendCounts.every((mark) => mark.trade === "electrical"), "counts stay on the selected trade");
assert(layoutOverlayCallouts({ devices: legendCounts }).deviceLabels.length === 0, "markers still have no type-code text");

if (!process.exitCode) console.log("symbol detection checks passed");
