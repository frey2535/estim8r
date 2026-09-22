import { AUDITED_LABOR_ITEMS as RAW_AUDITED_LABOR_ITEMS } from "./auditedLibraryData.js";
import { asExperimentalLaborItem, EXPERIMENTAL_LABOR_SOURCE } from "./sources.js";

export const AUDITED_LABOR_ITEMS = RAW_AUDITED_LABOR_ITEMS.map(asExperimentalLaborItem);

export const AUDITED_LABOR_SOURCE = {
  workbook: "Estim8r_Source_Audited_Electrical_Labor_Database.xlsx",
  sheet: "Labor Database",
  name: EXPERIMENTAL_LABOR_SOURCE.name,
  edition: EXPERIMENTAL_LABOR_SOURCE.edition,
};

const STOP_WORDS = new Set(["install", "terminate", "and", "the", "a", "an", "of", "for", "with", "to", "per", "from"]);

const CATEGORY_ALIASES = {
  receptacles: ["devices", "residential"],
  switches: ["devices"],
  lighting: ["lighting", "site lighting & signs"],
  hvac: ["equipment connections", "motors", "motor control"],
  "panels / mcc": ["distribution"],
  equipment: ["equipment connections", "distribution", "motors"],
  raceway: ["raceways"],
  "low voltage": ["communications", "automation", "security", "fiber optics"],
  "fire alarm": ["life safety"],
  "access control": ["security"],
};

function normalizeCategory(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/s$/, "")
    .trim();
}

function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9/+-]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function normalizeSize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/["”]/g, "")
    .replace(/\s*inches?\b/g, "")
    .replace(/\s*in\b/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function textHasSize(text, size) {
  const token = normalizeSize(size);
  if (!token) return true;
  const haystack = normalizeSize(text);
  if (token === "1") return /(?<![0-9/-])1(?![0-9/-])/.test(haystack);
  return haystack.includes(token);
}

function isLengthUnit(unit) {
  return unit === "LF" || unit === "FT" || unit === "100 LF";
}

function canonicalLengthUnit(unit) {
  if (unit === "FT") return "LF";
  return unit;
}

function unitsCompatible(itemUnit, takeoffUnit) {
  if (!takeoffUnit) return true;
  if (itemUnit === takeoffUnit) return true;
  if (isLengthUnit(itemUnit) && isLengthUnit(takeoffUnit)) return true;
  return false;
}

function categoriesCompatible(itemCategory, takeoffCategory) {
  if (!itemCategory || !takeoffCategory) return true;
  if (takeoffCategory === "From drawing" || takeoffCategory === "Uncategorized") return true;
  const item = normalizeCategory(itemCategory);
  const takeoff = normalizeCategory(takeoffCategory);
  if (item === takeoff || item.includes(takeoff) || takeoff.includes(item)) return true;
  const aliases = CATEGORY_ALIASES[takeoffCategory.toLowerCase()] || [];
  return aliases.some((alias) => normalizeCategory(alias) === item);
}

function searchBlob(row) {
  return [row.item_name, row.description, row.subcategory, row.material_type, row.size, row.category, row.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function listBundledLaborLibrary({ search = "", category = "", limit = 2500 } = {}) {
  const q = search.trim().toLowerCase();
  const rows = AUDITED_LABOR_ITEMS.filter((row) => {
    if (!row.active) return false;
    if (category && row.category !== category) return false;
    if (q && !searchBlob(row).includes(q)) return false;
    return true;
  });
  return rows.slice(0, limit);
}

export function listBundledLaborCategories() {
  return [...new Set(AUDITED_LABOR_ITEMS.filter((row) => row.active).map((row) => row.category))].sort();
}

export function listBundledLaborTaxonomy() {
  const tree = new Map();
  for (const row of AUDITED_LABOR_ITEMS) {
    if (!row.active) continue;
    if (!tree.has(row.category)) tree.set(row.category, new Set());
    if (row.subcategory) tree.get(row.category).add(row.subcategory);
  }
  return [...tree.entries()]
    .map(([category, subs]) => ({ category, subcategories: [...subs].sort() }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function verificationSummary(rows = AUDITED_LABOR_ITEMS) {
  const units = rows.flatMap((row) => row.labor_units || []);
  return {
    items: rows.length,
    units: units.length,
    experimental: units.filter((unit) => unit.source_type === "experimental").length,
    unverified: units.filter((unit) => unit.verification_status === "unverified").length,
    verified: units.filter((unit) => unit.verification_status === "verified").length,
    productionAllowed: units.filter((unit) => unit.production_allowed).length,
  };
}

function primaryUnit(row) {
  return (row.labor_units || []).find((unit) => unit.normal_mh != null) || row.labor_units?.[0] || null;
}

function scoreLibraryItem(row, text, category, unit) {
  if (!categoriesCompatible(row.category, category)) return 0;
  if (!unitsCompatible(row.unit, unit)) return 0;
  if (row.size && !textHasSize(text, row.size)) return 0;

  const nameTokens = [...new Set(tokens(`${row.item_name} ${row.material_type}`))];
  const textTokens = new Set(tokens(text));
  let shared = 0;
  let extra = 0;
  for (const word of nameTokens) {
    if (text.includes(word) || textTokens.has(word)) shared += word.length + 2;
    else extra += 6;
  }
  if (!shared) return 0;

  let score = shared - extra;
  const material = String(row.material_type || "").toLowerCase();
  if (material && text.includes(material)) score += 10;
  if (row.size && textHasSize(text, row.size)) score += 12;
  if (categoriesCompatible(row.category, category)) score += 3;
  return score > 0 ? score : 0;
}

function mhForDisplayUnit(itemUnit, takeoffUnit, mh) {
  const display = canonicalLengthUnit(takeoffUnit);
  const item = canonicalLengthUnit(itemUnit);
  if (display === "100 LF" && item === "LF") return mh * 100;
  if (display === "LF" && item === "100 LF") return mh / 100;
  return mh;
}

export function matchAuditedLaborHours({ category, symbol, unit, items, minScore = 0 } = {}) {
  const catalog = items?.length ? items : AUDITED_LABOR_ITEMS;
  const text = `${category || ""} ${symbol || ""}`.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const row of catalog) {
    const laborUnit = primaryUnit(row);
    if (!laborUnit || laborUnit.normal_mh == null) continue;
    const score = scoreLibraryItem(row, text, category, unit);
    if (score > bestScore) {
      best = { row, laborUnit };
      bestScore = score;
    }
  }
  if (!best || bestScore < minScore) return null;

  const mh = mhForDisplayUnit(best.row.unit, unit, best.laborUnit.normal_mh);
  const basis = best.row.unit === "LF" ? `${best.laborUnit.normal_mh} MH / LF` : `${best.laborUnit.normal_mh} MH each`;
  return {
    laborItemId: best.row.id,
    laborUnitId: best.laborUnit.id,
    mhPerUnit: Math.round(mh * 10000) / 10000,
    sourceType: "experimental",
    sourceName: EXPERIMENTAL_LABOR_SOURCE.name,
    verificationStatus: "unverified",
    productionAllowed: false,
    note: `${basis}, normal. ${EXPERIMENTAL_LABOR_SOURCE.warning}`,
    item: best.row,
    unit: best.laborUnit,
  };
}
