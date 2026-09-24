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
