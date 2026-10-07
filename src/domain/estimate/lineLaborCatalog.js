import { AUDITED_LABOR_ITEMS } from "../labor/auditedLibrary.js";

function norm(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function materialIs(item, ...needles) {
  const mat = norm(item?.material_type || item?.materialType);
  return needles.some((needle) => mat === norm(needle));
}

function materialHas(item, ...needles) {
  const mat = norm(item?.material_type || item?.materialType);
  const name = norm(item?.item_name || item?.itemName);
  return needles.some((needle) => {
    const token = norm(needle);
    return mat.includes(token) || name.includes(token);
  });
}

export const LINE_TYPES = [
  "Conduit",
  "Wire",
  "Fixture",
  "Device",
  "Gear",
  "Box",
  "Equipment",
  "Fire alarm",
  "Low voltage",
  "Labor",
  "Material",
  "Subcontract",
  "Allowance",
  "Other",
];

/** Every uploaded manual category maps to a line Type. Nothing is left off. */
export const TYPE_FOR_LIBRARY_CATEGORY = {
  Raceways: "Conduit",
  Conductors: "Wire",
  Lighting: "Fixture",
  "Site Lighting & Signs": "Fixture",
  Devices: "Device",
  Distribution: "Gear",
  Boxes: "Box",
  "Equipment Connections": "Equipment",
  Motors: "Equipment",
  "Motor Control": "Equipment",
  "Emergency Power": "Equipment",
  "EV Charging": "Equipment",
  "Renewable Energy": "Equipment",
  "Marine/Marina": "Equipment",
  "Special Systems": "Equipment",
  "Life Safety": "Fire alarm",
  Communications: "Low voltage",
  Security: "Low voltage",
  "Fiber Optics": "Low voltage",
  Automation: "Low voltage",
  Grounding: "Labor",
  "Site/Earthwork": "Labor",
  Demolition: "Labor",
  Prefabrication: "Labor",
  "Project Labor": "Labor",
  "Testing & Commissioning": "Labor",
  Residential: "Labor",
};

/** Saved-estimate labels from the old allow-list. Match existing rows only. */
const LEGACY_CATEGORY_MATCHERS = [
  { type: "Conduit", label: "EMT conduit", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "EMT") },
  { type: "Conduit", label: "PVC conduit", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "PVC Sch 40", "PVC Sch 80") },
  { type: "Conduit", label: "GRC / RMC", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "RMC Steel", "RMC Aluminum") },
  { type: "Conduit", label: "IMC", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "IMC") },
  { type: "Conduit", label: "FMC / flex", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "FMC") },
  { type: "Conduit", label: "LFMC", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "LFMC") },
  { type: "Conduit", label: "ENT", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "ENT") },
  { type: "Conduit", label: "HDPE", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "HDPE") },
  { type: "Conduit", label: "Fiberglass / RTRC", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "RTRC/Fiberglass") },
  { type: "Conduit", label: "PVC-coated RMC", match: (item) => item.category === "Raceways" && item.subcategory === "Conduit Installation" && materialIs(item, "PVC Coated RMC") },
  { type: "Conduit", label: "EMT fittings", match: (item) => item.category === "Raceways" && item.subcategory === "Fittings" && materialIs(item, "EMT") },
  { type: "Conduit", label: "PVC fittings", match: (item) => item.category === "Raceways" && item.subcategory === "Fittings" && materialIs(item, "PVC Sch 40", "PVC Sch 80") },
  { type: "Conduit", label: "GRC fittings", match: (item) => item.category === "Raceways" && item.subcategory === "Fittings" && materialIs(item, "RMC Steel", "RMC Aluminum") },
  { type: "Wire", label: "THHN", match: (item) => item.category === "Conductors" && materialHas(item, "THHN") },
  { type: "Wire", label: "XHHW", match: (item) => item.category === "Conductors" && materialHas(item, "XHHW") },
  { type: "Wire", label: "MC", match: (item) => materialHas(item, "MC cable") },
  { type: "Device", label: "Receptacles", match: (item) => item.category === "Devices" && /receptacle/i.test(`${item.item_name || item.itemName || ""} ${item.material_type || ""}`) },
  { type: "Device", label: "Switches", match: (item) => item.category === "Devices" && /switch|dimmer/i.test(`${item.item_name || item.itemName || ""} ${item.material_type || ""}`) },
  { type: "Gear", label: "Panels", match: (item) => item.category === "Distribution" && /panel/i.test(`${item.subcategory} ${item.material_type}`) },
  { type: "Gear", label: "Transformers", match: (item) => item.category === "Distribution" && /transformer/i.test(`${item.subcategory} ${item.material_type} ${item.item_name || ""}`) },
  { type: "Gear", label: "Switchgear", match: (item) => item.category === "Distribution" && /switchgear|switchboard/i.test(`${item.subcategory} ${item.material_type}`) },
  { type: "Gear", label: "Breakers", match: (item) => item.category === "Distribution" && /breaker/i.test(`${item.subcategory} ${item.material_type} ${item.item_name || ""}`) },
  { type: "Equipment", label: "Generator installation", match: (item) => item.category === "Emergency Power" && (item.subcategory === "Generators" || materialIs(item, "Generator")) },
  { type: "Gear", label: "Generator installation", match: (item) => item.category === "Emergency Power" && (item.subcategory === "Generators" || materialIs(item, "Generator")) },
  { type: "Labor", label: "Generator installation", match: (item) => item.category === "Emergency Power" && (item.subcategory === "Generators" || materialIs(item, "Generator")) },
];

