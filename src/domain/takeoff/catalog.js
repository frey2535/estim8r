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
  { key: "pan", group: "edit", label: "Pan", help: "Drag the sheet to move around after zooming in." },
  { key: "scale", group: "setup", label: "Calibrate", help: "Click two points on a known dimension, then enter the real length in feet." },
  { key: "measure", group: "setup", label: "Measure", help: "Click two points for a temporary length. Calibrate first to read feet." },
  { key: "count", group: "count", label: "Count", help: "Click each device. Uses the selected symbol and category." },
  { key: "drop", group: "count", label: "Fixture drop", help: "Click a fixture for a count plus a typical drop length when scale is set." },
  { key: "linear", group: "measure", label: "Linear", help: "Click start and end of a straight run. Stores LF after scale calibration." },
  { key: "polyline", group: "measure", label: "Polyline", help: "Click a path. Double-click to finish. Stores total LF." },
  { key: "area", group: "measure", label: "Area", help: "Click a room or opening. Double-click to close. Stores SF after scale calibration." },
  { key: "conduit", group: "raceway", label: "Conduit", help: "Trace a conduit route. Double-click to finish. Stores LF by raceway type." },
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

export const DEVICE_SYMBOLS = [
  { id: "duplex", category: "Receptacles", label: "Duplex receptacle", abbr: "R" },
  { id: "gfci", category: "Receptacles", label: "GFCI receptacle", abbr: "GFI" },
  { id: "wp", category: "Receptacles", label: "Weatherproof receptacle", abbr: "WP" },
  { id: "floor-rec", category: "Receptacles", label: "Floor receptacle", abbr: "FR" },
  { id: "quad", category: "Receptacles", label: "Quad receptacle", abbr: "Q" },
  { id: "2x4", category: "Lighting", label: "2x4 troffer", abbr: "2x4" },
  { id: "downlight", category: "Lighting", label: "Downlight", abbr: "DL" },
  { id: "exit", category: "Lighting", label: "Exit / emergency", abbr: "EX" },
  { id: "site-light", category: "Lighting", label: "Site / wall pack", abbr: "WP" },
  { id: "switch", category: "Switches", label: "Single-pole switch", abbr: "S" },
  { id: "3way", category: "Switches", label: "3-way switch", abbr: "S3" },
  { id: "dimmer", category: "Switches", label: "Dimmer", abbr: "SD" },
  { id: "occ", category: "Switches", label: "Occupancy sensor", abbr: "OS" },
  { id: "disconnect", category: "HVAC", label: "Disconnect", abbr: "DS" },
  { id: "stat", category: "HVAC", label: "Thermostat", abbr: "T" },
  { id: "panel", category: "Panels / MCC", label: "Panelboard", abbr: "P" },
  { id: "transformer", category: "Panels / MCC", label: "Transformer", abbr: "TX" },
  { id: "mcc", category: "Panels / MCC", label: "MCC / switchboard", abbr: "MCC" },
  { id: "motor", category: "Equipment", label: "Motor", abbr: "M" },
  { id: "equip", category: "Equipment", label: "Equipment connection", abbr: "EQ" },
  { id: "emt", category: "Raceway", label: "EMT / conduit", abbr: "C" },
  { id: "tray", category: "Raceway", label: "Cable tray", abbr: "CT" },
  { id: "data", category: "Low Voltage", label: "Data outlet", abbr: "D" },
  { id: "fa", category: "Fire Alarm", label: "Fire alarm device", abbr: "FA" },
  { id: "reader", category: "Access Control", label: "Card reader / camera", abbr: "AC" },
];

export const DEFAULT_DROP_FEET = 10;

export function symbolsForCategory(category) {
  return DEVICE_SYMBOLS.filter((item) => item.category === category);
}

export function toolByKey(key) {
  return TAKEOFF_TOOLS.find((item) => item.key === key) || TAKEOFF_TOOLS[0];
}
