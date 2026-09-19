/**
 * Production-ready rows from Estim8r_Source_Audited_Electrical_Labor_Database.xlsx
 * (Production Import / Labor Database Production Ready = YES).
 * Shape matches labor_items + labor_units as the Labor Library page reads them.
 */
export const AUDITED_LABOR_SOURCE = {
  workbook: "Estim8r_Source_Audited_Electrical_Labor_Database.xlsx",
  sheet: "Production Import",
  name: "NECA MLU public sample",
  edition: "2021-2022",
};

const SAMPLE_URL =
  "https://www.necanet.org/docs/default-source/education/publications/4090-21_2021-2022mlu_page202revised.pdf?sfvrsn=52e712c0_3";

function unitRecord(itemId, values) {
  return {
    id: `${itemId}-neca-mlu-public-sample`,
    labor_item_id: itemId,
    source_type: "published_reference",
    source_name: AUDITED_LABOR_SOURCE.name,
    source_year: AUDITED_LABOR_SOURCE.edition,
    source_reference: SAMPLE_URL,
    normal_mh: values.normal,
    difficult_mh: values.difficult,
    very_difficult_mh: values.veryDifficult,
    verification_status: "verified",
    production_allowed: true,
    notes: values.notes,
  };
}

function item(row) {
  return {
    id: row.id,
    trade: "Electrical",
    category: row.category,
    subcategory: row.subcategory,
    item_name: row.itemName,
    description: row.notes,
    material_type: row.material,
    size: row.size,
    unit: row.unit,
    default_crew: "",
    active: true,
    labor_units: [
      unitRecord(row.id, {
        normal: row.normal,
        difficult: row.difficult,
        veryDifficult: row.veryDifficult,
        notes: row.notes,
      }),
    ],
  };
}

export const AUDITED_LABOR_ITEMS = [
  item({
    id: "EL-00050",
    category: "Raceways",
    subcategory: "Conduit Installation",
    itemName: "Install EMT",
    size: "3/4 in",
    material: "EMT",
    unit: "LF",
    normal: 0.05,
    difficult: 0.062,
    veryDifficult: 0.075,
    notes: "NECA sample lists 5.00/6.20/7.50 per C; normalized here to MH per LF for Estim8r.",
  }),
  item({
    id: "EL-00051",
    category: "Raceways",
    subcategory: "Fittings",
    itemName: "Install EMT Connector",
    size: "3/4 in",
    material: "EMT",
    unit: "EA",
    normal: 0.1,
    difficult: 0.12,
    veryDifficult: 0.15,
    notes: "Official NECA public sample: EMT set-screw box connector, each.",
  }),
  item({
    id: "EL-00052",
    category: "Raceways",
    subcategory: "Fittings",
    itemName: "Install EMT Coupling",
    size: "3/4 in",
    material: "EMT",
    unit: "EA",
    normal: 0.05,
    difficult: 0.06,
    veryDifficult: 0.07,
    notes: "Official NECA public sample: EMT set-screw coupling, each.",
  }),
  item({
    id: "EL-00053",
    category: "Raceways",
    subcategory: "Fittings",
    itemName: "Install EMT Factory elbow",
    size: "3/4 in",
    material: "EMT",
    unit: "EA",
    normal: 0.22,
    difficult: 0.27,
    veryDifficult: 0.33,
    notes: "Official NECA public sample: EMT factory elbow, each.",
  }),
  item({
    id: "EL-00061",
    category: "Raceways",
    subcategory: "Conduit Installation",
    itemName: "Install EMT",
    size: "1 in",
    material: "EMT",
    unit: "LF",
    normal: 0.055,
    difficult: 0.068,
    veryDifficult: 0.082,
    notes: "NECA sample lists 5.50/6.80/8.20 per C; normalized here to MH per LF for Estim8r.",
  }),
];

const QUALIFIERS = ["connector", "coupling", "elbow", "factory"];

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
  if (token === "1") {
    return /(?<![0-9/-])1(?![0-9/-])/.test(haystack);
  }
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
  const left = itemCategory.toLowerCase().replace(/s$/, "");
  const right = takeoffCategory.toLowerCase().replace(/s$/, "");
  return left === right || left.includes(right) || right.includes(left);
}

function qualifierMismatch(itemName, text) {
  const name = itemName.toLowerCase();
  return QUALIFIERS.some((word) => name.includes(word) !== text.includes(word));
}

function searchBlob(row) {
  return [row.item_name, row.description, row.subcategory, row.material_type, row.size, row.category, row.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function listBundledLaborLibrary({ search = "", category = "", limit = 250 } = {}) {
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

function productionUnit(row) {
  return (row.labor_units || []).find((unit) => unit.verification_status === "verified" && unit.production_allowed);
}

function scoreAuditedItem(row, text, category, unit) {
  if (!categoriesCompatible(row.category, category)) return 0;
  if (!unitsCompatible(row.unit, unit)) return 0;
  if (qualifierMismatch(row.item_name, text)) return 0;
  if (row.size && !textHasSize(text, row.size)) return 0;

  let score = 0;
  const material = String(row.material_type || "").toLowerCase();
  if (material && text.includes(material.toLowerCase())) score += 10;
  for (const word of String(row.item_name).toLowerCase().split(/\s+/)) {
    if (word.length > 2 && text.includes(word)) score += word.length + 2;
  }
  if (row.size && textHasSize(text, row.size)) score += 8;
  if (!score) return 0;
  return score;
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
    const laborUnit = productionUnit(row);
    if (!laborUnit) continue;
    const score = scoreAuditedItem(row, text, category, unit);
    if (score > bestScore) {
      best = { row, laborUnit };
      bestScore = score;
    }
  }
  if (!best) return null;

  const mh = mhForDisplayUnit(best.row.unit, unit, best.laborUnit.normal_mh);
  const basis = best.row.unit === "LF" ? `${best.laborUnit.normal_mh} MH / LF` : `${best.laborUnit.normal_mh} MH each`;
  return {
    laborItemId: best.row.id,
    mhPerUnit: Math.round(mh * 10000) / 10000,
    sourceName: `${best.laborUnit.source_name} (${best.laborUnit.source_year})`,
    note: `${basis}, normal. Verified production labor. ${best.laborUnit.notes}`,
  };
}
