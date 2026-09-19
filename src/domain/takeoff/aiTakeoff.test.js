import { groupHomeruns, matchTradeSymbol, buildAiMarks } from "./aiTakeoff.js";
import { paletteForTrade } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const electrical = paletteForTrade("electrical");
const fire = paletteForTrade("fire-alarm");
assert(!electrical.symbols.some((item) => item.category === "Fire Alarm"), "electrical palette excludes fire alarm");
assert(!electrical.symbols.some((item) => item.category === "Plumbing"), "electrical palette excludes plumbing");
assert(fire.symbols.every((item) => item.category === "Fire Alarm"), "fire alarm palette is only fire alarm");
assert(matchTradeSymbol("FACP", electrical.symbols) == null, "fire alarm panel is not an electrical match");
assert(matchTradeSymbol("GFI", electrical.symbols)?.id === "gfci", "gfci matches electrical");

const anchors = [{ id: "p1", sheet: 1, x: 80, y: 10 }];
const devices = [
  { id: "d1", sheet: 1, x: 10, y: 10 },
  { id: "d2", sheet: 1, x: 20, y: 10 },
  { id: "d3", sheet: 1, x: 30, y: 10 },
  { id: "d4", sheet: 1, x: 40, y: 10 },
];
const grouped = groupHomeruns(devices, anchors, 3);
assert(grouped.length === 2, "4 homeruns split into two conduits");
assert(grouped.every((group) => group.devices.length <= 3), "no conduit has more than 3 homeruns");
assert(groupHomeruns(devices, anchors, 4).length === 1, "user can raise the homerun cap");

const planned = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  maxHomeruns: 3,
  conduit: { id: "emt-3-4", label: '3/4" EMT', size: '3/4"', material: "EMT" },
  pages: [{
    page: 1,
    kind: "drawing",
    tokens: [
      { text: "LP", x: 70, y: 20 },
      { text: "GFI", x: 10, y: 20 },
      { text: "GFI", x: 20, y: 20 },
      { text: "GFI", x: 30, y: 22 },
      { text: "GFI", x: 40, y: 22 },
      { text: "FACP", x: 15, y: 40 },
    ],
  }],
});
assert(planned.marks.filter((mark) => mark.symbol === "facp" || mark.abbr === "FACP").length === 0, "AI did not take off fire alarm");
assert(planned.marks.filter((mark) => mark.tool === "conduit").every((mark) => mark.homerunCount <= 3), "AI conduits stay within the cap");
assert(planned.marks.some((mark) => mark.tool === "conduit" && mark.conduitSize === '3/4"'), "AI conduit keeps the selected size");

if (!process.exitCode) console.log("trade and AI takeoff checks passed");
