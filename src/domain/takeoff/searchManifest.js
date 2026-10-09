import { pagePlanType } from "./drawing-docs.js";

const ELECTRICAL_PLAN_CATEGORIES = {
  lighting: new Set(["Lighting", "Switches"]),
  power: new Set(["Receptacles", "Switches", "Panels / MCC", "Equipment", "Low Voltage"]),
};

function clean(value) {
  return String(value || "").trim();
}

function compact(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function entryCategory(entry) {
  return clean(entry?.symbol?.takeoffCategory || entry?.symbol?.category);
}

function labelBlob(entry) {
  return [entry?.code, entry?.symbol?.abbr, entry?.symbol?.label, entryCategory(entry)]
    .filter(Boolean)
    .join(" ");
}

function isLightingEntry(entry) {
  const category = entryCategory(entry);
  if (ELECTRICAL_PLAN_CATEGORIES.lighting.has(category)) return true;
  if (category && category !== "From drawing") return false;
  return /light|fixture|luminaire|troffer|downlight|sconce|exit|emergency|occupancy|vacancy|dimmer|photocell|switch/i.test(labelBlob(entry));
}

function isPowerEntry(entry) {
  const category = entryCategory(entry);
  if (ELECTRICAL_PLAN_CATEGORIES.power.has(category)) return true;
  if (category && category !== "From drawing") return false;
  return /recept|outlet|gfi|gfci|usb|floor box|junction|j-?box|disconnect|panel|switchboard|switchgear|mcc|transformer|generator|\bats\b|motor|equipment|power|doorbell|special/i.test(labelBlob(entry));
}

export function legendEntryAppliesToPlan(entry, trade, planType) {
  if (!entry) return false;
  if (trade !== "electrical") return true;
  if (planType === "lighting") return isLightingEntry(entry);
  if (planType === "power") return isPowerEntry(entry);
  return entryCategory(entry) !== "Raceway";
}

function markMatchesEntry(mark, entry) {
  if (!mark || !entry) return false;
  const code = compact(entry.code || entry.symbol?.abbr);
  const symbolId = clean(entry.symbol?.id);
  const label = compact(entry.symbol?.label);
  if (symbolId && clean(mark.symbol) === symbolId) return true;
  if (code && [mark.typeCode, mark.abbr].some((value) => compact(value) === code)) return true;
  if (label && compact(mark.symbolLabel) === label) return true;
  return false;
}

function sourcePage(entry) {
  return Number(entry?.symbol?.page || entry?.page) || null;
}

function prototypeCount(entry) {
  if (Array.isArray(entry?.prototypes) && entry.prototypes.length) return entry.prototypes.length;
  return entry?.prototype ? 1 : 0;
}

function rowForEntry(entry, page, marks, trade) {
  const pageMarks = (marks || []).filter((mark) => mark?.sheet === page.page && mark?.trade === trade);
  const matched = pageMarks.filter((mark) => markMatchesEntry(mark, entry));
  const count = matched.filter((mark) => mark.type === "count" || mark.type === "drop").length;
  const reviewCount = matched.filter((mark) => mark.reviewStatus === "pending" || mark.layer === "review").length;
  const prototypes = prototypeCount(entry);
  return {
    id: `${page.page}:${entry.code || entry.symbol?.id || entry.symbol?.label}`,
    code: clean(entry.code || entry.symbol?.abbr),
    label: clean(entry.symbol?.label) || clean(entry.code) || "Legend symbol",
    description: clean(entry.symbol?.description || entry.symbol?.legendDescription || entry.symbol?.label),
    remarks: clean(entry.symbol?.remarks || entry.symbol?.legendRemarks),
    symbolId: clean(entry.symbol?.id),
    instances: matched.filter((mark) => mark.type === "count" || mark.type === "drop").map((mark) => ({ id: mark.id || null, equipmentId: clean(mark.equipmentId), circuit: clean(mark.circuit || mark.circuitNumber), sheet: mark.sheet })),
    category: entryCategory(entry) || "From drawing",
    sourcePage: sourcePage(entry),
    sheet: page.page,
    sheetId: clean(page.sheetId),
    planType: pagePlanType(page) || clean(page.planType) || "plan",
    prototypeCount: prototypes,
    vectorPrototypeReady: prototypes > 0,
    foundCount: count,
    reviewCount,
    searched: true,
    status: count > 0 ? (reviewCount ? "review" : "found") : prototypes > 0 ? "not-found" : "text-only",
  };
}

export function buildTradeSearchManifest({ pages = [], trade, dictionary, marks = [], shouldScanPage } = {}) {
  const scanPages = (pages || []).filter((page) => (
    typeof shouldScanPage === "function" ? shouldScanPage(page, trade) : true
  ));
  const entries = (dictionary?.entries || []).filter((entry) => entry?.symbol || entry?.code);
  const sheets = scanPages.map((page) => {
    const planType = pagePlanType(page) || clean(page.planType) || "plan";
    const rows = entries
      .filter((entry) => legendEntryAppliesToPlan(entry, trade, planType))
      .map((entry) => rowForEntry(entry, page, marks, trade))
      .sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code) || a.label.localeCompare(b.label));
    return {
      page: page.page,
      sheetId: clean(page.sheetId),
      title: clean(page.title),
      planType,
      searched: true,
      symbols: rows,
      foundTypes: rows.filter((row) => row.foundCount > 0).length,
      notFoundTypes: rows.filter((row) => row.status === "not-found").length,
      textOnlyTypes: rows.filter((row) => row.status === "text-only").length,
      reviewTypes: rows.filter((row) => row.status === "review").length,
    };
  });
  const totalSymbols = sheets.reduce((sum, sheet) => sum + sheet.symbols.length, 0);
  return {
    trade,
    generatedAt: new Date().toISOString(),
    legendEntryCount: entries.length,
    sheetCount: sheets.length,
    totalSymbols,
    foundTypes: sheets.reduce((sum, sheet) => sum + sheet.foundTypes, 0),
    notFoundTypes: sheets.reduce((sum, sheet) => sum + sheet.notFoundTypes, 0),
    textOnlyTypes: sheets.reduce((sum, sheet) => sum + sheet.textOnlyTypes, 0),
    reviewTypes: sheets.reduce((sum, sheet) => sum + sheet.reviewTypes, 0),
    sheets,
  };
}
