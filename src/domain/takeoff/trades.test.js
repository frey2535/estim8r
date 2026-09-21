import { paletteForTrade } from "./trades.js";

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

if (!process.exitCode) console.log("trade palette checks passed");
