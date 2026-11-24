/** @param {any} line */
export function materialQuantity(line) {
  const value = line?.materialQuantity;
  const qty = Number(value == null || value === "" ? line?.quantity : value);
  return Number.isFinite(qty) ? Math.max(0, qty) : 0;
}
