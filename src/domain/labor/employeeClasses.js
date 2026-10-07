/** Shop default is $95/hr for every class. The estimator can change a class; that value persists until changed again. */
export const SHOP_HOURLY_RATE = 95;

export const EMPLOYEE_CLASSES = [
  { id: "superintendent", label: "Superintendent", defaultWage: SHOP_HOURLY_RATE },
  { id: "general-foreman", label: "General Foreman", defaultWage: SHOP_HOURLY_RATE },
  { id: "foreman", label: "Foreman", defaultWage: SHOP_HOURLY_RATE },
  { id: "supervisor", label: "Supervisor", defaultWage: SHOP_HOURLY_RATE },
  { id: "journeyman", label: "Journeyman", defaultWage: SHOP_HOURLY_RATE },
  { id: "apprentice-1", label: "Apprentice 1", defaultWage: SHOP_HOURLY_RATE },
  { id: "apprentice-2", label: "Apprentice 2", defaultWage: SHOP_HOURLY_RATE },
  { id: "apprentice-3", label: "Apprentice 3", defaultWage: SHOP_HOURLY_RATE },
  { id: "apprentice-4", label: "Apprentice 4", defaultWage: SHOP_HOURLY_RATE },
  { id: "apprentice-5", label: "Apprentice 5", defaultWage: SHOP_HOURLY_RATE },
  { id: "helper", label: "Helper", defaultWage: SHOP_HOURLY_RATE },
];

export const DEFAULT_CLASS_ID = "journeyman";

export function defaultCrew(wageOverrides = {}) {
  return EMPLOYEE_CLASSES.map((row) => {
    const selected = row.id === DEFAULT_CLASS_ID;
    const wage = Number.isFinite(Number(wageOverrides[row.id])) ? Number(wageOverrides[row.id]) : row.defaultWage;
    return {
      id: row.id,
      label: row.label,
      wage,
      selected,
      headcount: selected ? 1 : 0,
    };
  });
}

export function journeymanWage(crew) {
  const row = (crew || []).find((item) => item.id === DEFAULT_CLASS_ID);
  const fallback = EMPLOYEE_CLASSES.find((item) => item.id === DEFAULT_CLASS_ID);
  const wage = Number(row?.wage);
  return Number.isFinite(wage) ? wage : fallback.defaultWage;
}

/** Weighted average of selected classes. Falls back to Journeyman wage. */
export function compositeWage(crew) {
  const selected = (crew || []).filter((row) => row.selected);
  const active = selected.filter((row) => Number(row.headcount) > 0);
  const use = active.length ? active : selected;
  if (!use.length) {
    return { rate: journeymanWage(crew), label: "Journeyman", count: 1 };
  }
  const heads = use.reduce((sum, row) => sum + Math.max(1, Number(row.headcount) || 1), 0);
  const cost = use.reduce((sum, row) => sum + (Number(row.wage) || 0) * Math.max(1, Number(row.headcount) || 1), 0);
  return {
    rate: Math.round((cost / heads) * 100) / 100,
    label: use.map((row) => row.label).join(", "),
    count: use.length,
  };
}
