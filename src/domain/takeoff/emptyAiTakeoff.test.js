import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks } from "./aiTakeoff.js";
import { isDeviceMark, planOverlayMarks } from "./deviceStyles.js";
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
assert(planned.deviceCount >= 8, `AI must mark real devices, got deviceCount ${planned.deviceCount}`);
assert(devices.length >= 8, `overlay must show marked devices, got ${devices.length}`);
assert(!devices.some((mark) => /^\d{1,2}$/.test(String(mark.typeCode || "")) && mark.circuitTagLocation?.text === mark.typeCode), "circuit-tag-only numbers are not painted as types");

if (!process.exitCode) console.log(`empty AI takeoff guard: ${planned.deviceCount} devices`);
