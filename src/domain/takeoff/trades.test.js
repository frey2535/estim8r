import { paletteForTrade, symbolsForSelectedTrade, symbolPatchFromCatalog, tradeIdForSymbol } from "./trades.js";

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

const leakedDrawing = [
  { id: "legend:wc", label: "Water closet", abbr: "WC", takeoffCategory: "Equipment", category: "From drawing", source: "legend" },
  { id: "legend:ahu", label: "Air handling unit", abbr: "AHU", takeoffCategory: "Equipment", category: "From drawing", source: "legend" },
  { id: "legend:r", label: "Duplex receptacle", abbr: "R", takeoffCategory: "Equipment", category: "From drawing", source: "legend" },
];
assert(tradeIdForSymbol(leakedDrawing[0]) === "plumbing", "drawing WC is plumbing even when tagged Equipment");
const electricalFromLeaks = symbolsForSelectedTrade("electrical", leakedDrawing);
assert(!electricalFromLeaks.some((item) => item.id === "legend:wc" || item.id === "legend:ahu"), "electrical dropdown drops other-trade legend items tagged Equipment");
assert(electricalFromLeaks.some((item) => item.id === "legend:r"), "electrical dropdown keeps electrical legend items");

if (!process.exitCode) console.log("trade palette checks passed");
