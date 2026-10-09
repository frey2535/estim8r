import assert from "node:assert/strict";
import { legendEntryForMark, legendHoverData, paintedIdentity, shouldShowSymbolHover } from "./legendHover.js";

const symbols = [
  { id: "legend:1:normal", abbr: "1", label: "Type 1 LED troffer", category: "From drawing", takeoffCategory: "Lighting", source: "legend", page: 2 },
  { id: "legend:1e:emergency", abbr: "1E", label: "Type 1E emergency LED troffer", category: "From drawing", takeoffCategory: "Lighting", source: "legend", page: 2 },
  { id: "catalog:2x4", abbr: "1", label: "Generic 2x4 fixture", category: "Lighting" },
  { id: "legend:f2:fan", abbr: "F2", label: "Type F2 8' BAY CEILING FAN", category: "From drawing", takeoffCategory: "Lighting", source: "legend", page: 3 },
  { id: "legend:gfi", abbr: "GFI", label: "GFCI receptacle", category: "From drawing", takeoffCategory: "Receptacles", source: "legend", page: 4 },
];

const marked = {
  typeCode: "1E",
  abbr: "2x4",
  symbol: "2x4",
  legendEntryId: "legend:1e:emergency",
  legendCode: "1E",
  legendLabel: "Type 1E emergency LED troffer",
  legendCategory: "Lighting",
  legendSource: "legend",
  legendSourcePage: 2,
};
assert.equal(legendEntryForMark(marked, symbols, { planType: "lighting" })?.id, "legend:1e:emergency");
const data = legendHoverData(marked, symbols, { planType: "lighting" });
assert.equal(data.code, "1E");
assert.equal(data.label, "Type 1E emergency LED troffer");
assert.equal(data.page, 2);
assert.equal(data.verified, true);
assert.equal(shouldShowSymbolHover(marked), true);

const ambiguousSharedId = { symbol: "2x4", symbolLabel: "Generic 2x4 fixture" };
assert.equal(legendEntryForMark(ambiguousSharedId, symbols, { planType: "lighting" }), null);
assert.equal(shouldShowSymbolHover(ambiguousSharedId), false);

const paintedGfi = {
  typeCode: "GFI",
  abbr: "GFI",
  symbol: "gfci",
  legendCode: "GFI",
  legendLabel: "GFCI receptacle",
  legendCategory: "Receptacles",
  legendEntryId: "legend:gfi",
};
const gfiHover = legendHoverData(paintedGfi, symbols, { planType: "power" });
assert.equal(gfiHover.code, "GFI");
assert.equal(gfiHover.label, "GFCI receptacle");
assert.notEqual(gfiHover.code, "F2");
assert.equal(paintedIdentity(paintedGfi)?.code, "GFI");

const circuitOnly = {
  typeCode: "5",
  abbr: "5",
  symbol: "unknown",
  circuitTagLocation: { text: "5", x: 40.6, y: 22 },
};
assert.equal(paintedIdentity(circuitOnly), null);
assert.equal(shouldShowSymbolHover(circuitOnly), false);
assert.equal(legendHoverData(circuitOnly, symbols).code, "");

const unclassified = {
  objectKind: "unclassified-vector",
  requiresClassification: true,
  symbol: "unclassified-device",
  typeCode: "UNKNOWN",
  symbolLabel: "Unclassified device",
};
assert.equal(shouldShowSymbolHover(unclassified), false);
assert.equal(legendHoverData(unclassified, symbols).label, "Unclassified device");
assert.notEqual(legendHoverData(unclassified, symbols).code, "F2");

console.log("legend hover identity tests passed");
