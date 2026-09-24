export const MATERIAL_PRICE_SOURCES = ["Supplier quote", "Supplier catalog", "Company history", "Published reference", "Manual", "Other"];

export function normalizeMaterialPriceMeta(input = {}) {
  return {
    sourceType: input.sourceType || "",
    supplier: input.supplier || "",
    reference: input.reference || "",
    effectiveDate: input.effectiveDate || "",
    capturedAt: input.capturedAt || "",
    notes: input.notes || "",
  };
}

export function materialPriceAgeDays(meta, now = new Date()) {
  const raw = meta?.effectiveDate || meta?.capturedAt;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

export function materialPriceStatus(meta, staleAfterDays = 30, now = new Date()) {
  const normalized = normalizeMaterialPriceMeta(meta);
  const ageDays = materialPriceAgeDays(normalized, now);
  if (!normalized.sourceType) return { state: "missing-source", label: "Price source missing", ageDays };
  if (ageDays == null) return { state: "missing-date", label: "Price date missing", ageDays };
  if (ageDays > staleAfterDays) return { state: "stale", label: "Price is " + ageDays + " days old", ageDays };
  return { state: "current", label: "Price verified " + ageDays + " days ago", ageDays };
}

export function snapshotMaterialPrice(line) {
  return {
    unitCost: Number(line?.materialUnitCost) || 0,
    ...normalizeMaterialPriceMeta(line?.materialPriceMeta),
  };
}


export function appendMaterialPriceHistory(history = [], line, capturedAt = new Date().toISOString()) {
  const snapshot = { ...snapshotMaterialPrice(line), capturedAt };
  if (!(snapshot.unitCost >= 0)) return history;
  const duplicate = history.some((row) =>
    Number(row.unitCost) === snapshot.unitCost &&
    row.sourceType === snapshot.sourceType &&
    row.supplier === snapshot.supplier &&
    row.reference === snapshot.reference &&
    row.effectiveDate === snapshot.effectiveDate
  );
  return duplicate ? history : [snapshot, ...history].slice(0, 100);
}

export function compareMaterialPrices(currentUnitCost, history = []) {
  const current = Number(currentUnitCost) || 0;
  const valid = history.filter((row) => Number.isFinite(Number(row.unitCost)) && Number(row.unitCost) >= 0);
  if (!valid.length) return { current, previous: null, change: null, changePct: null, low: null, high: null, average: null };
  const prices = valid.map((row) => Number(row.unitCost));
  const previous = prices[0];
  const change = current - previous;
  return {
    current,
    previous,
    change,
    changePct: previous > 0 ? (change / previous) * 100 : null,
    low: Math.min(...prices),
    high: Math.max(...prices),
    average: prices.reduce((sum, value) => sum + value, 0) / prices.length,
  };
}
