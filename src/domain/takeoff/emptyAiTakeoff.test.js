import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks, pagesToScan } from "./aiTakeoff.js";
import { displayDeviceOutline, isDeviceMark, planOverlayMarks } from "./deviceStyles.js";
import { paletteForTrade } from "./trades.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const fixture = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/pottsville-electrical.json"),
  "utf8",
));
const electrical = paletteForTrade("electrical");

let planned;
try {
  planned = buildAiMarks({
    trade: "electrical",
    symbols: electrical.symbols,
    drawingSymbols: fixture.drawingSymbols || [],
    pages: fixture.pages || [],
    maxHomeruns: 8,
  });
} catch (error) {
  console.error("FAIL buildAiMarks threw", error?.message || error);
  process.exit(1);
}

const devices = planOverlayMarks(planned.marks || []).filter(isDeviceMark);
const painted = devices.filter((mark) => displayDeviceOutline(mark));
const powerLighting = devices.filter((mark) => (
  mark.sheet === 50 && /^(?:[1-4]E?|L\d+[A-Z]?|F\d+[A-Z]?|X\d+[A-Z]?)$/i.test(String(mark.typeCode || ""))
));
assert(planned.deviceCount >= 8, `AI must mark real devices, got deviceCount ${planned.deviceCount}`);
assert(devices.length >= 8, `overlay must show marked devices, got ${devices.length}`);
assert(painted.length >= 8, `overlay must paint in-symbol fills, got ${painted.length}`);
assert(painted.length >= Math.floor(devices.length * 0.72), `most counted devices must keep a visible fill (${painted.length}/${devices.length})`);
assert(powerLighting.length < 8, `power plan E110 must not count lighting types as devices, got ${powerLighting.length}`);
assert(!devices.some((mark) => /^\d{1,2}$/.test(String(mark.typeCode || "")) && mark.circuitTagLocation?.text === mark.typeCode), "circuit-tag-only numbers are not painted as types");

const gatedOut = pagesToScan([{ kind: "other", paths: new Array(20).fill({}), tokens: [] }], "electrical", { entries: [] });
assert(gatedOut.length === 0, "pagesToScan does not fall back to non-electrical geometry sheets");

const electricalFallback = pagesToScan([{
  kind: "drawing",
  sheetId: "E110",
  discipline: "electrical",
  paths: new Array(20).fill({}),
  tokens: [{ text: "E110", x: 88, y: 92 }],
}], "electrical", { entries: [] });
assert(electricalFallback.length === 1, "pagesToScan still keeps electrical-looking sheets when gating is empty");

if (!process.exitCode) console.log(`empty AI takeoff guard: ${planned.deviceCount} devices, ${painted.length} in-symbol fills`);
