import { DEVICE_SYMBOLS, DRAWING_CATEGORY } from "./catalog.js";

export const TRADES = [
  { id: "civil", label: "Civil" },
  { id: "electrical", label: "Electrical" },
  { id: "mechanical", label: "Mechanical" },
  { id: "plumbing", label: "Plumbing" },
  { id: "hvac", label: "HVAC" },
  { id: "structural", label: "Structural" },
  { id: "fire-alarm", label: "Fire Alarm" },
  { id: "controls", label: "Controls" },
  { id: "etc", label: "ETC" },
];

const TRADE_CATEGORIES = {
  electrical: ["Receptacles", "Lighting", "Switches", "Panels / MCC", "Equipment", "Raceway", "Low Voltage"],
  hvac: ["HVAC"],
  "fire-alarm": ["Fire Alarm"],
  controls: ["Access Control", "Controls"],
  mechanical: ["Mechanical"],
  plumbing: ["Plumbing"],
  civil: ["Civil"],
  structural: ["Structural"],
  etc: ["ETC"],
};

function extra(tradeCategory, items) {
  return items.map(([id, label, abbr]) => ({ id, category: tradeCategory, label, abbr }));
}

export const TRADE_ONLY_SYMBOLS = [
  ...extra("Mechanical", [
    ["ahu-m", "Air handling unit", "AHU"],
    ["pump", "Pump", "PMP"],
    ["vav", "VAV box", "VAV"],
    ["boiler", "Boiler", "BLR"],
    ["chiller", "Chiller", "CHR"],
    ["fan-m", "Exhaust / supply fan", "EF"],
  ]),
  ...extra("Plumbing", [
    ["wc", "Water closet", "WC"],
    ["lav", "Lavatory", "LAV"],
    ["sink", "Sink", "SK"],
    ["fd", "Floor drain", "FD"],
    ["wh", "Water heater", "WH"],
    ["co", "Cleanout", "CO"],
    ["hb", "Hose bibb", "HB"],
  ]),
  ...extra("Civil", [
    ["mh", "Manhole", "MH"],
    ["cb", "Catch basin", "CB"],
    ["inlet", "Storm inlet", "INL"],
    ["curb", "Curb / gutter", "CURB"],
    ["pave", "Paving area", "PAV"],
  ]),
  ...extra("Structural", [
    ["col", "Column", "COL"],
    ["beam", "Beam", "BM"],
    ["ftg", "Footing", "FTG"],
    ["brace", "Brace", "BR"],
    ["grid", "Grid marker", "GL"],
  ]),
  ...extra("Controls", [
    ["ddc", "DDC controller", "DDC"],
    ["bms", "BMS point", "BMS"],
    ["stat-c", "Controls thermostat", "T"],
    ["vfd-c", "VFD control point", "VFD"],
  ]),
  ...extra("ETC", [
    ["gen-note", "General item", "GEN"],
    ["custom", "Custom symbol", "CST"],
  ]),
];

const SIZES = ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "2-1/2", "3", "4"];
const ELECTRICAL_MATERIALS = [
  ["emt", "EMT"],
  ["rigid", "Rigid"],
  ["pvc", "PVC"],
  ["imc", "IMC"],
];

function sizeId(material, size) {
  return `${material}-${size.replaceAll("/", "-").replaceAll('"', "")}`;
}

