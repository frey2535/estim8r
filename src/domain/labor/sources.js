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

export const SOURCE_BADGES = {
  published_reference: "REFERENCE",
  manufacturer: "REFERENCE",
  government: "REFERENCE",
  estim8r_standard: "ESTIM8R",
  experimental: "ESTIM8R",
  company_history: "COMPANY",
  custom: "CUSTOM",
};

/** Published labor_units (equivalent of labor_reference_units). Never treat experimental as these. */
export const PUBLISHED_REFERENCE_TYPES = new Set(["published_reference", "manufacturer", "government"]);

/** Named publisher families a verified reference may claim. NECA is listed but never populated unless licensed. */
export const ALLOWED_REFERENCE_FAMILIES = [
  "NECA",
  "RSMeans",
  "Craftsman",
  "Manufacturer",
  "Government",
  "Published Study",
  "Other",
];

const PRODUCTION_SOURCES = new Set(["published_reference", "company_history", "manufacturer", "government"]);

export function isExperimentalSource(sourceType) {
  return sourceType === "experimental" || sourceType === "estim8r_standard";
}

export function isPublishedReferenceType(sourceType) {
  return PUBLISHED_REFERENCE_TYPES.has(sourceType);
}

export function sourceBadges({ sourceType, verificationStatus } = {}) {
  const verified = verificationStatus === "verified";
  if (isPublishedReferenceType(sourceType)) {
    return verified ? ["REFERENCE"] : ["UNVERIFIED"];
  }
  if (sourceType === "company_history") {
    return verified ? ["COMPANY"] : ["COMPANY", "UNVERIFIED"];
  }
  if (sourceType === "custom") {
    return ["CUSTOM", "UNVERIFIED"];
  }
  if (isExperimentalSource(sourceType)) {
    return ["ESTIM8R", "UNVERIFIED"];
  }
  return ["UNVERIFIED"];
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

const LICENSED_NECA = false;

function unitText(value) {
  return String(value || "").trim();
}

export function isLicensedNeca() {
  return LICENSED_NECA;
}

export function referenceEdition(unit) {
  return unitText(unit?.source_year || unit?.sourceYear || unit?.edition);
}

export function referenceSourceName(unit) {
  return unitText(unit?.source_name || unit?.sourceName);
}

/**
 * Market/reference = labor_units rows that stand in for labor_reference_units:
 * named source, edition/year, and verification_status === verified.
 * Experimental imported hours never qualify. NECA is rejected unless licensed.
 */
export function isVerifiedMarketReference(unit, { licensedNeca = LICENSED_NECA } = {}) {
  const row = laborUnitSnake(unit);
  if (!row) return false;
  if (isExperimentalSource(row.source_type)) return false;
  if (!isPublishedReferenceType(row.source_type)) return false;
  if (row.verification_status !== "verified") return false;
  if (!row.production_allowed) return false;
  if (!referenceSourceName(row)) return false;
  if (!referenceEdition(row)) return false;
  if (/neca/i.test(`${referenceSourceName(row)} ${row.source_reference} ${row.source_type}`) && !licensedNeca) {
    return false;
  }
  return row.normal_mh != null || row.difficult_mh != null || row.very_difficult_mh != null;
}

export function findVerifiedMarketReferences(laborItem, options) {
  return (laborItem?.labor_units || [])
    .map(laborUnitSnake)
    .filter((unit) => isVerifiedMarketReference(unit, options));
}

export function findVerifiedMarketReference(laborItem, options) {
  return findVerifiedMarketReferences(laborItem, options)[0] || null;
}
