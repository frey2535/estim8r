import { applySelectionToLine, makeLaborSelection } from "../labor/selection.js";
import { defaultProductivityFactors } from "../labor/productivity.js";
import { EXPERIMENTAL_LABOR_SOURCE } from "../labor/sources.js";

export const UNMATCHED_LABOR_NOTE = "No labor-library match. Enter man-hours.";
export const CONDUIT_STICK_FEET = 10;
export const FEET_UNITS = new Set(["LF", "100 LF", "1000 LF"]);

const ITEM_TYPE_FOR_CATEGORY = [
  [/raceway/i, "Conduit"],
  [/lighting/i, "Fixture"],
  [/wire|cable/i, "Wire"],
  [/panel|mcc|distribution/i, "Gear"],
];

export function laborItemSearchText(item) {
  return [item?.id, item?.item_name, item?.description, item?.category, item?.subcategory, item?.material_type, item?.size, item?.unit]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterLaborLibrary(items = [], query = "", { limit = 40 } = {}) {
  const words = String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = [];
  for (const item of items) {
    if (item?.active === false) continue;
    const blob = laborItemSearchText(item);
    if (words.length && !words.every((word) => blob.includes(word))) continue;
    rows.push(item);
    if (rows.length >= limit) break;
  }
  return rows;
}

function primaryLaborUnit(item) {
  return (item?.labor_units || []).find((unit) => unit.normal_mh != null) || item?.labor_units?.[0] || null;
}

export function isConduitLaborItem(item) {
  if (!item) return false;
  const unit = String(item.unit || "");
  return unit === "LF" || unit === "100 LF" || /raceway/i.test(item.category || "");
}

export function isConduitEstimateLine(line, item) {
  if (line?.quantityBasis === "sticks") return true;
  if (line?.itemType === "Conduit") return true;
  if (/raceway/i.test(line?.category || "")) return true;
  return isConduitLaborItem(item);
}

export function quantityIsFeet(line) {
  if (line?.quantityBasis === "feet") return true;
  return FEET_UNITS.has(String(line?.unit || "").toUpperCase());
}

export function laborInstallQuantity(line, item) {
  const qty = Number(line?.quantity) || 0;
  if (line?.source && line.source !== "manual") return qty;
  if (!isConduitEstimateLine(line, item)) return qty;
  if (quantityIsFeet(line)) return qty;
  return qty * CONDUIT_STICK_FEET;
}

export function estimateLineHours(line, item) {
  const hours = laborInstallQuantity(line, item) * (Number(line?.laborMhPerUnit) || 0);
  return Math.round((hours + Number.EPSILON) * 10000) / 10000;
}

export function estimateLineLaborCost(line, item) {
  return Math.round((estimateLineHours(line, item) * (Number(line?.laborRate) || 0) + Number.EPSILON) * 100) / 100;
}

export function libraryMhPerLinearUnit(item) {
  const laborUnit = primaryLaborUnit(item);
  if (!laborUnit || laborUnit.normal_mh == null) return 0;
  if (item.unit === "100 LF") return laborUnit.normal_mh / 100;
  if (item.unit === "1000 LF") return laborUnit.normal_mh / 1000;
  return laborUnit.normal_mh;
}

export function laborItemLabel(item) {
  if (!item) return "";
  return [item.item_name, item.size, item.unit].filter(Boolean).join(" · ");
}

function itemTypeFor(item) {
  const category = item?.category || "";
  const mapped = ITEM_TYPE_FOR_CATEGORY.find(([pattern]) => pattern.test(category));
  if (mapped) return mapped[1];
  if (item?.unit === "EA") return "Device";
  return "Material";
}

function quantityBasisFor(line, item) {
  if (!isConduitLaborItem(item)) return "each";
  return quantityIsFeet(line) ? "feet" : "sticks";
}

function displayUnitFor(line, item) {
  if (!isConduitLaborItem(item)) return item.unit || line.unit || "EA";
  if (quantityIsFeet(line)) return FEET_UNITS.has(String(line.unit || "").toUpperCase()) ? line.unit : "LF";
  return line.unit && !FEET_UNITS.has(String(line.unit).toUpperCase()) ? line.unit : "STICK";
}

export function applyLibraryItemToLine(line, item, { factors, rate } = {}) {
  const laborUnit = primaryLaborUnit(item);
  if (!item || !laborUnit || laborUnit.normal_mh == null) {
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

  const mh = libraryMhPerLinearUnit(item);
  const selection = makeLaborSelection({
    laborItemId: item.id,
    option: {
      sourceType: laborUnit.source_type || "experimental",
      mh,
      sourceRecordId: laborUnit.id || "",
      sourceName: laborUnit.source_name || EXPERIMENTAL_LABOR_SOURCE.name,
      verificationStatus: laborUnit.verification_status || "unverified",
      productionAllowed: false,
      warning: laborUnit.notes || EXPERIMENTAL_LABOR_SOURCE.warning,
    },
    factors: factors || line.laborSelection?.factors || defaultProductivityFactors(),
    acknowledgedUnverified: line.laborSelection?.acknowledgedUnverified || false,
  });
  const keepNotes = !isLaborAutoNote(line.notes);
  const keepDescription = Boolean(String(line.description || "").trim());
  const applied = applySelectionToLine({
    ...line,
    category: item.category || line.category || "",
    itemType: itemTypeFor(item),
    unit: displayUnitFor(line, item),
    quantityBasis: quantityBasisFor(line, item),
    description: keepDescription ? line.description : laborItemLabel(item),
  }, selection, {
    rate: line.laborRateEdited ? line.laborRate : rate,
  });
  return {
    ...applied,
    notes: keepNotes ? line.notes : applied.notes,
    laborMatchStatus: "matched",
    laborMhEdited: false,
  };
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

export function findLibraryItem(items, line) {
  if (!line?.laborItemId) return null;
  return (items || []).find((row) => row.id === line.laborItemId) || null;
}

export function applyManualLineLabor(line, { items, factors, rate } = {}) {
  const item = findLibraryItem(items, line);
  if (item) return applyLibraryItemToLine(line, item, { factors, rate });
  if (line.laborItemId) {
    return {
      ...line,
      laborMhPerUnit: line.laborMhEdited ? line.laborMhPerUnit : 0,
      laborMatchStatus: "unmatched",
      notes: isLaborAutoNote(line.notes) ? UNMATCHED_LABOR_NOTE : line.notes,
    };
  }
  return {
    ...line,
    laborMatchStatus: line.laborMhEdited ? "overridden" : "",
  };
}

export function shouldHydrateManualLabor(line) {
  if (line.laborMatchStatus === "overridden") return false;
  if (line.laborMhEdited && Number(line.laborMhPerUnit) > 0) return false;
  return Boolean(line.laborItemId);
}

export function hydrateManualLineLabor(line, options = {}) {
  if (!shouldHydrateManualLabor(line)) return line;
  return applyManualLineLabor(line, options);
}

export function conduitQtyHint(line, item) {
  if (!isConduitEstimateLine(line, item)) return "";
  const qty = Number(line.quantity) || 0;
  const install = laborInstallQuantity(line, item);
  if (quantityIsFeet(line)) return `${install} LF entered as feet`;
  return `${qty} stick${qty === 1 ? "" : "s"} × ${CONDUIT_STICK_FEET}' = ${install} LF for labor`;
}
