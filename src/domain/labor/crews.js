import { compositeWage, defaultCrew } from "./employeeClasses.js";

export const NAMED_CREWS_KEY = "estim8r.named-crews.v1";

export function crewFromNamed(named, wageBook = {}) {
  const members = new Map((named?.members || []).map((row) => [row.classId || row.class_id, row]));
  return defaultCrew(wageBook).map((row) => {
    const member = members.get(row.id);
    if (!member) return { ...row, selected: false, headcount: 0 };
    const headcount = Number(member.headcount) || 0;
    const wage = Number(member.hourlyRate ?? member.hourly_rate ?? row.wage);
    return {
      ...row,
      wage: Number.isFinite(wage) ? wage : row.wage,
      selected: headcount > 0,
      headcount,
    };
  });
}

export function namedFromCrew(name, crew, { id, notes = "" } = {}) {
  const members = (crew || [])
    .filter((row) => row.selected || Number(row.headcount) > 0)
    .map((row) => ({
      classId: row.id,
      label: row.label,
      hourlyRate: Number(row.wage) || 0,
      headcount: Number(row.headcount) || 0,
    }));
  const wage = compositeWage(crew);
  return {
    id: id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `crew-${Date.now()}`),
    name: String(name || "").trim() || wage.label || "Crew",
    notes,
    members,
    rate: wage.rate,
    active: true,
  };
}

export function upsertNamedCrew(list, named) {
  const rows = [...(list || [])];
  const index = rows.findIndex((row) => row.id === named.id);
  if (index >= 0) {
    rows[index] = { ...rows[index], ...named };
    return rows;
  }
  return [named, ...rows];
}
