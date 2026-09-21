import {
  CIRCUIT_COLOR,
  DEVICE_FILL_OPACITY,
  SCHEDULE_TYPE_COLORS,
  applyDeviceTypeColors,
  deviceOutline,
  hitTestDeviceFill,
  scheduleTypeColor,
  selectMarkAtPoint,
  shortenCircuitPath,
} from "./deviceStyles.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(scheduleTypeColor("1") === SCHEDULE_TYPE_COLORS["1"], "type 1 is dark blue");
assert(scheduleTypeColor("1E") === SCHEDULE_TYPE_COLORS["1e"], "type 1E is light blue");
assert(scheduleTypeColor("2") === SCHEDULE_TYPE_COLORS["2"], "type 2 is dark green");
assert(scheduleTypeColor("2E") === SCHEDULE_TYPE_COLORS["2e"], "type 2E is light green");
assert(scheduleTypeColor("3") === SCHEDULE_TYPE_COLORS["3"], "type 3 is dark red");
assert(scheduleTypeColor("3E") === SCHEDULE_TYPE_COLORS["3e"], "type 3E is light red");
assert(scheduleTypeColor("4") === SCHEDULE_TYPE_COLORS["4"], "type 4 is purple");
assert(scheduleTypeColor("F") === SCHEDULE_TYPE_COLORS.f, "type F is distinct");
assert(scheduleTypeColor("1") !== scheduleTypeColor("1E"), "emergency types use a lighter tint");

const colored = applyDeviceTypeColors([
  { id: "a", type: "count", sheet: 1, typeCode: "1", abbr: "2x4", x: 10, y: 10 },
  { id: "b", type: "count", sheet: 1, typeCode: "1E", abbr: "2x4", x: 20, y: 10 },
  { id: "c", type: "count", sheet: 1, typeCode: "2", abbr: "2x2", x: 30, y: 10 },
  { id: "r", type: "count", sheet: 1, abbr: "GFI", symbol: "gfci", x: 40, y: 10 },
  { id: "run", type: "route", tool: "conduit", sheet: 1, points: [{ x: 10, y: 10 }, { x: 80, y: 10 }], color: "#2563eb" },
]);
assert(colored.find((mark) => mark.id === "a").color === SCHEDULE_TYPE_COLORS["1"], "type 1 fill color");
assert(colored.find((mark) => mark.id === "b").color === SCHEDULE_TYPE_COLORS["1e"], "type 1E fill color");
assert(colored.find((mark) => mark.id === "c").color === SCHEDULE_TYPE_COLORS["2"], "type 2 fill color");
assert(colored.find((mark) => mark.id === "a").color !== colored.find((mark) => mark.id === "r").color, "receptacles get a different sheet color");
assert(colored.find((mark) => mark.id === "run").color === CIRCUIT_COLOR, "circuits do not use device fill colors");
assert(colored.find((mark) => mark.id === "a").fillOpacity === DEVICE_FILL_OPACITY, "device fills stay transparent");
assert(colored.find((mark) => mark.id === "run").layer === "circuit", "circuits are a separate layer");

const fixture = deviceOutline({ symbol: "2x4", abbr: "2x4" });
assert(fixture.kind === "rect" && fixture.w > fixture.h, "2x4 fill follows the fixture outline");
const receptacle = deviceOutline({ symbol: "gfci", abbr: "GFI", symbolLabel: "GFCI receptacle" });
assert(receptacle.kind === "circle", "receptacles use a circular outline");
assert(hitTestDeviceFill({ x: 10, y: 10, symbol: "2x4", abbr: "2x4" }, { x: 10.2, y: 10.1 }), "a 2x4 fill is selectable");
assert(!hitTestDeviceFill({ x: 10, y: 10, symbol: "2x4", abbr: "2x4" }, { x: 18, y: 18 }), "fill hit stays on the device");

const overlapping = [
  { id: "dev", type: "count", symbol: "2x4", abbr: "2x4", x: 12, y: 20 },
  { id: "ckt", type: "route", tool: "conduit", points: [{ x: 12, y: 20 }, { x: 70, y: 20 }] },
];
const picked = selectMarkAtPoint(overlapping, { x: 12, y: 20 }, {
  hitRoute: (mark, point) => mark.points?.some((item) => Math.hypot(item.x - point.x, item.y - point.y) < 3),
});
assert(picked?.id === "dev", "clicking a device on a circuit selects the device");

const shortened = shortenCircuitPath([{ x: 10, y: 10 }, { x: 40, y: 10 }]);
assert(shortened[0].x > 10 && shortened[0].x < 40, "circuit path starts at the device edge, not on the count");
assert(shortened[1].x === 40, "circuit still reaches the panel");

const extracted = deviceOutline({
  x: 20,
  y: 36.5,
  symbol: "2x4",
  abbr: "1E",
  outlineSource: "vector",
  outline: { kind: "rect", source: "vector", w: 2.1, h: 1.05, points: [] },
}, 0.4);
assert(extracted.kind === "rect" && Math.abs(extracted.w - 2.1) < 0.01, "vector outlines keep the extracted size when the marker control changes");
assert(hitTestDeviceFill({
  x: 20,
  y: 36.5,
  type: "count",
  outlineSource: "vector",
  outline: { kind: "rect", source: "vector", w: 2.1, h: 1.05, points: [] },
}, { x: 20.4, y: 36.6 }), "extracted outlines stay selectable");

if (!process.exitCode) console.log("device style checks passed");
