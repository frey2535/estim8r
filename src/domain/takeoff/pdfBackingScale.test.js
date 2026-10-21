import assert from "node:assert/strict";
import { pdfBackingScale } from "./pdfBackingScale.js";

for (const [width, height, dpr, coarse] of [
  [1920, 1080, 2, false],
  [24000, 16000, 2, false],
  [24000, 16000, 2, true],
  [8000, 5000, 1.5, false],
  [40000, 30000, 2, true],
]) {
  const scale = pdfBackingScale(width, height, dpr, coarse);
  const budget = coarse ? 6_000_000 : 16_000_000;
  const canvasWidth = Math.floor(width * scale);
  const canvasHeight = Math.floor(height * scale);
  assert.ok(scale > 0 && Number.isFinite(scale));
  assert.ok(canvasWidth * canvasHeight <= budget, "canvas pixel budget exceeded");
  assert.ok(canvasWidth <= 8192 && canvasHeight <= 8192, "canvas dimension exceeded");
}
assert.throws(() => pdfBackingScale(0, 100), /Invalid/);
assert.throws(() => pdfBackingScale(Infinity, 100), /Invalid/);
console.log("PDF backing scale budget checks passed");
