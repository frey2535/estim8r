import { materialQuantity } from "./materialQuantity.js";
import { findLibraryItem, laborItemLabel } from "./manualLineLabor.js";
import { buildSupplyQuotePdf, supplyQuoteFileBase } from "../takeoff/supplyQuote.js";
import { readCompanyBranding } from "./branding.js";

/** Library categories that are labor/civil work, not a supply-house buy list. */
export const LABOR_ONLY_LIBRARY_CATEGORIES = new Set([
  "Site/Earthwork",
  "Demolition",
  "Prefabrication",
  "Project Labor",
  "Testing & Commissioning",
]);

/** Labor-type catalog rows that still name something the supply house sells. */
export const BUY_LIST_LABOR_CATEGORIES = new Set([
  "Grounding",
  "Residential",
]);

export const BUY_LIST_LINE_TYPES = new Set([
  "Conduit",
  "Wire",
  "Fixture",
  "Device",
  "Gear",
  "Box",
  "Equipment",
  "Fire alarm",
  "Low voltage",
  "Material",
]);

const LABOR_ONLY_TEXT = /site\s*\/?\s*earthwork|hand\s*trench|sawcut(?:ting)?(?:\s+\w+)*\s*(?:asphalt|concrete)|mini excavator trench|backhoe trench|\btrencher\b|concrete encasement|patch (?:asphalt|concrete)|core drill|excavate (?:equipment|pole)|locate\/mark trench|hand expose existing|place sand bedding|backfill\/compact|journeyman supervision|project superintendent|project management|daily cleanup|mobilization\/demobilization|circuit tracing|as-built field markup|prefab |material kitting|material handling|remove (?:receptacle|light|panel|transformer|conduit|wire|data)/i;

/**
 * @param {any} line
 */
export function estimateLineHasQuoteData(line) {
  if (!line) return false;
  return Boolean(
    String(line.itemType || "").trim()
    || String(line.category || "").trim()
    || String(line.description || "").trim()
    || String(line.laborItemId || "").trim()
    || String(line.model || "").trim(),
  );
}

/**
 * @param {any} line
 */
export function knownEstimateModel(line) {
  const raw = line?.model ?? line?.modelNumber ?? line?.catalogNumber ?? line?.catalogNo ?? "";
  return String(raw).trim();
}

/**
 * @param {any} line
 */
export function estimateQuoteDevice(line) {
  return String(line?.category || line?.itemType || "").trim();
}

/**
 * @param {any} line
 * @param {any} laborItem
 */
export function estimateQuoteDescription(line, laborItem) {
  const description = String(line?.description || "").trim() || laborItemLabel(laborItem) || "Line";
  return description.replace(/^(?:install|replace|mount|pull|connect)\s+/i, "");
}

function catalogCategory(line, laborItem) {
  return String(laborItem?.category || line?.category || "").trim();
}

function laborOnlyBlob(line, laborItem) {
  return [
    line?.itemType,
    line?.category,
    line?.description,
    laborItem?.category,
    laborItem?.subcategory,
    laborItem?.item_name,
    laborItem?.itemName,
  ].filter(Boolean).join(" ");
}

/**
 * @param {any} item
 */
export function isLaborOnlyCatalogItem(item) {
  if (!item) return false;
  return LABOR_ONLY_LIBRARY_CATEGORIES.has(String(item.category || "").trim());
}

/**
 * @param {any} category
 */
export function isBuyListLaborCategory(category) {
  return BUY_LIST_LABOR_CATEGORIES.has(String(category || "").trim());
}

/**
 * @param {any} line
 * @param {any} laborItem
 */
export function isLaborOnlySupplyQuoteLine(line, laborItem) {
  if (isLaborOnlyCatalogItem(laborItem)) return true;
  const category = catalogCategory(line, laborItem);
  if (LABOR_ONLY_LIBRARY_CATEGORIES.has(category)) return true;
  if (LABOR_ONLY_TEXT.test(laborOnlyBlob(line, laborItem))) return true;
  const type = String(line?.itemType || "").trim();
  if (type === "Subcontract" || type === "Allowance") return true;
  if (type === "Labor" && !isBuyListLaborCategory(category)) return true;
  return false;
}

/**
 * @param {any} line
 * @param {any} laborItem
 */
