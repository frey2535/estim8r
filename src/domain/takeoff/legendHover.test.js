import assert from "node:assert/strict";
import { legendEntryForMark, legendHoverData } from "./legendHover.js";

const symbols = [
  { id: "legend:1:normal", abbr: "1", label: "Type 1 LED troffer", category: "From drawing", takeoffCategory: "Lighting", source: "legend", page: 2 },
  { id: "legend:1e:emergency", abbr: "1E", label: "Type 1E emergency LED troffer", category: "From drawing", takeoffCategory: "Lighting", source: "legend", page: 2 },
  { id: "catalog:2x4", abbr: "1", label: "Generic 2x4 fixture", category: "Lighting" },
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

const ambiguousSharedId = { symbol: "2x4", symbolLabel: "Generic 2x4 fixture" };
assert.equal(legendEntryForMark(ambiguousSharedId, symbols, { planType: "lighting" }), null);
console.log("legend hover identity tests passed");