export const CONDUIT_OPTIONS = [
  ...ELECTRICAL_MATERIALS.flatMap(([id, label]) => SIZES.map((size) => ({
    id: sizeId(id, size),
    trade: "electrical",
    material: label,
    size: `${size}"`,
    label: `${size}" ${label}`,
  }))),
  ...["1/2", "3/4", "1", "1-1/2", "2", "3", "4"].map((size) => ({
    id: sizeId("plumb-pvc", size),
    trade: "plumbing",
    material: "PVC",
    size: `${size}"`,
    label: `${size}" PVC`,
  })),
  ...["6", "8", "10", "12", "14"].map((size) => ({
    id: `duct-${size}`,
    trade: "hvac",
    material: "Duct",
    size: `${size}"`,
    label: `${size}" duct`,
  })),
  ...["6", "8", "10", "12"].map((size) => ({
    id: `mech-duct-${size}`,
    trade: "mechanical",
    material: "Duct",
    size: `${size}"`,
    label: `${size}" duct`,
  })),
  { id: "fa-3-4", trade: "fire-alarm", material: "EMT", size: '3/4"', label: '3/4" EMT' },
  { id: "fa-1", trade: "fire-alarm", material: "EMT", size: '1"', label: '1" EMT' },
  { id: "ctrl-3-4", trade: "controls", material: "EMT", size: '3/4"', label: '3/4" EMT' },
  { id: "ctrl-1", trade: "controls", material: "EMT", size: '1"', label: '1" EMT' },
  { id: "civil-12", trade: "civil", material: "RCP", size: '12"', label: '12" RCP' },
  { id: "civil-18", trade: "civil", material: "RCP", size: '18"', label: '18" RCP' },
  { id: "struct-note", trade: "structural", material: "Mark", size: "—", label: "Structural mark" },
  { id: "etc-run", trade: "etc", material: "Run", size: "—", label: "Generic run" },
];

export const DEFAULT_CONDUIT_ID = "emt-3-4";
export const DEFAULT_MAX_HOMERUNS = 3;

export function tradeById(id) {
  return TRADES.find((trade) => trade.id === id) || TRADES.find((trade) => trade.id === "electrical");
}

export function categoriesForTrade(tradeId) {
  return TRADE_CATEGORIES[tradeId] || TRADE_CATEGORIES.etc;
}

export function conduitOptionsForTrade(tradeId) {
  const rows = CONDUIT_OPTIONS.filter((item) => item.trade === tradeId);
  return rows.length ? rows : CONDUIT_OPTIONS.filter((item) => item.trade === "etc");
}

export function findConduitOption(id, tradeId) {
  const rows = conduitOptionsForTrade(tradeId);
  return rows.find((item) => item.id === id) || rows[0];
}

export function paletteForTrade(tradeId, drawingSymbols = []) {
  const allowed = new Set(categoriesForTrade(tradeId));
  const symbols = [...DEVICE_SYMBOLS, ...TRADE_ONLY_SYMBOLS].filter((item) => allowed.has(item.category));
  const fromDrawing = (drawingSymbols || []).filter((item) => allowed.has(item.takeoffCategory || item.category));
  const categories = [];
  if (fromDrawing.length) categories.push(DRAWING_CATEGORY);
  for (const category of categoriesForTrade(tradeId)) {
    if (symbols.some((item) => item.category === category)) categories.push(category);
  }
  return { categories, symbols, fromDrawing };
}

export function symbolsForSelectedTrade(tradeId, drawingSymbols = [], options = {}) {
  const palette = paletteForTrade(tradeId, drawingSymbols);
  const category = options.category;
  if (category === DRAWING_CATEGORY) return palette.fromDrawing;
  if (category) return palette.symbols.filter((item) => item.category === category);
  const seen = new Set();
  return [...palette.fromDrawing, ...palette.symbols].filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function symbolPatchFromCatalog(item) {
  if (!item) return {};
  return {
    symbol: item.id,
    symbolLabel: item.label,
    abbr: item.abbr,
    category: item.takeoffCategory || item.category,
    typeCode: item.abbr,
  };
}

export const ANCHOR_SYMBOL_IDS = {
  electrical: ["panel", "lighting-panel", "power-panel", "receptacle-panel", "switchboard", "switchgear", "mcc", "main-sw", "transformer", "dry-tx", "pad-tx", "generator", "ats"],
  hvac: ["ahu", "cu"],
  "fire-alarm": ["facp"],
  controls: ["panel-ac", "ddc"],
  mechanical: ["ahu-m", "pump"],
  plumbing: ["wh"],
  civil: ["mh"],
  structural: ["grid"],
  etc: [],
};
