import { EMPLOYEE_CLASSES, SHOP_HOURLY_RATE } from "./employeeClasses.js";

export const LABOR_RATES_KEY = "estim8r.labor-rates.v1";

/** Previous in-app starting wages. Treat an untouched copy of this table as unset. */
export const LEGACY_DEFAULT_WAGES = {
  superintendent: 110,
  "general-foreman": 95,
  foreman: 85,
  supervisor: 78,
  journeyman: 68,
  "apprentice-1": 61,
  "apprentice-2": 54,
  "apprentice-3": 48,
  "apprentice-4": 41,
  "apprentice-5": 34,
  helper: 28,
};

function rateMap(input) {
  if (!input) return new Map();
  if (Array.isArray(input)) {
    return new Map((input || []).map((row) => [
      row.classId || row.class_id,
      Number(row.hourlyRate ?? row.hourly_rate ?? row.wage),
    ]));
  }
  return new Map(Object.entries(input).map(([id, wage]) => [id, Number(wage)]));
}

export function looksLikeLegacyDefaultRates(input) {
  const byId = rateMap(input);
  const ids = Object.keys(LEGACY_DEFAULT_WAGES);
  const present = ids.filter((id) => byId.has(id) && Number.isFinite(byId.get(id)));
  if (!present.length) return false;
  return present.every((id) => Math.abs(byId.get(id) - LEGACY_DEFAULT_WAGES[id]) < 0.005);
}

export function defaultLaborRates(wageBook = {}) {
  return EMPLOYEE_CLASSES.map((row) => ({
    classId: row.id,
    label: row.label,
    hourlyRate: Number.isFinite(Number(wageBook[row.id])) ? Number(wageBook[row.id]) : SHOP_HOURLY_RATE,
  }));
}

export function ratesToWageBook(rates) {
  const book = {};
  for (const row of rates || []) book[row.classId] = Number(row.hourlyRate) || 0;
  return book;
}

export function mergeLaborRates(stored, wageBook = {}) {
  const defaults = defaultLaborRates(wageBook);
  if (!stored?.length) return defaults;
  const byId = new Map(stored.map((row) => [row.classId || row.class_id, row]));
  return defaults.map((row) => {
    const match = byId.get(row.classId);
    if (!match) return row;
    const hourly = Number(match.hourlyRate ?? match.hourly_rate);
    return { ...row, hourlyRate: Number.isFinite(hourly) ? hourly : row.hourlyRate };
  });
}

export function resolveShopRates(stored, wageBook = {}) {
  if (looksLikeLegacyDefaultRates(stored)) return defaultLaborRates();
  if (!stored?.length && looksLikeLegacyDefaultRates(wageBook)) return defaultLaborRates();
  return mergeLaborRates(stored, looksLikeLegacyDefaultRates(wageBook) ? {} : wageBook);
}

export function applyRatesToCrew(crew, rates) {
  const byId = new Map((rates || []).map((row) => [row.classId, row]));
  return (crew || []).map((row) => {
    const rate = byId.get(row.id);
    if (!rate || row.wageEdited) return row;
    return { ...row, wage: rate.hourlyRate };
  });
}
