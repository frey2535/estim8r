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

const CATEGORY_TO_TRADE = {
  Receptacles: "electrical",
  Lighting: "electrical",
  Switches: "electrical",
  "Panels / MCC": "electrical",
  Equipment: "electrical",
  Raceway: "electrical",
  "Low Voltage": "electrical",
  HVAC: "hvac",
  "Fire Alarm": "fire-alarm",
  "Access Control": "controls",
  Mechanical: "mechanical",
  Plumbing: "plumbing",
  Civil: "civil",
  Structural: "structural",
  Controls: "controls",
  ETC: "etc",
};

export function tradeIdForCategory(category) {
  return CATEGORY_TO_TRADE[category] || "";
}

export function tradeIdFromLabel(label) {
  const text = String(label || "").toLowerCase();
  if (!text.trim()) return "";
  if (/water closet|\burinal\b|lavatory|\bsink\b|floor drain|cleanout|hose bibb|\bplumbing\b/.test(text)) return "plumbing";
  if (/\bmanhole\b|catch basin|storm inlet|\bcurb\b|paving|\bcivil\b/.test(text)) return "civil";
  if (/\bcolumn\b|\bfooting\b|\bbrace\b|grid line|structural/.test(text)) return "structural";
  if (/\bvav\b|\bboiler\b|\bchiller\b|\bpump\b|air handling|\bmechanical\b/.test(text)) return "mechanical";
  if (/fire alarm|smoke detector|heat detector|strobe|\bhorn\b|pull station|\bfacp\b/.test(text)) return "fire-alarm";
  if (/card reader|maglock|rex\b|access control/.test(text)) return "controls";
  if (/\bhvac\b|condensing unit|fan-coil|unit heater/.test(text)) return "hvac";
  if (/recept|outlet|gfci|duplex|troffer|luminaire|fixture|switchgear|panelboard|conduit|emt\b/.test(text)) return "electrical";
  return "";
}

function isDrawingSymbol(item) {
  const category = item?.category || item?.drawingCategory;
  return category === DRAWING_CATEGORY
    || item?.source === "legend"
    || item?.source === "lighting-schedule"
    || item?.source === "device-schedule"
    || item?.source === "equipment-schedule"
    || String(item?.id || "").startsWith("legend:")
    || String(item?.id || "").startsWith("sched:");
}

export function tradeIdForSymbol(item) {
  if (!item) return "";
  if (item.trade && TRADES.some((row) => row.id === item.trade)) return item.trade;
  if (isDrawingSymbol(item)) {
    return tradeIdFromLabel(item.label || item.symbolLabel)
      || tradeIdForCategory(item.takeoffCategory)
      || "";
  }
  return tradeIdForCategory(item.takeoffCategory) || tradeIdForCategory(item.category) || "";
}

function stampTrade(item) {
  const trade = tradeIdForSymbol(item);
  return trade ? { ...item, trade } : null;
}

export function paletteForTrade(tradeId, drawingSymbols = []) {
  const selected = tradeById(tradeId).id;
  const symbols = [...DEVICE_SYMBOLS, ...TRADE_ONLY_SYMBOLS]
    .map(stampTrade)
    .filter((item) => item?.trade === selected);
  const fromDrawing = (drawingSymbols || [])
    .map(stampTrade)
    .filter((item) => item?.trade === selected);
  const categories = [];
  if (fromDrawing.length) categories.push(DRAWING_CATEGORY);
  for (const category of categoriesForTrade(selected)) {
    if (symbols.some((item) => item.category === category)) categories.push(category);
  }
  return { categories, symbols, fromDrawing };
}

export function symbolsForSelectedTrade(tradeId, drawingSymbols = [], options = {}) {
  const selected = tradeById(tradeId).id;
  const palette = paletteForTrade(selected, drawingSymbols);
  const category = options.category;
  const belongs = (item) => item?.id && item.trade === selected;
  let list = [];
  if (category === DRAWING_CATEGORY) list = palette.fromDrawing;
  else if (category && tradeIdForCategory(category) === selected) {
    list = palette.symbols.filter((item) => item.category === category);
  } else {
    const seen = new Set();
    list = [...palette.fromDrawing, ...palette.symbols].filter((item) => {
      if (!belongs(item) || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }
  return list.filter(belongs);
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

const LEGEND_SHEET_KINDS = new Set([
  "legend",
  "lighting-schedule",
  "device-schedule",
  "equipment-schedule",
  "spec",
]);

export function pageKindsFromDocs(docs) {
  const map = {};
  for (const page of docs?.pages || []) {
    if (page?.page) map[page.page] = page.kind;
  }
  return map;
}

export function isLegendSheetKind(kind) {
  return LEGEND_SHEET_KINDS.has(kind);
}

function isPlanDeviceMark(mark, pageKinds = {}) {
  if (mark?.type !== "count" && mark?.type !== "drop") return false;
  if (mark?.source === "legend") return false;
  const kind = pageKinds[mark?.sheet];
  if (kind && isLegendSheetKind(kind)) return false;
  return true;
}

export function symbolFromDrawingMark(mark) {
  const id = mark?.symbol || mark?.typeCode || mark?.abbr;
  if (!id) return null;
  const stamped = stampTrade({
    ...mark,
    label: mark.symbolLabel || mark.symbol || mark.typeCode || mark.abbr,
    category: mark.category,
    takeoffCategory: mark.takeoffCategory || mark.category,
  });
  if (!stamped) return null;
  return {
    id,
    label: mark.symbolLabel || mark.symbol || mark.typeCode || mark.abbr,
    abbr: mark.abbr || mark.typeCode || "",
    category: mark.category || stamped.category || "",
    trade: stamped.trade,
    typeCode: mark.typeCode || mark.abbr,
  };
}

export function symbolsOnDrawingForTrade(tradeId, marks = [], options = {}) {
  const selected = tradeById(tradeId).id;
  const pageKinds = options.pageKinds || {};
  const category = options.category;
  const seen = new Set();
  const list = [];
  for (const mark of marks) {
    if (!isPlanDeviceMark(mark, pageKinds)) continue;
    const item = symbolFromDrawingMark(mark);
    if (!item || item.trade !== selected) continue;
    if (category && item.category && item.category !== category) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    list.push(item);
  }
  return list;
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
