export const INSTALLATION_CONDITION_CATALOG = [
  { code: "concealed", label: "Concealed", group: "installation" },
  { code: "exposed", label: "Exposed", group: "installation" },
  { code: "slab", label: "In slab", group: "installation" },
  { code: "underground", label: "Underground", group: "installation" },
  { code: "elevated", label: "Elevated work", group: "access" },
  { code: "congested", label: "Congested", group: "access" },
  { code: "restricted_access", label: "Restricted access", group: "access" },
  { code: "occupied", label: "Occupied / operational", group: "project" },
  { code: "long_material_handling", label: "Long material handling", group: "project" },
  { code: "short_run", label: "Short run", group: "run_length" },
  { code: "long_run", label: "Long run", group: "run_length" },
  { code: "repetitive", label: "Repetitive work", group: "production" },
  { code: "prefabricated", label: "Prefabricated", group: "production" },
  { code: "lift_scaffold", label: "Lift / scaffold", group: "equipment" },
  { code: "weather_exposed", label: "Weather exposed", group: "project" },
  { code: "shift_work", label: "Shift / off-hours", group: "project" },
];

export function defaultInstallationConditions() {
  return INSTALLATION_CONDITION_CATALOG.map((row) => ({ ...row, enabled: false, multiplier: 1, note: "", source: "estimator" }));
}

export function installationConditionSummary(conditions = []) {
  const active = (conditions || []).filter((row) => row.enabled);
  const multiplier = active.reduce((total, row) => total * safeMultiplier(row.multiplier), 1);
  return { active, multiplier: round4(multiplier) };
}

export function applyInstallationConditions(baseMhPerUnit, conditions = []) {
  const base = Math.max(0, Number(baseMhPerUnit) || 0);
  const summary = installationConditionSummary(conditions);
  return { baseMhPerUnit: base, conditionMultiplier: summary.multiplier, adjustedMhPerUnit: round4(base * summary.multiplier), activeConditions: summary.active };
}

function safeMultiplier(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(10, Math.max(0.1, parsed));
}
function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}
