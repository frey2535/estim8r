import { EMPLOYEE_CLASSES } from "./employeeClasses.js";

export const LABOR_RATES_KEY = "estim8r.labor-rates.v1";

export function defaultLaborRates(wageBook = {}) {
  return EMPLOYEE_CLASSES.map((row) => ({
    classId: row.id,
    label: row.label,
    hourlyRate: Number.isFinite(Number(wageBook[row.id])) ? Number(wageBook[row.id]) : row.defaultWage,
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

export function applyRatesToCrew(crew, rates) {
  const byId = new Map((rates || []).map((row) => [row.classId, row]));
  return (crew || []).map((row) => {
    const rate = byId.get(row.id);
    if (!rate || row.wageEdited) return row;
    return { ...row, wage: rate.hourlyRate };
  });
}
