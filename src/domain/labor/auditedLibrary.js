import { AUDITED_LABOR_ITEMS } from "./auditedLibraryData.js";

export { AUDITED_LABOR_ITEMS };

export const AUDITED_LABOR_SOURCE = {
  workbook: "Estim8r_Source_Audited_Electrical_Labor_Database.xlsx",
  sheet: "Labor Database",
  name: "Estim8r electrical labor library",
  edition: "source-audited",
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

function unitsCompatible(itemUnit, takeoffUnit) {
  if (!takeoffUnit) return true;
  if (itemUnit === takeoffUnit) return true;
  return (itemUnit === "LF" && takeoffUnit === "100 LF") || (itemUnit === "100 LF" && takeoffUnit === "LF");
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

function primaryUnit(row) {
  return (row.labor_units || []).find((unit) => unit.normal_mh != null) || row.labor_units?.[0] || null;
}

function scoreLibraryItem(row, text, category, unit) {
  if (!categoriesCompatible(row.category, category)) return 0;
  if (!unitsCompatible(row.unit, unit)) return 0;
  if (row.size && !textHasSize(text, row.size)) return 0;

  const nameTokens = tokens(`${row.item_name} ${row.material_type}`);
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
  const laborUnit = primaryUnit(row);
  if (laborUnit?.production_allowed && laborUnit.verification_status === "verified") score += 5;
  return score > 0 ? score : 0;
}

function mhForDisplayUnit(itemUnit, takeoffUnit, mh) {
  if (takeoffUnit === "100 LF" && itemUnit === "LF") return mh * 100;
  if (takeoffUnit === "LF" && itemUnit === "100 LF") return mh / 100;
  return mh;
}

export function matchAuditedLaborHours({ category, symbol, unit }) {
  const text = `${category || ""} ${symbol || ""}`.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const row of AUDITED_LABOR_ITEMS) {
    const laborUnit = primaryUnit(row);
    if (!laborUnit || laborUnit.normal_mh == null) continue;
    const score = scoreLibraryItem(row, text, category, unit);
    if (score > bestScore) {
      best = { row, laborUnit };
      bestScore = score;
    }
  }
  if (!best) return null;

  const mh = mhForDisplayUnit(best.row.unit, unit, best.laborUnit.normal_mh);
  const basis = best.row.unit === "LF" ? `${best.laborUnit.normal_mh} MH / LF` : `${best.laborUnit.normal_mh} MH each`;
  const verified = best.laborUnit.verification_status === "verified" && best.laborUnit.production_allowed;
  return {
    laborItemId: best.row.id,
    mhPerUnit: Math.round(mh * 10000) / 10000,
    sourceName: `${best.laborUnit.source_name} (${best.laborUnit.source_year || AUDITED_LABOR_SOURCE.edition})`,
    note: verified
      ? `${basis}, normal. Verified production labor. ${best.laborUnit.notes}`
      : `${basis}, normal. ${best.laborUnit.source_name} — not a verified production rate.`,
  };
}
