import { paletteForTrade, symbolsForSelectedTrade, symbolsOnDrawingForTrade, symbolPatchFromCatalog, tradeIdForSymbol, tradeIdFromLabel } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const electrical = paletteForTrade("electrical");
assert(electrical.symbols.every((item) => ["Receptacles", "Lighting", "Switches", "Panels / MCC", "Equipment", "Raceway", "Low Voltage"].includes(item.category)), "electrical palette is electrical devices only");
assert(electrical.symbols.some((item) => item.id === "duplex"), "electrical still has receptacles");
assert(!electrical.symbols.some((item) => item.id === "wc" || item.id === "ahu-m"), "electrical does not list plumbing or mechanical devices");

const plumbing = paletteForTrade("plumbing");
assert(plumbing.symbols.every((item) => item.category === "Plumbing"), "plumbing palette is plumbing devices only");
assert(plumbing.symbols.some((item) => item.id === "wc"), "plumbing has water closets");
assert(!plumbing.symbols.some((item) => item.id === "duplex" || item.id === "2x4"), "plumbing does not list electrical devices");

const mechanical = paletteForTrade("mechanical");
assert(mechanical.symbols.every((item) => item.category === "Mechanical"), "mechanical palette is mechanical devices only");
assert(!mechanical.categories.includes("Receptacles"), "mechanical category list does not include electrical categories");

const mixedDrawing = [
  { id: "wc-d", label: "Water closet (drawing)", abbr: "WC", takeoffCategory: "Plumbing", category: "From drawing" },
  { id: "dup-d", label: "Duplex (drawing)", abbr: "R", takeoffCategory: "Receptacles", category: "From drawing" },
];
const plumbingDropdown = symbolsForSelectedTrade("plumbing", mixedDrawing);
assert(plumbingDropdown.some((item) => item.id === "wc" || item.id === "wc-d"), "plumbing dropdown includes plumbing devices");
assert(plumbingDropdown.every((item) => item.category === "Plumbing" || item.takeoffCategory === "Plumbing"), "plumbing dropdown is plumbing only");
assert(!plumbingDropdown.some((item) => item.id === "duplex" || item.id === "dup-d" || item.id === "2x4"), "plumbing dropdown excludes electrical devices");

const electricalDropdown = symbolsForSelectedTrade("electrical", mixedDrawing);
assert(electricalDropdown.some((item) => item.id === "duplex" || item.id === "dup-d"), "electrical dropdown includes receptacles");
assert(!electricalDropdown.some((item) => item.id === "wc" || item.id === "wc-d" || item.id === "ahu-m"), "electrical dropdown excludes plumbing and mechanical");

const lightingOnly = symbolsForSelectedTrade("electrical", mixedDrawing, { category: "Lighting" });
assert(lightingOnly.every((item) => item.category === "Lighting"), "category filter stays inside the selected trade");
assert(!lightingOnly.some((item) => item.id === "duplex" || item.id === "wc"), "lighting list does not include receptacles or plumbing");

const patch = symbolPatchFromCatalog(electrical.symbols.find((item) => item.id === "duplex"));
assert(patch.symbol === "duplex" && patch.category === "Receptacles", "catalog patch keeps trade category");

const otherTradeIds = ["wc", "lav", "ahu-m", "pump", "mh", "col", "smoke", "fa", "facp", "reader", "ddc", "ahu", "cu"];
const electricalAll = symbolsForSelectedTrade("electrical");
assert(electricalAll.every((item) => item.trade === "electrical"), "electrical dropdown stamps trade=electrical");
assert(electricalAll.every((item) => !otherTradeIds.includes(item.id)), "electrical dropdown excludes other-trade catalog ids");
assert(!electricalAll.some((item) => ["HVAC", "Fire Alarm", "Access Control", "Plumbing", "Mechanical", "Civil", "Structural"].includes(item.category)), "electrical dropdown has no other-trade categories");
assert(electricalAll.some((item) => item.id === "vf" && item.abbr === "VF" && item.trade === "electrical"), "electrical catalog includes vent fans");
assert(electricalAll.some((item) => item.id === "ef" && item.abbr === "EF" && item.trade === "electrical"), "electrical catalog includes exhaust fans");
assert(!paletteForTrade("hvac").symbols.some((item) => item.id === "vf" || item.id === "ef"), "HVAC palette does not steal VF/EF");
assert(tradeIdFromLabel("Vent fan") === "electrical" && tradeIdFromLabel("Exhaust fan") === "electrical", "fan labels are electrical");
assert(tradeIdFromLabel("VF") === "electrical" && tradeIdFromLabel("EF") === "electrical", "VF/EF type codes are electrical");
assert(tradeIdForSymbol({ id: "legend:vf", label: "Vent fan", abbr: "VF", takeoffCategory: "Equipment", category: "From drawing", source: "legend" }) === "electrical", "drawing VF stays electrical");
assert(tradeIdForSymbol({ id: "legend:ef", label: "Exhaust fan", abbr: "EF", takeoffCategory: "Equipment", category: "From drawing", source: "legend" }) === "electrical", "drawing EF stays electrical");

