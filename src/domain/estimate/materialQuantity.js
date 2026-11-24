/** @param {any} line */
export function purchasePackage(line) {
  const pack = line?.purchasePackage;
  const size = Number(pack?.size);
  return ["REEL", "BOX", "BUNDLE", "STICK"].includes(pack?.unit) && Number.isFinite(size) && size > 0 ? { unit: pack.unit, size } : null;
}
/** @param {any} line */
export function materialQuantity(line) {
  const value = line?.materialQuantity;
  const qty = Number(value == null || value === "" ? line?.quantity : value);
  const required = Number.isFinite(qty) ? Math.max(0, qty) : 0;
  const pack = purchasePackage(line);
  return pack ? Math.ceil(required / pack.size) * pack.size : required;
}
/** @param {any} line */
export function materialQuoteQuantity(line) {
  const pack = purchasePackage(line);
  return pack ? materialQuantity(line) / pack.size : materialQuantity(line);
}
