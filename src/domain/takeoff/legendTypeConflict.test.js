import { nearbyLegendEntry, recoverMissedLegendSymbols } from "./legendGeometry.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const one = { code: "1", symbol: { id: "type-1", label: "Type 1", category: "Lighting" }, prototype: { cx:0,cy:0,w:1,h:1,kind:"rect" } };
const oneE = { code: "1E", symbol: { id: "type-1e", label: "Type 1 emergency", category: "Lighting" }, prototype: { cx:0,cy:0,w:1,h:1,kind:"rect" } };
const dictionary = { entries: [one, oneE] };

const nearby = nearbyLegendEntry({ x: 20, y: 20 }, [
  { text: "1", x: 20.4, y: 20.1 },
  { text: "1E", x: 30, y: 30 },
], dictionary);
assert(nearby?.entry?.code === "1", "nearest printed legend type wins over a visually similar emergency prototype");

const page = {
  page: 1,
  kind: "drawing",
  planType: "lighting",
  tokens: [{ text: "1", x: 20.4, y: 20.1 }],
  paths: [
    { cx:20,y:20,w:1,h:1,kind:"rect",source:"vector",outline:{kind:"rect",source:"vector",w:1,h:1} },
  ],
};
const recovered = recoverMissedLegendSymbols(page, dictionary, { planType: "lighting" });
assert(!recovered.some((hit) => hit.entry?.code === "1E"), "1E recovery cannot override nearby printed type 1");

if (!process.exitCode) console.log("legend type conflict checks passed");