const leakedDrawing = [
  { id: "legend:wc", label: "Water closet", abbr: "WC", takeoffCategory: "Equipment", category: "From drawing", source: "legend" },
  { id: "legend:ahu", label: "Air handling unit", abbr: "AHU", takeoffCategory: "Equipment", category: "From drawing", source: "legend" },
  { id: "legend:r", label: "Duplex receptacle", abbr: "R", takeoffCategory: "Equipment", category: "From drawing", source: "legend" },
];
assert(tradeIdForSymbol(leakedDrawing[0]) === "plumbing", "drawing WC is plumbing even when tagged Equipment");
const electricalFromLeaks = symbolsForSelectedTrade("electrical", leakedDrawing);
assert(!electricalFromLeaks.some((item) => item.id === "legend:wc" || item.id === "legend:ahu"), "electrical dropdown drops other-trade legend items tagged Equipment");
assert(electricalFromLeaks.some((item) => item.id === "legend:r"), "electrical palette matching can still see electrical legend aliases");

const planMarks = [
  { id: "m1", type: "count", sheet: 2, trade: "electrical", symbol: "2x4", symbolLabel: "Type 1 2x4 troffer", abbr: "1", typeCode: "1", category: "Lighting" },
  { id: "m2", type: "count", sheet: 2, trade: "electrical", symbol: "2x4", symbolLabel: "Type 1 2x4 troffer", abbr: "1", typeCode: "1", category: "Lighting" },
  { id: "m3", type: "count", sheet: 2, trade: "electrical", symbol: "duplex", symbolLabel: "Duplex receptacle", abbr: "R", category: "Receptacles" },
  { id: "m4", type: "count", sheet: 2, trade: "plumbing", symbol: "wc", symbolLabel: "Water closet", abbr: "WC", category: "Plumbing" },
  { id: "m5", type: "count", sheet: 8, source: "legend", symbol: "legend:r", symbolLabel: "Legend duplex", abbr: "R", category: "Receptacles" },
  { id: "m6", type: "count", sheet: 9, trade: "electrical", symbol: "2x4", symbolLabel: "Schedule type only", abbr: "1E", category: "Lighting" },
];
const pageKinds = { 2: "drawing", 8: "legend", 9: "lighting-schedule" };
const onPlan = symbolsOnDrawingForTrade("electrical", planMarks, { pageKinds });
assert(onPlan.every((item) => item.trade === "electrical"), "drawing dropdown stays on the selected trade");
assert(onPlan.some((item) => item.id === "2x4") && onPlan.some((item) => item.id === "duplex"), "drawing dropdown lists types found on the plan");
assert(!onPlan.some((item) => item.id === "legend:r" || item.label === "Legend duplex" || item.label === "Schedule type only"), "drawing dropdown excludes legend and schedule sheets");
assert(!onPlan.some((item) => item.id === "wc"), "drawing dropdown excludes other-trade plan devices");
assert(!onPlan.some((item) => item.id === "gfci" || item.id === "2x2"), "drawing dropdown does not list catalog types that are not on the plan");

const fanPlanMarks = [
  { id: "vf1", type: "count", sheet: 2, trade: "electrical", symbol: "vf", symbolLabel: "Vent fan", abbr: "VF", typeCode: "VF", category: "Equipment" },
  { id: "ef1", type: "count", sheet: 2, trade: "electrical", symbol: "ef", symbolLabel: "Exhaust fan", abbr: "EF", typeCode: "EF", category: "Equipment" },
  { id: "vf-legend", type: "count", sheet: 8, source: "legend", symbol: "legend:vf", symbolLabel: "Vent fan", abbr: "VF", category: "Equipment" },
];
const fansOnPlan = symbolsOnDrawingForTrade("electrical", fanPlanMarks, { pageKinds });
assert(fansOnPlan.some((item) => item.id === "vf") && fansOnPlan.some((item) => item.id === "ef"), "drawing dropdown lists VF and EF found on the plan");
assert(!fansOnPlan.some((item) => item.id === "legend:vf"), "drawing dropdown excludes legend-only VF rows");
assert(fansOnPlan.every((item) => item.trade === "electrical"), "plan fans stay on the electrical trade");

if (!process.exitCode) console.log("trade palette checks passed");
