export const EXPERIMENTAL_LABOR_SOURCE = {
  type: "experimental",
  name: "Estim8r imported labor (experimental)",
  edition: "imported-unverified",
  warning: "Experimental / unverified imported labor. Not a production bid rate.",
};

export const SOURCE_LABELS = {
  published_reference: "Published / reference",
  company_history: "Company history",
  estim8r_standard: "Estim8r baseline",
  experimental: "Experimental / unverified",
  custom: "Custom labor",
  manufacturer: "Manufacturer",
  government: "Government",
};

const PRODUCTION_SOURCES = new Set(["published_reference", "company_history", "manufacturer", "government"]);

export function isExperimentalSource(sourceType) {
  return sourceType === "experimental" || sourceType === "estim8r_standard";
}

export function isProductionSafeLabor({ verificationStatus, productionAllowed, sourceType } = {}) {
  if (isExperimentalSource(sourceType)) return false;
  return verificationStatus === "verified" && productionAllowed === true && PRODUCTION_SOURCES.has(sourceType);
}

export function asExperimentalLaborUnit(unit, itemId) {
  const id = String(unit.id || `${itemId}-experimental`).replace(/neca/ig, "imported");
  return {
    ...unit,
    id,
    labor_item_id: unit.labor_item_id || itemId,
    source_type: EXPERIMENTAL_LABOR_SOURCE.type,
    source_name: EXPERIMENTAL_LABOR_SOURCE.name,
    source_reference: "",
    verification_status: "unverified",
    production_allowed: false,
    notes: EXPERIMENTAL_LABOR_SOURCE.warning,
  };
}

export function asExperimentalLaborItem(row) {
  return {
    ...row,
    labor_units: (row.labor_units || []).map((unit) => asExperimentalLaborUnit(unit, row.id)),
  };
}

export function laborUnitSnake(unit) {
  if (!unit) return null;
  if (unit.normal_mh != null || unit.source_type) return unit;
  return {
    id: unit.id,
    labor_item_id: unit.laborItemId || unit.labor_item_id,
    source_type: unit.sourceType || unit.source_type,
    source_name: unit.sourceName || unit.source_name,
    source_year: unit.sourceYear || unit.source_year || "",
    source_reference: unit.sourceReference || unit.source_reference || "",
    normal_mh: unit.normalMh ?? unit.normal_mh ?? null,
    difficult_mh: unit.difficultMh ?? unit.difficult_mh ?? null,
    very_difficult_mh: unit.veryDifficultMh ?? unit.very_difficult_mh ?? null,
    verification_status: unit.verificationStatus || unit.verification_status || "unverified",
    production_allowed: Boolean(unit.productionAllowed ?? unit.production_allowed),
    notes: unit.notes || "",
  };
}

export function conditionMh(unit, condition = "normal") {
  const row = laborUnitSnake(unit);
  if (!row) return null;
  if (condition === "difficult") return row.difficult_mh;
  if (condition === "very_difficult") return row.very_difficult_mh;
  return row.normal_mh;
}
