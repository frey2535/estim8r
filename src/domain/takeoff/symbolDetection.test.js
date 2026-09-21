import { paletteForTrade } from "./trades.js";
import { buildAiMarks, matchTradeSymbol } from "./aiTakeoff.js";
import { deviceOutline, hitTestDeviceFill } from "./deviceStyles.js";
import {
  isCanDeviceText,
  isReferenceCallout,
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

if (!process.exitCode) console.log("symbol detection checks passed");
