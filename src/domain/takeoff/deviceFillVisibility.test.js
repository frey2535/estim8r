import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks } from "./aiTakeoff.js";
import {
  MAX_FIXTURE_FILL,
  applyDeviceTypeColors,
  displayDeviceOutline,
  isCircuitMark,
  isDeviceMark,
  maxFillExtent,
  outlineExtent,
  planOverlayMarks,
  readableFillColor,
} from "./deviceStyles.js";
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
const planned = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: fixture.drawingSymbols || [],
  pages: fixture.pages || [],
  maxHomeruns: 8,
});
const colored = applyDeviceTypeColors(planned.marks || []);
const devices = planOverlayMarks(colored).filter(isDeviceMark);
assert(devices.length >= 8, `Pottsville AI must count devices, got ${devices.length}`);

const powerPages = (fixture.pages || []).filter((page) => /power/i.test(`${page.title || ""} ${page.kind || ""}`));
assert(powerPages.length >= 1, "fixture includes a power sheet");

for (const mark of devices) {
  const outline = displayDeviceOutline(mark);
  const extent = outlineExtent(outline);
  const color = readableFillColor(mark.color);
  const cap = maxFillExtent(mark);
  assert(extent <= cap + 0.001, `${mark.abbr || mark.typeCode} @${mark.sheet} fill ${extent.toFixed(3)} exceeds glyph cap ${cap}`);
  assert(extent <= MAX_FIXTURE_FILL, `${mark.abbr || mark.typeCode} fill must not cover a room (${extent.toFixed(3)})`);
  assert(extent >= 0.2, `${mark.abbr || mark.typeCode} fill vanished (${extent.toFixed(3)})`);
  assert(Number.isFinite(mark.x) && Number.isFinite(mark.y) && mark.x >= 0 && mark.x <= 100 && mark.y >= 0 && mark.y <= 100, `${mark.abbr || mark.typeCode} is off-sheet`);
  assert(color && color.toLowerCase() !== "#ffffff" && color.toLowerCase() !== "#fff", `${mark.abbr || mark.typeCode} fill must not be white (${color})`);
  assert(!mark.text, "device markers do not carry type-code text");
}

for (const page of powerPages) {
  const sheetMarks = planOverlayMarks(colored.filter((mark) => (mark.sheet || 1) === page.page));
  const overlay = planOverlayMarks(sheetMarks);
  const sheetDevices = overlay.filter(isDeviceMark);
  if (!sheetDevices.length) continue;
  assert(!overlay.some(isCircuitMark), `power sheet ${page.page} hides conduit overlays while devices stay`);
  assert(sheetDevices.length === sheetMarks.filter(isDeviceMark).length, `power sheet ${page.page} still paints every counted device`);
}

console.log(`device fill visibility: ${devices.length} devices, power sheets ${powerPages.map((page) => page.page).join(",") || "none"}`);
if (!process.exitCode) console.log("device fill visibility checks passed");
