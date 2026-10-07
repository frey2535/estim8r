import { pagePlanType } from "./drawing-docs.js";
import {
  attachConfirmedGeometryPrototypes,
  attachFragmentPrototypes,
  clusterSymbolGeometry,
  findNearbyReceptacleGlyph,
  geometrySimilarity,
  isDeviceFragment,
  isHatchTickCluster,
  looksLikeHexNoteGlyph,
  looksLikeReceptacleGlyph,
  looksLikeUnlabeledReceptacleGlyph,
  resolveGeometryMatch,
  scanPageByLegendGeometry,
} from "./legendGeometry.js";

function assert(v, m) {
  if (!v) {
    console.error("FAIL", m);
    process.exitCode = 1;
  }
}

const part = (cx, cy, w, h, kind = "rect") => ({
  cx, cy, w, h, kind, source: "vector",
  outline: { kind, source: "vector", w, h, points: [] },
});

const legendParts = [part(10, 10, 0.5, 0.5, "circle"), part(10.45, 10, 0.3, 0.12)];
const proto = clusterSymbolGeometry(legendParts[0], legendParts, { maxSpan: 2 });
const planParts = [part(40, 30, 0.5, 0.5, "circle"), part(40.45, 30, 0.3, 0.12)];
const match = clusterSymbolGeometry(planParts[0], planParts, { maxSpan: 2 });
assert(proto.outline.kind === "composite", "composite outline retained");
assert(proto.outline.parts.length === 2, "all symbol primitives retained");
assert(geometrySimilarity(proto, match) > 0.9, "translated identical symbol matches");
const dictionary = { entries: [{ code: "R", symbol: { id: "duplex", label: "Duplex receptacle", category: "Receptacles" }, prototype: proto }] };
const hits = scanPageByLegendGeometry({ paths: planParts }, dictionary, { threshold: 0.8 });
assert(hits.length === 1, "unlabeled plan symbol found from legend geometry");


const layoutA = clusterSymbolGeometry(part(60, 20, 0.5, 0.5, "circle"), [
  part(60, 20, 0.5, 0.5, "circle"),
  part(60.42, 20, 0.24, 0.10, "rect"),
], { maxSpan: 1.2, joinGap: 0.2 });
const layoutB = clusterSymbolGeometry(part(70, 20, 0.5, 0.5, "circle"), [
  part(70, 20, 0.5, 0.5, "circle"),
  part(70, 20.42, 0.24, 0.10, "rect"),
], { maxSpan: 1.2, joinGap: 0.2 });
const layoutCopy = clusterSymbolGeometry(part(80, 20, 0.5, 0.5, "circle"), [
  part(80, 20, 0.5, 0.5, "circle"),
  part(80.42, 20, 0.24, 0.10, "rect"),
], { maxSpan: 1.2, joinGap: 0.2 });
assert(geometrySimilarity(layoutA, layoutCopy) > geometrySimilarity(layoutA, layoutB), "complete part layout distinguishes lookalike symbols");

const canProto = clusterSymbolGeometry(part(12, 12, 0.48, 0.48, "circle"), [part(12, 12, 0.48, 0.48, "circle")], { maxSpan: 2 });
const gfiProto = clusterSymbolGeometry(part(14, 14, 0.5, 0.5, "circle"), [part(14, 14, 0.5, 0.5, "circle")], { maxSpan: 2 });
const lookalikes = {
  entries: [
    { code: "2", symbol: { id: "downlight", label: "Type 2 recessed downlight", category: "Lighting" }, prototype: canProto },
    { code: "GFI", symbol: { id: "gfci", label: "GFCI receptacle", category: "Receptacles" }, prototype: gfiProto },
  ],
};
const cluster = clusterSymbolGeometry(part(50, 40, 0.49, 0.49, "circle"), [part(50, 40, 0.49, 0.49, "circle")], { maxSpan: 2 });
const lighting = resolveGeometryMatch(cluster, lookalikes.entries, { planType: "lighting" });
const power = resolveGeometryMatch(cluster, lookalikes.entries, { planType: "power" });
assert(lighting?.entry.code === "2" && lighting.ambiguous === false, `lighting sheet settles the can, got ${lighting?.entry.code} amb=${lighting?.ambiguous}`);
assert(power?.entry.code === "GFI" && power.ambiguous === false, `power sheet settles the receptacle, got ${power?.entry.code} amb=${power?.ambiguous}`);

const twins = {
  entries: [
    { code: "1", symbol: { id: "2x4", label: "Type 1 2x4 troffer", category: "Lighting" }, prototype: proto },
    { code: "1E", symbol: { id: "2x4", label: "Type 1E 2x4 emergency", category: "Lighting" }, prototype: proto },
  ],
};
assert(resolveGeometryMatch(match, twins.entries, { planType: "lighting" }) == null, "unlabeled 1 vs 1E twins are not guessed when hatch does not distinguish them");

