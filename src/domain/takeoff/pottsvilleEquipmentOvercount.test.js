import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAiMarks } from "./aiTakeoff.js";
import { paletteForTrade } from "./trades.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const fixture = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/pottsville-electrical.json"),
  "utf8",
));
const electrical = paletteForTrade("electrical");
const result = buildAiMarks({
  trade: "electrical",
  symbols: electrical.symbols,
  drawingSymbols: fixture.drawingSymbols || [],
  pages: fixture.pages || [],
  maxHomeruns: 8,
});

const devices = (result.marks || []).filter((mark) => mark.type === "count" || mark.type === "drop");
const ef = devices.filter((mark) => /^EF$/i.test(String(mark.typeCode || mark.abbr || mark.symbol || "").replace(/[^A-Z]/gi, "")));
const printedEfPower = (fixture.pages || [])
  .filter((page) => page.page === 50)
  .flatMap((page) => page.tokens || [])
  .filter((token) => /^EF(?:[- ]?\d+)?$/i.test(String(token.text || "").trim()));

console.log(`Pottsville E110 EF printed=${printedEfPower.length}; counted=${ef.length}`);
assert(printedEfPower.length === 5, `fixture must contain 5 printed EF tags on sheet 50, got ${printedEfPower.length}`);
assert(ef.length <= printedEfPower.length, `EF false-positive explosion: counted ${ef.length} from only ${printedEfPower.length} printed tags`);
assert(!ef.some((mark) => ["plan-repeat", "legend-geometry", "raster"].includes(mark.matchedFrom) && !mark.labelLocation), "unlabeled repeat/raster EF quantities are forbidden");

if (!process.exitCode) console.log("Pottsville tagged-equipment guard passed");