function libraryCategory(item) {
  return String(item?.category || "").trim();
}

function librarySubcategory(item) {
  return String(item?.subcategory || "").trim();
}

function itemName(item) {
  return String(item?.item_name || item?.itemName || "");
}

export function isTransferSwitchItem(item) {
  if (!item) return false;
  if (librarySubcategory(item) === "ATS") return true;
  if (materialIs(item, "ATS")) return true;
  const blob = `${librarySubcategory(item)} ${itemName(item)} ${item?.material_type || item?.materialType || ""}`.toLowerCase();
  return /transfer switch/.test(blob) || /(?<![a-z])ats(?![a-z])/.test(blob);
}

export function lineTypeForLibraryItem(item) {
  const category = libraryCategory(item);
  if (!category) return "";
  return TYPE_FOR_LIBRARY_CATEGORY[category] || "Labor";
}

/** Gear is installed equipment. Users open either Type, so both list the same rows. */
export function lineTypesForLibraryItem(item) {
  const types = new Set();
  const primary = lineTypeForLibraryItem(item);
  if (primary) types.add(primary);
  if (primary === "Gear") types.add("Equipment");
  if (primary === "Equipment") types.add("Gear");
  return [...types];
}

function activityLabelsForItem(item) {
  const types = lineTypesForLibraryItem(item);
  const blob = `${librarySubcategory(item)} ${itemName(item)}`.toLowerCase();
  const labels = [];
  if (types.includes("Equipment")) {
    if (/terminat/.test(blob)) labels.push("Equipment terminations");
    if (/install|set\/connect|set\/install|connect/.test(blob)) labels.push("Equipment installation");
  }
  if (isTransferSwitchItem(item)) {
    labels.push("Transfer switches");
    labels.push("Emergency Power");
  }
  return labels;
}

export function workCategoriesForItem(item) {
  const labels = [];
  const category = libraryCategory(item);
  const subcategory = librarySubcategory(item);
  if (category) labels.push(category);
  if (subcategory) labels.push(subcategory);
  labels.push(...activityLabelsForItem(item));
  return [...new Set(labels.filter(Boolean))];
}

function catalogItems(items) {
  const rows = Array.isArray(items) && items.length ? items : AUDITED_LABOR_ITEMS;
  return rows.filter((item) => item && item.active !== false);
}

function categoryEquals(left, right) {
  return norm(left) === norm(right);
}

function matchesLegacyCategory(item, type, category) {
  return LEGACY_CATEGORY_MATCHERS.some((row) => (
    row.type === type
    && categoryEquals(row.label, category)
    && row.match(item)
  ));
}

export function laborItemMatchesLine(item, { itemType, category } = {}) {
  if (!item || item.active === false) return false;
  const type = String(itemType || "").trim();
  const cat = String(category || "").trim();
  if (!type) return false;
  if (!lineTypesForLibraryItem(item).includes(type)) {
    return Boolean(cat && matchesLegacyCategory(item, type, cat));
  }
  if (!cat) return true;
  if (workCategoriesForItem(item).some((label) => categoryEquals(label, cat))) return true;
  return matchesLegacyCategory(item, type, cat);
}

export function laborItemsForLine(items = [], line = {}) {
  return catalogItems(items).filter((item) => laborItemMatchesLine(item, line));
}

export function categoriesForType(type, items) {
  const wanted = String(type || "").trim();
  if (!wanted) return [];
  const labels = new Set();
  for (const item of catalogItems(items)) {
    if (!lineTypesForLibraryItem(item).includes(wanted)) continue;
    for (const label of workCategoriesForItem(item)) labels.add(label);
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}

export function defaultCategoryForType() {
  return "";
}

export function laborPickerPlaceholder(line) {
  if (!line?.itemType) return "Select Type first";
  if (!line?.category) return `Search ${line.itemType} labor…`;
  return `Search ${line.category}…`;
}

export function unmappedLibraryCategories(items) {
  const missing = new Set();
  for (const item of catalogItems(items)) {
    const category = libraryCategory(item);
    if (category && !TYPE_FOR_LIBRARY_CATEGORY[category]) missing.add(category);
  }
  return [...missing].sort();
}

export function unreachableCatalogRows(items) {
  const missing = [];
  for (const item of catalogItems(items)) {
    const types = lineTypesForLibraryItem(item);
    const categories = workCategoriesForItem(item);
    if (!item.id) missing.push({ id: "", reason: "missing-id", category: libraryCategory(item) });
    if (!types.length) missing.push({ id: item.id, reason: "no-type", category: libraryCategory(item) });
    if (!categories.length) missing.push({ id: item.id, reason: "no-work-category", category: libraryCategory(item) });
    for (const type of types) {
      if (!laborItemMatchesLine(item, { itemType: type })) {
        missing.push({ id: item.id, reason: "missing-from-type", itemType: type, category: libraryCategory(item) });
      }
      const listed = laborItemsForLine(items, { itemType: type });
      if (!listed.some((row) => row.id === item.id)) {
        missing.push({ id: item.id, reason: "missing-from-type-list", itemType: type, category: libraryCategory(item) });
      }
      for (const workCategory of categories) {
        if (!laborItemMatchesLine(item, { itemType: type, category: workCategory })) {
          missing.push({
            id: item.id,
            reason: "missing-from-work-category",
            itemType: type,
            workCategory,
            category: libraryCategory(item),
          });
        }
      }
    }
  }
  return missing;
}
