import { assignLaborHours } from "../labor/libraryDocument.js";
import { applySelectionToLine, lineLaborHours, makeLaborSelection } from "../labor/selection.js";
import { defaultProductivityFactors } from "../labor/productivity.js";

export const UNMATCHED_LABOR_NOTE = "No labor-library match. Enter man-hours.";
export const MANUAL_LABOR_MIN_SCORE = 8;

const ITEM_TYPE_CATEGORY = {
  Conduit: "Raceway",
  Fixture: "Lighting",
  Wire: "Wire / Cable",
  Gear: "Panels / MCC",
};

const LOOKUP_KEYS = new Set(["description", "category", "unit", "itemType"]);

export function isManualLaborLookupKey(key) {
  return LOOKUP_KEYS.has(key);
}

export function isLaborAutoNote(notes) {
  const text = String(notes || "");
  if (!text) return true;
  return text === UNMATCHED_LABOR_NOTE
    || text.includes("Experimental / unverified")
    || text.includes("Experimental baseline")
    || text.includes("No labor-library match")
    || text.includes("Baseline library");
}

function categoryForLine(line) {
  return String(line.category || "").trim() || ITEM_TYPE_CATEGORY[line.itemType] || "";
}

export function lookupManualLineLabor(line, { items } = {}) {
  const description = String(line.description || "").trim();
  const category = categoryForLine(line);
  if (!description && !category) {
    return {
      laborItemId: "",
      mhPerUnit: 0,
      sourceType: "custom",
      sourceName: "",
      verificationStatus: "unverified",
      productionAllowed: false,
      note: "",
    };
  }
  return assignLaborHours({
    category,
    symbol: description,
    unit: line.unit,
    items,
    minScore: MANUAL_LABOR_MIN_SCORE,
    allowCategoryFallback: false,
  });
}

export function shouldHydrateManualLabor(line) {
  if (line.laborMatchStatus === "overridden") return false;
  if (line.laborMhEdited && Number(line.laborMhPerUnit) > 0) return false;
  if (line.laborItemId && Number(line.laborMhPerUnit) > 0) return false;
  return Boolean(String(line.description || "").trim() || String(line.category || "").trim());
}

export function hydrateManualLineLabor(line, options = {}) {
  if (!shouldHydrateManualLabor(line)) return line;
  return applyManualLineLabor(line, options);
}

export function applyManualLineLabor(line, { items, factors, rate } = {}) {
  const description = String(line.description || "").trim();
  const category = categoryForLine(line);
  if (!description && !category) {
    return {
      ...line,
      laborMatchStatus: line.laborMhEdited ? "overridden" : "",
    };
  }

  const labor = lookupManualLineLabor(line, { items });
  if (!labor?.laborItemId || !labor.mhPerUnit) {
    return {
      ...line,
      laborMhPerUnit: 0,
      laborItemId: "",
      laborSource: "",
      laborSelection: null,
      laborMatchStatus: "unmatched",
      laborMhEdited: false,
      notes: isLaborAutoNote(line.notes) ? UNMATCHED_LABOR_NOTE : line.notes,
    };
  }

  const selection = makeLaborSelection({
    laborItemId: labor.laborItemId,
    option: {
      sourceType: labor.sourceType || "experimental",
      mh: labor.mhPerUnit,
      sourceRecordId: labor.laborUnitId || "",
      sourceName: labor.sourceName,
      verificationStatus: labor.verificationStatus || "unverified",
      productionAllowed: false,
      warning: labor.note,
    },
    factors: factors || line.laborSelection?.factors || defaultProductivityFactors(),
    acknowledgedUnverified: line.laborSelection?.acknowledgedUnverified || false,
  });
  const keepNotes = !isLaborAutoNote(line.notes);
  const applied = applySelectionToLine(line, selection, {
    rate: line.laborRateEdited ? line.laborRate : rate,
  });
  return {
    ...applied,
    notes: keepNotes ? line.notes : applied.notes,
    laborMatchStatus: "matched",
    laborMhEdited: false,
  };
}

export function manualLineHours(line, factors) {
  return lineLaborHours(line, factors).estimatedHours;
}
