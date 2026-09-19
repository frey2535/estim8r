/** Editable crew classes. Wages are starting values the estimator can change. */
export const EMPLOYEE_CLASSES = [
  { id: "superintendent", label: "Superintendent", defaultWage: 110 },
  { id: "general-foreman", label: "General Foreman", defaultWage: 95 },
  { id: "foreman", label: "Foreman", defaultWage: 85 },
  { id: "supervisor", label: "Supervisor", defaultWage: 78 },
  { id: "journeyman", label: "Journeyman", defaultWage: 68 },
  { id: "apprentice-1", label: "Apprentice 1", defaultWage: 61 },
  { id: "apprentice-2", label: "Apprentice 2", defaultWage: 54 },
  { id: "apprentice-3", label: "Apprentice 3", defaultWage: 48 },
  { id: "apprentice-4", label: "Apprentice 4", defaultWage: 41 },
  { id: "apprentice-5", label: "Apprentice 5", defaultWage: 34 },
  { id: "helper", label: "Helper", defaultWage: 28 },
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