const simpleTroffer = clusterSymbolGeometry(part(20, 20, 0.8, 1.25), [part(20, 20, 0.8, 1.25)], { maxSpan: 2 });
const hatchedTroffer = clusterSymbolGeometry(part(40, 20, 0.8, 1.25), [
  part(40, 20, 0.8, 1.25),
  part(39.85, 19.85, 0.18, 0.22),
  part(40.05, 20.05, 0.16, 0.2),
  part(40.15, 20.2, 0.14, 0.18),
], { maxSpan: 2 });
const twinBodies = {
  entries: [
    { code: "1", symbol: { id: "2x4", label: "Type 1 2x4 troffer", category: "Lighting" }, prototype: simpleTroffer },
    { code: "1E", symbol: { id: "2x4", label: "Type 1E 2x4 emergency", category: "Lighting" }, prototype: hatchedTroffer },
  ],
};
assert(resolveGeometryMatch(hatchedTroffer, twinBodies.entries, { planType: "lighting", twinHatch: true })?.entry.code === "1E", "hatched 2x4 settles as emergency");
assert(resolveGeometryMatch(simpleTroffer, twinBodies.entries, { planType: "lighting", twinHatch: true })?.entry.code === "1", "simple 2x4 settles as the normal twin");

const learned = attachConfirmedGeometryPrototypes(
  { entries: [{ code: "1E", symbol: { id: "2x4", label: "Type 1E", category: "Lighting" } }] },
  [{ typeCode: "1E", x: 20, y: 20, outlineSource: "vector", outline: { kind: "rect", source: "vector", w: 0.8, h: 1.25, points: [] } }],
);
assert(learned.entries[0].prototype, "confirmed extracted bodies become repeat prototypes");

assert(pagePlanType({ title: "LIGHTING FLOOR PLAN - MAIN LEVEL" }) === "lighting", "lighting title is a lighting plan");
assert(pagePlanType({ title: "POWER FLOOR PLAN - MAIN LEVEL" }) === "power", "power title is a power plan");
assert(pagePlanType({ title: "FIRST FLOOR LIGHTING PLAN" }) === "lighting", "floor lighting title is a lighting plan");
assert(pagePlanType({ title: "POWER & SYSTEMS PLAN" }) === "power", "power and systems title is a power plan");
assert(pagePlanType({ planType: "power", title: "LIGHTING FLOOR PLAN" }) === "power", "explicit planType wins");

const slashA = part(22.1, 22.2, 0.167, 0.087);
const slashB = part(22.22, 22.28, 0.144, 0.107);
const slashCopyA = part(40.1, 36.2, 0.167, 0.087);
const slashCopyB = part(40.22, 36.28, 0.144, 0.107);
assert(isDeviceFragment(slashA), "can slashes are first-class fragments");
const slashDict = attachFragmentPrototypes(
  { entries: [{ code: "4", symbol: { id: "downlight", label: "Type 4 4 inch surface downlight", category: "Lighting" } }] },
  [{ typeCode: "4", x: 22.15, y: 22.2, outlineSource: "text", outline: { kind: "circle", source: "text", w: 0.52, h: 0.52 } }],
  { paths: [slashA, slashB, slashCopyA, slashCopyB] },
);
assert(slashDict.entries[0].slashPrototype, "labeled slashed-circle tags train a slash prototype");
const slashHits = scanPageByLegendGeometry(
  { paths: [slashA, slashB, slashCopyA, slashCopyB] },
  { entries: [{ ...slashDict.entries[0], prototype: slashDict.entries[0].slashPrototype }] },
  { allowSlash: true, threshold: 0.9, strictSize: true, occupyRadius: 0.4, occupied: [{ x: 22.15, y: 22.2 }] },
);
assert(slashHits.some((hit) => Math.abs(hit.geometry.cx - 40.16) < 0.25), "unlabeled slashed-circle copy is recovered from fragments");

const hex = part(26.18, 79.1, 0.443, 0.622, "path");
const box = part(17.175, 69.326, 0.143, 0.200);
const stroke = part(62.290, 72.591, 0.114, 0.276);
assert(looksLikeHexNoteGlyph(hex), "printed hex keys are recognized");
assert(!looksLikeReceptacleGlyph(hex), "hex keys are not receptacle glyphs");
assert(looksLikeReceptacleGlyph(box) && looksLikeUnlabeledReceptacleGlyph(box), "duplex box is a receptacle glyph");
assert(looksLikeReceptacleGlyph(stroke) && looksLikeUnlabeledReceptacleGlyph(stroke), "box-with-strokes is a receptacle glyph");
assert(findNearbyReceptacleGlyph({ x: 17.214, y: 69.416 }, [hex, box]) === box, "WP/SP fills prefer the box, not the hex");
const hatch = Array.from({ length: 12 }, (_, index) => part(12 + (index % 4) * 0.4, 16 + Math.floor(index / 4) * 0.4, 0.134, 0.187));
assert(isHatchTickCluster(hatch[0], hatch), "stair/hatch tick lattices are not receptacles");

if (!process.exitCode) console.log("legend geometry checks passed");

