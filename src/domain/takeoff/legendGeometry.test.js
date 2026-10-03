import { pagePlanType } from "./drawing-docs.js";
import {
  attachConfirmedGeometryPrototypes,
  clusterSymbolGeometry,
  geometrySimilarity,
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
assert(resolveGeometryMatch(match, twins.entries, { planType: "lighting" }) == null, "unlabeled 1 vs 1E twins are not guessed");

const learned = attachConfirmedGeometryPrototypes(
  { entries: [{ code: "1E", symbol: { id: "2x4", label: "Type 1E", category: "Lighting" } }] },
  [{ typeCode: "1E", x: 20, y: 20, outlineSource: "vector", outline: { kind: "rect", source: "vector", w: 0.8, h: 1.25, points: [] } }],
);
assert(learned.entries[0].prototype, "confirmed extracted bodies become repeat prototypes");

assert(pagePlanType({ title: "LIGHTING FLOOR PLAN - MAIN LEVEL" }) === "lighting", "lighting title is a lighting plan");
assert(pagePlanType({ title: "POWER FLOOR PLAN - MAIN LEVEL" }) === "power", "power title is a power plan");
assert(pagePlanType({ planType: "power", title: "LIGHTING FLOOR PLAN" }) === "power", "explicit planType wins");

if (!process.exitCode) console.log("legend geometry checks passed");

