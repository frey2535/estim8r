import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks } from "./aiTakeoff.js";
import {
  MAX_FIXTURE_FILL,
  aiPaintExtentCap,
  applyDeviceTypeColors,
  displayDeviceOutline,
  isCircuitMark,
  isDeviceMark,
  outlineExtent,
  planOverlayMarks,
  readableFillColor,
  trustedAiBodyMax,
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

const liveDevices = planOverlayMarks(colored, { interactive: true }).filter(isDeviceMark);
const liveReviewDevices = liveDevices.filter((mark) => (
  mark.requiresReview === true
  || mark.layer === "review"
  || String(mark.typeCode || "").toUpperCase() === "UNKNOWN"
));
assert(liveDevices.length > devices.length, `live drawing must show review candidates beside bid devices (${liveDevices.length}/${devices.length})`);
assert(liveReviewDevices.some((mark) => displayDeviceOutline(mark)), "live drawing must paint at least one review candidate for selection/correction");

const powerPages = (fixture.pages || []).filter((page) => /power/i.test(`${page.title || ""} ${page.kind || ""}`));
assert(powerPages.length >= 1, "fixture includes a power sheet");

let painted = 0;
for (const mark of devices) {
  const outline = displayDeviceOutline(mark);
  const color = readableFillColor(mark.color);
  assert(Number.isFinite(mark.x) && Number.isFinite(mark.y) && mark.x >= 0 && mark.x <= 100 && mark.y >= 0 && mark.y <= 100, `${mark.abbr || mark.typeCode} is off-sheet`);
  assert(color && color.toLowerCase() !== "#ffffff" && color.toLowerCase() !== "#fff", `${mark.abbr || mark.typeCode} fill must not be white (${color})`);
  assert(!mark.text, "device markers do not carry type-code text");
  if (!outline) {
    const rawExtent = outlineExtent(mark.outline);
    assert(rawExtent > trustedAiBodyMax(mark) || rawExtent === 0, `${mark.abbr || mark.typeCode} fill vanished on a recoverable symbol body`);
    continue;
  }
  painted += 1;
  const extent = outlineExtent(outline);
  const cap = aiPaintExtentCap(mark);
  assert(extent <= cap + 0.001, `${mark.abbr || mark.typeCode} @${mark.sheet} fill ${extent.toFixed(3)} exceeds glyph cap ${cap}`);
  assert(extent <= MAX_FIXTURE_FILL, `${mark.abbr || mark.typeCode} fill must not cover a room (${extent.toFixed(3)})`);
  // Measured AI fills must stay inside the CAD perimeter. Tiny power glyphs
  // (SPR/OS covers ~0.16–0.20) stay at their extracted size instead of being
  // inflated past the printed symbol.
  assert(extent >= 0.12, `${mark.abbr || mark.typeCode} fill vanished (${extent.toFixed(3)})`);
}
assert(painted >= 8, `Pottsville AI must paint in-symbol fills, got ${painted}`);
assert(painted >= Math.floor(devices.length * 0.9), `at least 90% of counted devices must keep a visible fill (${painted}/${devices.length})`);
const livePainted = liveDevices.filter((mark) => displayDeviceOutline(mark)).length;
assert(livePainted >= painted, `live drawing must not lose visible fills (${livePainted}/${painted})`);

for (const page of powerPages) {
  const sheetMarks = planOverlayMarks(colored.filter((mark) => (mark.sheet || 1) === page.page));
  const overlay = planOverlayMarks(sheetMarks);
  const sheetDevices = overlay.filter(isDeviceMark);
  if (!sheetDevices.length) continue;
  assert(!overlay.some(isCircuitMark), `power sheet ${page.page} hides conduit overlays while devices stay`);
  assert(sheetDevices.length === sheetMarks.filter(isDeviceMark).length, `power sheet ${page.page} still paints every counted device`);
}

console.log(`device fill visibility: ${painted}/${devices.length} in-symbol fills, power sheets ${powerPages.map((page) => page.page).join(",") || "none"}`);
if (!process.exitCode) console.log("device fill visibility checks passed");
