function norm(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function materialIs(item, ...needles) {
  const mat = norm(item?.material_type);
  return needles.some((needle) => mat === norm(needle));
}

function materialHas(item, ...needles) {
  const mat = norm(item?.material_type);
  const name = norm(item?.item_name);
  return needles.some((needle) => {
    const token = norm(needle);
    return mat.includes(token) || name.includes(token);
  });
}

function racewayInstall(item, ...materials) {
  return item?.category === "Raceways"
    && item?.subcategory === "Conduit Installation"
    && materialIs(item, ...materials);
}

function racewayFittings(item, ...materials) {
  return item?.category === "Raceways"
    && item?.subcategory === "Fittings"
    && materialIs(item, ...materials);
}

function conductorPull(item, ...materials) {
  return item?.category === "Conductors"
    && item?.subcategory === "Building Wire"
    && materialHas(item, ...materials);
}

function cableInstall(item, ...materials) {
  return item?.category === "Conductors"
    && item?.subcategory === "Cable Installation"
    && materialHas(item, ...materials);
}

function lightingFixture(item) {
  if (item?.category !== "Lighting") return false;
  return !/contactor|control panel|sensor/i.test(item.item_name || "");
}

function deviceKind(item, kind) {
  if (item?.category !== "Devices") return false;
  const blob = `${item.material_type || ""} ${item.item_name || ""}`.toLowerCase();
  if (kind === "receptacle") return blob.includes("receptacle");
  if (kind === "switch") return /switch|dimmer/.test(blob);
  return true;
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

const CATEGORY_DEFS = [
  { type: "Conduit", label: "EMT conduit", match: (item) => racewayInstall(item, "EMT") },
  { type: "Conduit", label: "PVC conduit", match: (item) => racewayInstall(item, "PVC Sch 40", "PVC Sch 80") },
  { type: "Conduit", label: "GRC / RMC", match: (item) => racewayInstall(item, "RMC Steel", "RMC Aluminum") },
  { type: "Conduit", label: "IMC", match: (item) => racewayInstall(item, "IMC") },
  { type: "Conduit", label: "FMC / flex", match: (item) => racewayInstall(item, "FMC") },
  { type: "Conduit", label: "LFMC", match: (item) => racewayInstall(item, "LFMC") },
  { type: "Conduit", label: "ENT", match: (item) => racewayInstall(item, "ENT") },
  { type: "Conduit", label: "HDPE", match: (item) => racewayInstall(item, "HDPE") },
  { type: "Conduit", label: "Fiberglass / RTRC", match: (item) => racewayInstall(item, "RTRC/Fiberglass") },
  { type: "Conduit", label: "PVC-coated RMC", match: (item) => racewayInstall(item, "PVC Coated RMC") },
  { type: "Conduit", label: "EMT fittings", match: (item) => racewayFittings(item, "EMT") },
  { type: "Conduit", label: "PVC fittings", match: (item) => racewayFittings(item, "PVC Sch 40", "PVC Sch 80") },
  { type: "Conduit", label: "GRC fittings", match: (item) => racewayFittings(item, "RMC Steel", "RMC Aluminum") },
  { type: "Wire", label: "THHN", match: (item) => conductorPull(item, "THHN") },
  { type: "Wire", label: "XHHW", match: (item) => conductorPull(item, "XHHW") },
  { type: "Wire", label: "MC", match: (item) => cableInstall(item, "MC cable") },
  { type: "Wire", label: "AC", match: (item) => cableInstall(item, "AC cable") },
  { type: "Wire", label: "NM-B", match: (item) => cableInstall(item, "NM-B") },
  { type: "Wire", label: "SER", match: (item) => cableInstall(item, "SER") },
  { type: "Wire", label: "Tray cable", match: (item) => cableInstall(item, "Tray cable") },
  { type: "Wire", label: "VFD cable", match: (item) => cableInstall(item, "VFD") },
  { type: "Wire", label: "SOOW", match: (item) => cableInstall(item, "SOOW") },
  { type: "Wire", label: "MV cable", match: (item) => cableInstall(item, "MV cable") },
  { type: "Fixture", label: "Lighting", match: lightingFixture },
  { type: "Fixture", label: "Site lighting", match: (item) => item?.category === "Site Lighting & Signs" },
  { type: "Device", label: "Receptacles", match: (item) => deviceKind(item, "receptacle") },
  { type: "Device", label: "Switches", match: (item) => deviceKind(item, "switch") },
  { type: "Device", label: "Devices", match: (item) => item?.category === "Devices" },
  { type: "Gear", label: "Panels", match: (item) => item?.category === "Distribution" && /panel/i.test(`${item.subcategory} ${item.material_type}`) },
  { type: "Gear", label: "Transformers", match: (item) => item?.category === "Distribution" && /transformer/i.test(`${item.subcategory} ${item.material_type}`) },
  { type: "Gear", label: "Switchgear", match: (item) => item?.category === "Distribution" && /switchgear|switchboard/i.test(`${item.subcategory} ${item.material_type}`) },
  { type: "Gear", label: "Breakers", match: (item) => item?.category === "Distribution" && /breaker/i.test(`${item.subcategory} ${item.material_type}`) },
  { type: "Box", label: "Boxes", match: (item) => item?.category === "Boxes" },
  { type: "Equipment", label: "Equipment connections", match: (item) => item?.category === "Equipment Connections" },
  { type: "Equipment", label: "Motors", match: (item) => item?.category === "Motors" || item?.category === "Motor Control" },
  { type: "Fire alarm", label: "Fire alarm", match: (item) => item?.category === "Life Safety" },
  { type: "Low voltage", label: "Communications", match: (item) => item?.category === "Communications" },
  { type: "Low voltage", label: "Security", match: (item) => item?.category === "Security" },
  { type: "Low voltage", label: "Fiber", match: (item) => item?.category === "Fiber Optics" },
];

export const DEFAULT_CATEGORY_FOR_TYPE = {
  Conduit: "EMT conduit",
  Wire: "THHN",
  Fixture: "Lighting",
  Device: "Receptacles",
  Gear: "Panels",
  Box: "Boxes",
  Equipment: "Equipment connections",
  "Fire alarm": "Fire alarm",
  "Low voltage": "Communications",
};

export function categoriesForType(type) {
  return CATEGORY_DEFS.filter((row) => row.type === type).map((row) => row.label);
}

export function findCategoryDef(type, category) {
  const label = String(category || "").trim();
  return CATEGORY_DEFS.find((row) => row.type === type && row.label.toLowerCase() === label.toLowerCase()) || null;
}

export function laborItemMatchesLine(item, { itemType, category } = {}) {
  if (!item || item.active === false) return false;
  const type = String(itemType || "").trim();
  const cat = String(category || "").trim();
  if (!type) return false;
  if (cat) {
    const def = findCategoryDef(type, cat);
    return def ? def.match(item) : false;
  }
  return CATEGORY_DEFS.some((row) => row.type === type && row.match(item));
}

export function laborItemsForLine(items = [], line = {}) {
  return (items || []).filter((item) => laborItemMatchesLine(item, line));
}

export function defaultCategoryForType(type) {
  const categories = categoriesForType(type);
  if (!categories.length) return "";
  return DEFAULT_CATEGORY_FOR_TYPE[type] || categories[0];
}

export function laborPickerPlaceholder(line) {
  if (!line?.itemType) return "Select Type first";
  if (!line?.category) return `Select a ${line.itemType} category`;
  return `Search ${line.category}…`;
}
