import { matchAuditedLaborHours } from "./auditedLibrary.js";

/**
 * Bundled electrical labor library used when the master library has no match.
 * Devices are man-hours each. Raceway is man-hours per 100 LF. Normal conditions.
 * These are Estim8r baseline hours, not a verified production rate.
 */
export const LABOR_LIBRARY_DOCUMENT = {
  name: "Estim8r electrical labor library",
  edition: "2026 baseline",
  condition: "normal",
  items: [
    { id: "rec-duplex", category: "Receptacles", keywords: ["duplex", "receptacle"], exclude: ["gfci", "floor", "quad"], unit: "EA", per: 1, mh: 0.55 },
    { id: "rec-gfci", category: "Receptacles", keywords: ["gfci", "gfi"], unit: "EA", per: 1, mh: 0.7 },
    { id: "rec-floor", category: "Receptacles", keywords: ["floor", "poke-through", "poke through"], unit: "EA", per: 1, mh: 1.25 },
    { id: "rec-quad", category: "Receptacles", keywords: ["quad"], unit: "EA", per: 1, mh: 0.75 },
    { id: "rec-spec", category: "Receptacles", keywords: ["range", "dryer", "twist", "l5-", "l6-", "l14-", "l21-", "250v", "208v"], unit: "EA", per: 1, mh: 0.9 },
    { id: "ltg-troffer", category: "Lighting", keywords: ["2x4", "2x2", "1x4", "troffer", "flat panel"], unit: "EA", per: 1, mh: 1.1 },
    { id: "ltg-down", category: "Lighting", keywords: ["downlight", "can light", "can "], unit: "EA", per: 1, mh: 0.75 },
    { id: "ltg-highbay", category: "Lighting", keywords: ["high bay", "low bay"], unit: "EA", per: 1, mh: 1.6 },
    { id: "ltg-exit", category: "Lighting", keywords: ["exit", "emergency"], unit: "EA", per: 1, mh: 0.65 },
    { id: "ltg-pole", category: "Lighting", keywords: ["pole", "flood", "wall pack", "bollard"], unit: "EA", per: 1, mh: 2.2 },
    { id: "sw-sp", category: "Switches", keywords: ["switch", "dimmer", "3-way", "4-way"], exclude: ["occupancy", "sensor"], unit: "EA", per: 1, mh: 0.4 },
    { id: "sw-occ", category: "Switches", keywords: ["occupancy", "vacancy", "sensor", "photocell"], unit: "EA", per: 1, mh: 0.55 },
    { id: "hvac-disc", category: "HVAC", keywords: ["disconnect"], unit: "EA", per: 1, mh: 1.4 },
    { id: "hvac-conn", category: "HVAC", keywords: ["vfd", "starter", "condensing", "ahu", "exhaust", "heater", "fan-coil"], unit: "EA", per: 1, mh: 3.5 },
    { id: "gear-panel", category: "Panels / MCC", keywords: ["panel"], exclude: ["switchboard", "switchgear"], unit: "EA", per: 1, mh: 14 },
    { id: "gear-swbd", category: "Panels / MCC", keywords: ["switchboard", "switchgear", "mcc"], unit: "EA", per: 1, mh: 24 },
    { id: "gear-tx", category: "Panels / MCC", keywords: ["transformer"], unit: "EA", per: 1, mh: 8 },
    { id: "gear-ats", category: "Panels / MCC", keywords: ["transfer", "generator", "ups"], unit: "EA", per: 1, mh: 10 },
    { id: "eq-jb", category: "Equipment", keywords: ["junction", "pull box", "j-box"], unit: "EA", per: 1, mh: 0.8 },
    { id: "eq-motor", category: "Equipment", keywords: ["motor", "equipment connection"], unit: "EA", per: 1, mh: 2.5 },
    { id: "lv-out", category: "Low Voltage", keywords: ["data", "voice", "wap", "camera", "speaker"], unit: "EA", per: 1, mh: 0.45 },
    { id: "fa-dev", category: "Fire Alarm", keywords: ["smoke", "heat", "horn", "strobe", "pull", "fire alarm"], unit: "EA", per: 1, mh: 0.6 },
    { id: "ac-dev", category: "Access Control", keywords: ["card reader", "door contact", "rex", "lock"], unit: "EA", per: 1, mh: 0.85 },
    { id: "emt-half", category: "Raceway", keywords: ["emt"], size: "1/2", unit: "100 LF", per: 100, mh: 6.5 },
    { id: "emt-34", category: "Raceway", keywords: ["emt"], size: "3/4", unit: "100 LF", per: 100, mh: 7.2 },
    { id: "emt-1", category: "Raceway", keywords: ["emt"], size: '1"', unit: "100 LF", per: 100, mh: 8.4 },
    { id: "emt-114", category: "Raceway", keywords: ["emt"], size: "1-1/4", unit: "100 LF", per: 100, mh: 9.6 },
    { id: "emt-2", category: "Raceway", keywords: ["emt"], size: '2"', unit: "100 LF", per: 100, mh: 12 },
    { id: "rmc", category: "Raceway", keywords: ["rmc", "imc", "rigid"], unit: "100 LF", per: 100, mh: 14 },
    { id: "pvc", category: "Raceway", keywords: ["pvc"], unit: "100 LF", per: 100, mh: 7.5 },
    { id: "flex", category: "Raceway", keywords: ["fmc", "lfmc", "flex", "liquidtight"], unit: "100 LF", per: 100, mh: 9 },
    { id: "mc", category: "Raceway", keywords: ["mc cable", "mc "], unit: "100 LF", per: 100, mh: 5.5 },
    { id: "conduit-gen", category: "Raceway", keywords: ["conduit", "circuit", "homerun"], unit: "100 LF", per: 100, mh: 8 },
    { id: "wire-14", category: "Wire / Cable", keywords: ["#14", "14 awg", "14 cu"], unit: "1000 LF", per: 1000, mh: 9 },
    { id: "wire-12", category: "Wire / Cable", keywords: ["#12", "12 awg", "12 cu"], unit: "1000 LF", per: 1000, mh: 10 },
    { id: "wire-10", category: "Wire / Cable", keywords: ["#10", "10 awg", "10 cu"], unit: "1000 LF", per: 1000, mh: 11 },
    { id: "wire-8", category: "Wire / Cable", keywords: ["#8", "8 awg", "8 cu"], unit: "1000 LF", per: 1000, mh: 13 },
    { id: "wire-6", category: "Wire / Cable", keywords: ["#6", "6 awg", "6 cu"], unit: "1000 LF", per: 1000, mh: 15 },
    { id: "wire-4", category: "Wire / Cable", keywords: ["#4", "4 awg", "4 cu"], unit: "1000 LF", per: 1000, mh: 18 },
    { id: "wire-3", category: "Wire / Cable", keywords: ["#3", "3 awg", "3 cu"], unit: "1000 LF", per: 1000, mh: 20 },
    { id: "wire-2", category: "Wire / Cable", keywords: ["#2", "2 awg", "2 cu"], unit: "1000 LF", per: 1000, mh: 21 },
    { id: "wire-1", category: "Wire / Cable", keywords: ["#1", "1 awg", "1 cu"], unit: "1000 LF", per: 1000, mh: 23 },
    { id: "wire-10x", category: "Wire / Cable", keywords: ["1/0"], unit: "1000 LF", per: 1000, mh: 27 },
    { id: "wire-20x", category: "Wire / Cable", keywords: ["2/0"], unit: "1000 LF", per: 1000, mh: 30 },
    { id: "wire-30x", category: "Wire / Cable", keywords: ["3/0"], unit: "1000 LF", per: 1000, mh: 34 },
    { id: "wire-40x", category: "Wire / Cable", keywords: ["4/0"], unit: "1000 LF", per: 1000, mh: 38 },
  ],
  fallbacks: {
    Receptacles: { id: "fb-rec", unit: "EA", per: 1, mh: 0.55 },
    Lighting: { id: "fb-ltg", unit: "EA", per: 1, mh: 0.9 },
    Switches: { id: "fb-sw", unit: "EA", per: 1, mh: 0.4 },
    HVAC: { id: "fb-hvac", unit: "EA", per: 1, mh: 2 },
    "Panels / MCC": { id: "fb-gear", unit: "EA", per: 1, mh: 12 },
    Equipment: { id: "fb-eq", unit: "EA", per: 1, mh: 2 },
    Raceway: { id: "fb-race", unit: "100 LF", per: 100, mh: 8 },
    "Wire / Cable": { id: "fb-wire", unit: "1000 LF", per: 1000, mh: 12 },
    "Low Voltage": { id: "fb-lv", unit: "EA", per: 1, mh: 0.45 },
    "Fire Alarm": { id: "fb-fa", unit: "EA", per: 1, mh: 0.6 },
    "Access Control": { id: "fb-ac", unit: "EA", per: 1, mh: 0.75 },
  },
};

