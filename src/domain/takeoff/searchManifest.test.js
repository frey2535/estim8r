import assert from "node:assert/strict";
import { buildTradeSearchManifest, legendEntryAppliesToPlan } from "./searchManifest.js";

const entries = [
  { code: "L1", symbol: { id: "l1", label: "LED troffer", takeoffCategory: "Lighting", page: 1 }, prototype: { w: 1, h: 1 } },
  { code: "GFI", symbol: { id: "gfci", label: "GFCI receptacle", takeoffCategory: "Receptacles", page: 1 }, prototype: { w: 1, h: 1 } },
  { code: "SD", symbol: { id: "sd", label: "Smoke detector", takeoffCategory: "Fire Alarm", page: 1 }, prototype: { w: 1, h: 1 } },
];
assert.equal(legendEntryAppliesToPlan(entries[0], "electrical", "lighting"), true);
assert.equal(legendEntryAppliesToPlan(entries[1], "electrical", "lighting"), false);
assert.equal(legendEntryAppliesToPlan(entries[1], "electrical", "power"), true);
assert.equal(legendEntryAppliesToPlan(entries[2], "fire-alarm", "plan"), true);

const manifest = buildTradeSearchManifest({
  trade: "electrical",
  dictionary: { entries },
  pages: [
    { page: 2, sheetId: "E201", planType: "lighting" },
    { page: 3, sheetId: "E301", planType: "power" },
  ],
  marks: [
    { sheet: 2, trade: "electrical", type: "count", symbol: "l1", typeCode: "L1", reviewStatus: "accepted" },
    { sheet: 3, trade: "electrical", type: "count", symbol: "gfci", typeCode: "GFI", reviewStatus: "accepted" },
  ],
  shouldScanPage: () => true,
});
assert.equal(manifest.sheets[0].symbols.length, 1);
assert.equal(manifest.sheets[0].symbols[0].code, "L1");
assert.equal(manifest.sheets[0].symbols[0].foundCount, 1);
assert.equal(manifest.sheets[1].symbols.length, 1);
assert.equal(manifest.sheets[1].symbols[0].code, "GFI");
assert.equal(manifest.sheets[1].symbols[0].foundCount, 1);
console.log("search manifest tests passed");
