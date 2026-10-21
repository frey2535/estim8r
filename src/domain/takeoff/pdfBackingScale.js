/**
 * Compute the PDF backing-store scale independently of CSS zoom.
 * The returned scale must respect both a pixel budget and per-axis canvas limits.
 */
export function pdfBackingScale(width, height, devicePixelRatio = 1, coarsePointer = false) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error("Invalid PDF drawing dimensions.");
  }
  const dpr = Math.min(2, Math.max(1, Number(devicePixelRatio) || 1));
  const pixelBudget = coarsePointer ? 6_000_000 : 16_000_000;
  const pixels = w * h;
  const budgetScale = Math.min(dpr, Math.sqrt(pixelBudget / pixels));
  const dimensionScale = Math.min(1, 8192 / (w * budgetScale), 8192 / (h * budgetScale));
  const outputScale = budgetScale * dimensionScale;
  if (!Number.isFinite(outputScale) || outputScale <= 0) {
    throw new Error("Drawing dimensions exceed the supported render range.");
  }
  return outputScale;
}
