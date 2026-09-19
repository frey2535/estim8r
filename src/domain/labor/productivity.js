import { combineProductivityFactors } from "./laborEngine.js";

/** Catalog of explicit field conditions. Default multiplier is 1.00 — no invented hours. */
export const PRODUCTIVITY_FACTOR_CATALOG = [
  { code: "height", label: "Height", category: "height", multiplier: 1, description: "Working height / elevation." },
  { code: "congestion", label: "Congestion", category: "congestion", multiplier: 1, description: "Congested work area." },
  { code: "occupied_space", label: "Occupied space", category: "occupied_space", multiplier: 1, description: "Occupied or operational building." },
  { code: "material_handling", label: "Material handling distance", category: "material_handling", multiplier: 1, description: "Distance from staging to install." },
  { code: "access", label: "Restricted access", category: "access", multiplier: 1, description: "Restricted or limited access." },
  { code: "shift", label: "Shift / overtime", category: "shift", multiplier: 1, description: "Shift work or overtime conditions." },
  { code: "weather", label: "Weather", category: "weather", multiplier: 1, description: "Weather exposure." },
  { code: "repetition", label: "Repetitive work", category: "repetition", multiplier: 1, description: "Repetition / learning-curve adjustment." },
  { code: "prefab", label: "Prefab", category: "prefab", multiplier: 1, description: "Prefabrication credit or penalty." },
  { code: "equipment", label: "Lift / scaffold / equipment", category: "equipment", multiplier: 1, description: "Lift, scaffold, or special equipment." },
  { code: "underground", label: "Underground", category: "underground", multiplier: 1, description: "Underground or buried conditions." },
  { code: "custom", label: "Custom project condition", category: "custom", multiplier: 1, description: "Estimator-defined project condition." },
];

export function defaultProductivityFactors() {
  return PRODUCTIVITY_FACTOR_CATALOG.map((factor) => ({
    id: factor.code,
    code: factor.code,
    label: factor.label,
    category: factor.category,
    multiplier: 1,
    notes: "",
  }));
}

export function activeProductivityFactors(factors = []) {
  return (factors || []).filter((factor) => Number(factor.multiplier) > 0 && Number(factor.multiplier) !== 1);
}

export function productivitySummary(factors = []) {
  const list = factors?.length ? factors : defaultProductivityFactors();
  const multiplier = combineProductivityFactors(list);
  return {
    factors: list,
    active: activeProductivityFactors(list),
    multiplier: round4(multiplier),
  };
}

export function setFactorMultiplier(factors, code, multiplier, notes = "") {
  const next = (factors?.length ? factors : defaultProductivityFactors()).map((factor) => (
    factor.code === code
      ? { ...factor, multiplier: Math.max(0.01, Number(multiplier) || 1), notes }
      : factor
  ));
  return next;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}
