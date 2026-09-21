export const TOOL_GROUPS = [
  { key: "edit", label: "Edit" },
  { key: "setup", label: "Setup" },
  { key: "count", label: "Count" },
  { key: "measure", label: "Measure" },
  { key: "raceway", label: "Raceway / circuits" },
  { key: "review", label: "Review" },
];

export const TAKEOFF_TOOLS = [
  { key: "select", group: "edit", label: "Select", help: "Click a mark to select it. Drag to move. Delete removes it." },
  { key: "pan", group: "edit", label: "Pan", help: "Drag the sheet up, down, left, or right. Works at any zoom. Fit sheet recenters it." },
  { key: "scale", group: "setup", label: "Calibrate", help: "Click two points on a known dimension, then enter the real length in feet." },
  { key: "measure", group: "setup", label: "Measure", help: "Click two points for a temporary length. Calibrate first to read feet." },
  { key: "count", group: "count", label: "Count", help: "Click each device. Uses the selected symbol and category." },
  { key: "drop", group: "count", label: "Fixture drop", help: "Click a fixture for a count plus a typical drop length when scale is set." },
  { key: "linear", group: "measure", label: "Linear", help: "Click start and end of a straight run. Stores LF after scale calibration." },
  { key: "polyline", group: "measure", label: "Polyline", help: "Click a path. Double-click to finish. Stores total LF." },
  { key: "area", group: "measure", label: "Area", help: "Click a room or opening. Double-click to close. Stores SF after scale calibration." },
  { key: "conduit", group: "raceway", label: "Conduit", help: "Trace a conduit route. Length shows as you click. Double-click to finish the run." },
  { key: "circuit", group: "raceway", label: "Circuit", help: "Trace a circuit path. Double-click to finish." },
  { key: "homerun", group: "raceway", label: "Homerun", help: "Click device, then panel, for a homerun tick and circuit LF." },
  { key: "markup", group: "review", label: "Note", help: "Click to place a review note on the sheet." },
  { key: "cloud", group: "review", label: "Cloud", help: "Click two corners to cloud a revision or hold area." },
];

export const CATEGORIES = [
  "Receptacles",
  "Lighting",
  "Switches",
  "HVAC",
  "Panels / MCC",
  "Equipment",
  "Raceway",
  "Low Voltage",
  "Fire Alarm",
  "Access Control",
];

export const DRAWING_CATEGORY = "From drawing";

const RACEWAY_SIZES = ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "2-1/2", "3", "3-1/2", "4"];

function racewayFamily(kind, abbr) {
  return RACEWAY_SIZES.map((size) => ({
    id: `${kind}-${size.replaceAll("/", "-")}`,
    category: "Raceway",
    label: `${kind.toUpperCase()} ${size}"`,
    abbr: `${abbr}${size}`,
  }));
}

function devices(category, items) {
  return items.map(([id, label, abbr]) => ({ id, category, label, abbr }));
}