export function estimateLineBelongsOnSupplyQuote(line, laborItem) {
  if (!estimateLineHasQuoteData(line)) return false;
  const explicitMaterial = line?.isMaterial === true || line?.lineKind === "material" || Number(line?.materialUnitCost) > 0;
  const explicitLabor = line?.lineKind === "labor" || line?.isMaterial === false;
  const lineType = String(line?.itemType || "").trim().toLowerCase();
  if (explicitLabor || ["subcontract", "allowance", "service"].includes(lineType)) return false;
  if (explicitMaterial) return true;
  if (isLaborOnlySupplyQuoteLine(line, laborItem)) return false;
  // Estimate lines can be assigned a material-like type while their actual
  // description is an installation task. Never send such work to a supplier.
  const description = String(line?.description || laborItem?.item_name || laborItem?.itemName || "").trim();
  const workDescription = /^(?:install(?:ation)?|remove|replace|relocate|terminate|connect|disconnect|test|commission|troubleshoot|pull(?:ing)?|route|rough[- ]?in|mount|set up|configure|program|inspect|repair|service|labor|work)\b/i;
  if (workDescription.test(description)) return false;
  const activityCategory = /^(?:device install|generator installation|equipment termination|wire\/?cable pulling|project labor|installation labor|testing(?:\s*&\s*commissioning)?)$/i;
  const category = String(line?.category || "").trim();
  // A labor activity category is not a material category. Only an explicit
  // purchasable-material classification can override it.
  if (activityCategory.test(category) && line?.isMaterial !== true && line?.lineKind !== "material") return false;
  const type = String(line?.itemType || "").trim().toLowerCase();
  // A labor catalog selection describes work to install a product, not a
  // purchase order for that product. Require a material/equipment line type.
  if (["labor", "subcontract", "allowance", "service"].includes(type)) return false;
  const materialTypes = new Set([...BUY_LIST_LINE_TYPES].map((value) => value.toLowerCase()));
  if (materialTypes.has(type)) return true;
  // Explicit material-only lines may come from integrations without a type.
  return line?.isMaterial === true || line?.lineKind === "material";
}

/**
 * @param {Record<string, any>} lines
 */
export function buildEstimateSupplyQuote({
  lines = [],
  itemized = false,
  library = [],
  projectName = "",
  fileName = "",
} = {}) {
  const rows = [];
  for (const line of lines) {
    if (itemized && line.included === false) continue;
    const laborItem = findLibraryItem(library, line);
    if (!estimateLineBelongsOnSupplyQuote(line, laborItem)) continue;
    if (materialQuantity(line) <= 0) continue;
    rows.push({
      id: line.id,
      device: estimateQuoteDevice(line),
      model: knownEstimateModel(line),
      description: estimateQuoteDescription(line, laborItem),
      quantity: materialQuantity(line),
      unit: line.unit || "",
    });
  }
  const quantity = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const name = String(projectName || "").trim()
    || String(fileName || "").replace(/^standalone:/, "").replace(/\.[^.]+$/, "")
    || "Estimate";
  return {
    title: "Supply house material quote",
    projectName: name,
    fileBase: supplyQuoteFileBase(name),
    generatedAt: new Date().toISOString(),
    emptyDescription: "No supply-house items yet",
    modelNote: "Model numbers are only listed when entered on the estimate line. Labor-only work stays on the estimate.",
    totalLabel: `Total ${quantity}`,
    rows,
    totals: { quantity, items: rows.length },
  };
}

/**
 * @param {any} quote
 */
export function supplyQuotePreviewKey(quote) {
  return JSON.stringify({
    title: quote?.title || "",
    projectName: quote?.projectName || "",
    fileBase: quote?.fileBase || "",
    modelNote: quote?.modelNote || "",
    rows: quote?.rows || [],
    totals: quote?.totals || {},
  });
}

/**
 * @param {any} quote
 */
export function createSupplyQuotePdfPreview(quote) {
  const fileName = `${quote?.fileBase || supplyQuoteFileBase(quote?.projectName)}.pdf`;
  if (!quote?.rows?.length) {
    return { status: "empty", fileName, blob: null, strings: [] };
  }
  const built = buildSupplyQuotePdf(quote, readCompanyBranding());
  return {
    status: "ready",
    fileName: built.fileName,
    blob: built.doc.output("blob"),
    strings: built.strings,
  };
}
