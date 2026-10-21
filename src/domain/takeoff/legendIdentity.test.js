import { entryFamily, nearbyLegendEntry } from "./legendGeometry.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const dictionary = {
  entries: [
    { code: "WP", symbol: { label: "Weatherproof receptacle", takeoffCategory: "Receptacles", category: "From drawing" } },
    { code: "1", symbol: { label: "Type 1 lighting fixture", takeoffCategory: "Lighting", category: "From drawing" } },
    { code: "OS", symbol: { label: "Occupancy sensor", takeoffCategory: "Lighting", category: "From drawing" } },
  ],
};

assert(entryFamily(dictionary.entries[0]) === "power", "WP is a power family symbol");
assert(entryFamily(dictionary.entries[1]) === "lighting", "Type 1 is a lighting family symbol");
assert(entryFamily(dictionary.entries[2]) === "lighting", "OS occupancy sensor is lighting, not power");

const tokens = [
  { text: "1", x: 20.4, y: 30.1 },
  { text: "WP", x: 20.9, y: 30.15 },
];
const stolen = nearbyLegendEntry({ x: 20.2, y: 30 }, tokens, dictionary, { radius: 1.35 });
assert(stolen?.entry?.code === "1", "without a plan type, a closer 1 still matches");

const powerHit = nearbyLegendEntry({ x: 20.2, y: 30 }, tokens, dictionary, {
  radius: 1.35,
  planType: "power",
  anchorFamily: "power",
});
assert(powerHit?.entry?.code !== "1", `nearby circuit/type 1 must not relabel a power glyph, got ${powerHit?.entry?.code || "null"}`);
assert(powerHit?.entry?.code === "WP", `power sheets keep the receptacle identity, got ${powerHit?.entry?.code || "null"}`);

const lightingHit = nearbyLegendEntry({ x: 20.4, y: 30.1 }, tokens, dictionary, {
  radius: 1.35,
  planType: "lighting",
  anchorFamily: "lighting",
});
assert(lightingHit?.entry?.code === "1", "lighting sheets still read a nearby type 1");

if (!process.exitCode) console.log("legend identity checks passed");