export const DEVICE_SYMBOLS = [
  ...devices("Receptacles", [
    ["duplex-15", "Duplex receptacle 15A 125V", "R15"],
    ["duplex-20", "Duplex receptacle 20A 125V", "R20"],
    ["duplex", "Duplex receptacle", "R"],
    ["gfci-15", "GFCI receptacle 15A", "GFI15"],
    ["gfci-20", "GFCI receptacle 20A", "GFI20"],
    ["gfci", "GFCI receptacle", "GFI"],
    ["wr-gfci", "Weather-resistant GFCI", "WRGFI"],
    ["wp", "Weatherproof in-use cover", "WP"],
    ["wp-gfci", "WP GFCI receptacle", "WPGFI"],
    ["floor-rec", "Floor receptacle", "FR"],
    ["poke-through", "Poke-through floor fitting", "PT"],
    ["quad", "Quad / two-gang receptacle", "Q"],
    ["usb", "USB duplex receptacle", "USB"],
    ["dedicated", "Dedicated receptacle", "DED"],
    ["ig", "Isolated-ground receptacle", "IG"],
    ["hospital", "Hospital-grade receptacle", "HG"],
    ["clock", "Clock-hanger receptacle", "CLK"],
    ["split", "Split-wired duplex", "SW"],
    ["half-switched", "Half-switched duplex", "HS"],
    ["208", "208V receptacle", "208"],
    ["240", "240V receptacle", "240"],
    ["250-30", "30A 250V receptacle", "30/250"],
    ["250-50", "50A 250V receptacle", "50/250"],
    ["range", "Range receptacle 50A", "RNG"],
    ["dryer", "Dryer receptacle 30A", "DRY"],
    ["l5-20", "Twist-lock L5-20", "L5-20"],
    ["l5-30", "Twist-lock L5-30", "L5-30"],
    ["l6-20", "Twist-lock L6-20", "L6-20"],
    ["l6-30", "Twist-lock L6-30", "L6-30"],
    ["l14-20", "Twist-lock L14-20", "L14-20"],
    ["l14-30", "Twist-lock L14-30", "L14-30"],
    ["l21-20", "Twist-lock L21-20", "L21-20"],
    ["l21-30", "Twist-lock L21-30", "L21-30"],
    ["60a", "60A receptacle", "60A"],
    ["special-rec", "Special-purpose receptacle", "SPR"],
  ]),
  ...devices("Lighting", [
    ["2x2", "2x2 recessed troffer / flat panel", "2x2"],
    ["2x4", "2x4 recessed troffer / flat panel", "2x4"],
    ["1x2", "1x2 recessed troffer", "1x2"],
    ["1x4", "1x4 recessed troffer / strip", "1x4"],
    ["1x8", "1x8 strip fixture", "1x8"],
    ["2x8", "2x8 troffer", "2x8"],
    ["panel-2x2", "LED flat panel 2x2", "FP22"],
    ["panel-2x4", "LED flat panel 2x4", "FP24"],
    ["panel-1x4", "LED flat panel 1x4", "FP14"],
    ["downlight", "Recessed downlight / can", "DL"],
    ["can-4", "4\" can light", "C4"],
    ["can-6", "6\" can light", "C6"],
    ["can-8", "8\" can light", "C8"],
    ["adj-down", "Adjustable / gimbal downlight", "ADJ"],
    ["wall-wash", "Wall washer", "WW"],
    ["pendant", "Pendant fixture", "PND"],
    ["linear-pend", "Linear pendant", "LP"],
    ["stem", "Stem-mounted fixture", "STM"],
    ["chain", "Chain-hung fixture", "CH"],
    ["high-bay", "High bay", "HB"],
    ["low-bay", "Low bay", "LB"],
    ["strip", "Industrial strip", "ST"],
    ["wrap", "Wraparound fixture", "WRP"],
    ["vapor", "Vapor-tight fixture", "VT"],
    ["wet-light", "Wet-location fixture", "WET"],
    ["xp-light", "Explosion-proof fixture", "XP"],
    ["pole", "Pole light", "PL"],
    ["site-pole", "Site / area pole", "SP"],
    ["flood", "Flood light", "FL"],
    ["wall-pack", "Wall pack", "WPK"],
    ["bollard", "Bollard", "BOL"],
    ["canopy", "Canopy / soffit fixture", "CAN"],
    ["parking", "Parking-garage fixture", "PG"],
    ["aisle", "Aisle / stack light", "ASL"],
    ["under-cab", "Under-cabinet light", "UC"],
    ["cove", "Cove light", "CV"],
    ["track", "Track head", "TR"],
    ["sconce", "Wall sconce", "SC"],
    ["step", "Step / night light", "NL"],
    ["in-grade", "In-grade fixture", "IGL"],
    ["landscape", "Landscape fixture", "LS"],
    ["exit", "Exit sign", "EX"],
    ["exit-em", "Combo exit / emergency", "EX/EM"],
    ["em-unit", "Emergency unit / bug-eye", "EM"],
    ["em-troffer", "Emergency battery troffer", "EMT"],
  ]),
  ...devices("Switches", [
    ["switch", "Single-pole switch", "S"],
    ["3way", "3-way switch", "S3"],
    ["4way", "4-way switch", "S4"],
    ["dimmer", "Dimmer switch", "SD"],
    ["010v", "0-10V dimmer", "0-10"],
    ["mlv-dim", "MLV / ELV dimmer", "ELV"],
    ["occ", "Occupancy sensor", "OS"],
    ["vac", "Vacancy sensor", "VS"],
    ["dual-tech", "Dual-tech sensor", "DT"],
    ["key-sw", "Key switch", "KS"],
    ["timer", "Timer switch", "TS"],
    ["pilot", "Pilot-light switch", "SP"],
    ["lv-sw", "Low-voltage switch", "LVS"],
    ["scene", "Scene controller", "SC"],
    ["photocell", "Photocell", "PC"],
    ["timeclock", "Time clock", "TC"],
    ["contactor", "Lighting contactor", "LC"],
    ["panel-occ", "Ceiling occupancy sensor", "COS"],
    ["wall-occ", "Wall occupancy sensor", "WOS"],
    ["daylight", "Daylight sensor", "DS"],
  ]),
  ...devices("HVAC", [
    ["disconnect", "Disconnect", "DS"],
    ["fusible-ds", "Fusible disconnect", "FDS"],
    ["nema3r-ds", "NEMA 3R disconnect", "3RDS"],
    ["stat", "Thermostat", "T"],
    ["humidistat", "Humidistat", "H"],
    ["vfd", "VFD", "VFD"],
    ["starter", "Motor starter", "MS"],
    ["combo-starter", "Combination starter", "CS"],
    ["hvac-rec", "HVAC receptacle", "HVACR"],
    ["cu", "Condensing unit connection", "CU"],
    ["ahu", "AHU connection", "AHU"],
    ["uh", "Unit heater connection", "UH"],
    ["fc", "Fan-coil connection", "FC"],
  ]),
  ...devices("Panels / MCC", [
    ["panel", "Panelboard", "P"],
    ["lighting-panel", "Lighting panel", "LP"],
    ["power-panel", "Power panel", "PP"],
    ["receptacle-panel", "Receptacle panel", "RP"],
    ["switchboard", "Switchboard", "SWBD"],
    ["switchgear", "Switchgear", "SWGR"],
    ["mcc", "MCC", "MCC"],
    ["transformer", "Transformer", "TX"],
    ["dry-tx", "Dry-type transformer", "DTX"],
    ["pad-tx", "Pad-mount transformer", "PTX"],
    ["ats", "Automatic transfer switch", "ATS"],
    ["mts", "Manual transfer switch", "MTS"],
    ["generator", "Generator", "G"],
    ["ups", "UPS", "UPS"],
    ["meter", "Meter / CT cabinet", "MTR"],
    ["main-sw", "Main service disconnect", "MSD"],
    ["splitter", "Splitter trough", "SPL"],
  ]),
  ...devices("Equipment", [
    ["motor", "Motor", "M"],
    ["vf", "Vent fan", "VF"],
    ["ef", "Exhaust fan", "EF"],
    ["equip", "Equipment connection", "EQ"],
    ["jbox", "Junction box", "JB"],
    ["pull-box", "Pull box", "PB"],
    ["control-st", "Control station", "CS"],
    ["pushbutton", "Pushbutton station", "PBS"],
    ["safety-sw", "Safety switch", "SS"],
    ["heater", "Electric heater", "EH"],
    ["water-heater", "Water heater connection", "WH"],
    ["elevator", "Elevator equipment", "ELV"],
    ["dock", "Dock leveler / door", "DK"],
    ["overhead", "Overhead door operator", "OHD"],
    ["sign", "Sign connection", "SGN"],
    ["kitchen", "Kitchen equipment", "KIT"],
    ["medical", "Medical equipment", "MED"],
    ["ground-rod", "Ground rod / grounding electrode", "GRD"],
  ]),
  ...racewayFamily("emt", "EMT"),
  ...racewayFamily("imc", "IMC"),
  ...racewayFamily("rmc", "RMC"),
  ...racewayFamily("pvc40", "PVC40"),
  ...racewayFamily("pvc80", "PVC80"),
  ...devices("Raceway", [
    ["emt", "EMT / conduit (unspecified)", "C"],
    ["fmc", "FMC / flex", "FMC"],
    ["lfmc", "LFMC / liquidtight", "LT"],
    ["ent", "ENT", "ENT"],
    ["tray", "Cable tray", "CT"],
    ["wireway", "Wireway", "WW"],
    ["mc", "MC cable", "MC"],
    ["ac", "AC / BX cable", "AC"],
    ["nm", "NM cable", "NM"],
    ["duct", "Underground duct bank", "DB"],
    ["innerduct", "Innerduct / fiber duct", "ID"],
  ]),
  ...devices("Low Voltage", [
    ["data", "Data outlet", "D"],
    ["voice", "Voice outlet", "V"],
    ["combo-dv", "Data/voice combo", "DV"],
    ["wifi", "WAP / wireless AP", "WAP"],
    ["camera-lv", "CCTV camera", "CAM"],
    ["speaker", "Speaker", "SPK"],
    ["clock-lv", "Clock", "CLK"],
    ["av", "AV outlet", "AV"],
    ["das", "DAS / ERRCS antenna", "DAS"],
    ["nurse", "Nurse call", "NC"],
    ["intercom", "Intercom", "IC"],
  ]),
  ...devices("Fire Alarm", [
    ["fa", "Fire alarm device", "FA"],
    ["smoke", "Smoke detector", "SD"],
    ["heat", "Heat detector", "HD"],
    ["duct-smoke", "Duct smoke detector", "DSD"],
    ["pull", "Manual pull station", "MPS"],
    ["horn", "Horn / strobe", "HS"],
    ["strobe", "Strobe", "STR"],
    ["speaker-fa", "FA speaker", "FAS"],
    ["module", "Monitor / control module", "MOD"],
    ["facp", "Fire alarm control panel", "FACP"],
    ["annunciator", "Annunciator", "ANN"],
    ["flow", "Flow switch", "FS"],
    ["tamper", "Tamper switch", "TS"],
    ["beam", "Projected beam detector", "PBD"],
  ]),
  ...devices("Access Control", [
    ["reader", "Card reader", "CR"],
    ["rex", "Request-to-exit", "REX"],
    ["door-contact", "Door contact", "DC"],
    ["maglock", "Maglock / electric strike", "EL"],
    ["camera-ac", "Security camera", "CAM"],
    ["keypad", "Keypad", "KP"],
    ["intercom-ac", "Entry intercom", "EN"],
    ["gate", "Gate operator", "GT"],
    ["panel-ac", "Access control panel", "ACP"],
  ]),
];

export const DEFAULT_DROP_FEET = 10;

export function symbolsForCategory(category, extra = []) {
  const all = [...extra, ...DEVICE_SYMBOLS];
  if (!category) return all;
  return all.filter((item) => item.category === category);
}

export function findSymbol(symbolId, extra = []) {
  return [...extra, ...DEVICE_SYMBOLS].find((item) => item.id === symbolId) || extra[0] || DEVICE_SYMBOLS[0];
}

export function toolByKey(key) {
  return TAKEOFF_TOOLS.find((item) => item.key === key) || TAKEOFF_TOOLS[0];
}

export function filterSymbols(list, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter((item) => (
    item.label.toLowerCase().includes(q)
    || item.abbr.toLowerCase().includes(q)
    || item.id.toLowerCase().includes(q)
    || item.category.toLowerCase().includes(q)
  ));
}