function textOf(category, symbol) {
  return `${category || ""} ${symbol || ""}`.toLowerCase();
}

function scoreItem(item, text, category) {
  if (item.category && category && item.category !== category && category !== "From drawing" && category !== "Uncategorized") {
    return 0;
  }
  if ((item.exclude || []).some((word) => text.includes(word))) return 0;
  let score = 0;
  for (const word of item.keywords) {
    if (text.includes(word.toLowerCase())) score += word.length + 2;
  }
  if (!score) return 0;
  if (item.size && !text.includes(String(item.size).toLowerCase())) return 0;
  if (item.size) score += 8;
  if (item.category && item.category === category) score += 1;
  return score;
}

export function assignLaborHours({ category, symbol, unit, items, minScore = 0, allowCategoryFallback = true } = {}) {
  const audited = matchAuditedLaborHours({ category, symbol, unit, items, minScore });
  if (audited) return audited;

  const text = textOf(category, symbol);
  let best = null;
  let bestScore = 0;
  for (const item of LABOR_LIBRARY_DOCUMENT.items) {
    const score = scoreItem(item, text, category);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  const fallback = LABOR_LIBRARY_DOCUMENT.fallbacks[category];
  const lengthFallback = unit === "LF" || unit === "FT" || unit === "100 LF";
  const chosen = best || (allowCategoryFallback && lengthFallback ? LABOR_LIBRARY_DOCUMENT.fallbacks.Raceway : allowCategoryFallback ? fallback : null);
  if (!chosen) {
    return {
      laborItemId: "",
      mhPerUnit: 0,
      sourceType: "custom",
      sourceName: LABOR_LIBRARY_DOCUMENT.name,
      verificationStatus: "unverified",
      productionAllowed: false,
      note: "No labor-library match. Enter man-hours.",
    };
  }
  const displayUnit = unit === "FT" ? "LF" : (unit || (chosen.unit === "100 LF" ? "LF" : "EA"));
  const mhPerUnit = displayUnit === "LF" && chosen.unit === "100 LF"
    ? chosen.mh / 100
    : displayUnit === "LF" && chosen.unit === "1000 LF"
      ? chosen.mh / 1000
      : chosen.mh;
  const basis = chosen.unit === "100 LF"
    ? `${chosen.mh} MH / 100 LF`
    : chosen.unit === "1000 LF"
      ? `${chosen.mh} MH / 1000 LF`
      : `${chosen.mh} MH each`;
  return {
    laborItemId: chosen.id,
    mhPerUnit: Math.round(mhPerUnit * 10000) / 10000,
    sourceType: "experimental",
    sourceName: `${LABOR_LIBRARY_DOCUMENT.name} (${LABOR_LIBRARY_DOCUMENT.edition})`,
    verificationStatus: "unverified",
    productionAllowed: false,
    note: `${basis}, normal. Experimental baseline — not a verified production rate.`,
  };
}
