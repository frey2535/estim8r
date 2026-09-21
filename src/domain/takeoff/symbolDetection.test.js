import { paletteForTrade } from "./trades.js";
import { buildAiMarks, matchTradeSymbol } from "./aiTakeoff.js";
import { deviceOutline, hitTestDeviceFill } from "./deviceStyles.js";
import {
  isCanDeviceText,
  isReferenceCallout,
  shouldAcceptPlanToken,
  snapFillToDevice,
} from "./symbolDetection.js";

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
      { text: "2", x: 30, y: 40 },
      { text: "CAN", x: 31.2, y: 40 },
    ],
  }],
});
const canMark = cans.marks.find((mark) => mark.type === "count");
assert(canMark && /can|downlight/i.test(`${canMark.symbol} ${canMark.symbolLabel}`), `cans resolve to a can, got ${canMark?.symbol}`);
assert(deviceOutline(canMark).kind === "circle", "can lights use a circular fill");
assert(deviceOutline({ symbol: "2x4", abbr: "2x4", symbolLabel: "2x4 troffer" }).kind === "rect", "2x4 troffers stay rectangular");

const snapped = snapFillToDevice({ x: 22, y: 36 }, "rect");
assert(snapped.x !== 22 || snapped.y !== 36, "fill snaps off the text tag toward the device");
assert(hitTestDeviceFill(canMark, { x: canMark.x, y: canMark.y }), "every counted device is selectable");
const selected = deviceOutline(canMark, 0.55, { selected: true });
const idle = deviceOutline(canMark, 0.55);
assert(selected.r > idle.r, "selected device enlarges");

if (!process.exitCode) console.log("symbol detection checks passed");
