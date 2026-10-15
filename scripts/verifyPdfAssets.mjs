import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const base = path.resolve("dist/pdfjs");
for (const folder of ["wasm", "standard_fonts"]) {
  const dir = path.join(base, folder);
  assert.ok(fs.existsSync(dir), `Missing PDF.js ${folder} build assets`);
  const files = fs.readdirSync(dir);
  assert.ok(files.length > 0, `Empty PDF.js ${folder} build assets`);
}
const wasmFiles = fs.readdirSync(path.join(base, "wasm"));
assert.ok(wasmFiles.some((name) => name.endsWith(".wasm")), "No PDF.js WASM decoder binary was copied");
console.log("PDF.js WASM decoder and font build assets verified");
