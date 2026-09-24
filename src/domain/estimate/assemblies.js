export const DEFAULT_ASSEMBLIES = [];

export function normalizeAssembly(input = {}) {
  return {
    id: input.id || makeId(),
    name: String(input.name || "").trim(),
    description: String(input.description || "").trim(),
    category: String(input.category || "").trim(),
    components: (input.components || []).map(normalizeComponent),
    source: input.source || "user",
    active: input.active !== false,
  };
}

export function normalizeComponent(input = {}) {
  return {
    id: input.id || makeId(),
    laborItemId: input.laborItemId || "",
    description: String(input.description || "").trim(),
    itemType: input.itemType || "",
    category: input.category || "",
    quantity: positive(input.quantity, 1),
    unit: input.unit || "EA",
    materialUnitCost: nonnegative(input.materialUnitCost),
    laborMhPerUnit: nonnegative(input.laborMhPerUnit),
    notes: input.notes || "",
  };
}

export function validateAssembly(input) {
  const assembly = normalizeAssembly(input);
  const errors = [];
  if (!assembly.name) errors.push("Assembly name is required.");
  if (!assembly.components.length) errors.push("Add at least one component.");
  assembly.components.forEach((component, index) => {
    if (!component.description) errors.push("Component " + (index + 1) + " needs a description.");
    if (!(component.quantity > 0)) errors.push("Component " + (index + 1) + " quantity must be greater than zero.");
  });
  return { assembly, errors, valid: errors.length === 0 };
}

export function assemblyToEstimateLines(input, assemblyQuantity = 1, laborRate = 0) {
  const { assembly, errors, valid } = validateAssembly(input);
  if (!valid) {
    const error = new Error(errors.join(" "));
    error.code = "INVALID_ASSEMBLY";
    throw error;
  }
  const multiplier = positive(assemblyQuantity, 1);
  return assembly.components.map((component) => ({
    id: makeId(),
    source: "assembly",
    assemblyId: assembly.id,
    assemblyName: assembly.name,
    assemblyComponentId: component.id,
    takeoffKey: "",
    itemType: component.itemType,
    category: component.category,
    description: component.description,
    quantity: round(component.quantity * multiplier, 4),
    unit: component.unit,
    materialUnitCost: component.materialUnitCost,
    laborMhPerUnit: component.laborMhPerUnit,
    laborRate: nonnegative(laborRate),
    notes: component.notes,
    included: true,
    quantityEdited: true,
    laborRateEdited: false,
    laborMhEdited: false,
    laborMatchStatus: component.laborItemId ? "assembly" : "",
    laborItemId: component.laborItemId,
  }));
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "asm-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}
function nonnegative(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
