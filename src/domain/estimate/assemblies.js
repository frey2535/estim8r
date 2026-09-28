export const DEFAULT_ASSEMBLIES = [
  {
    id: "system-whole-home-standby-generator",
    name: "Whole-home standby generator",
    description: "Component-built standby-generator estimate. Enter measured raceway/conductor/control lengths and select a verified labor basis for every component before bidding.",
    category: "Generators",
    source: "system",
    active: true,
    components: [
      { id: "generator-set", description: "Install standby generator set", itemType: "equipment", category: "Equipment Termination", quantity: 1, unit: "EA", laborMhPerUnit: 0, requiresReview: true, notes: "Select the applicable verified generator-set labor reference for the generator size/configuration." },
      { id: "automatic-transfer-switch", description: "Install automatic transfer switch", itemType: "equipment", category: "Equipment Termination", quantity: 1, unit: "EA", laborMhPerUnit: 0, requiresReview: true, notes: "Select the applicable verified ATS labor reference for ampacity, poles, enclosure, and service configuration." },
      { id: "generator-raceway", description: "Generator feeder raceway", itemType: "material", category: "Rough-in", quantity: 1, unit: "LF", laborMhPerUnit: 0, requiresReview: true, notes: "Replace 1 LF with measured installed length; choose raceway type/size and verified labor item." },
      { id: "generator-feeder-conductors", description: "Generator feeder conductors", itemType: "material", category: "Wire/Cable Pulling", quantity: 1, unit: "LF", laborMhPerUnit: 0, requiresReview: true, notes: "Replace 1 LF with total measured conductor footage, including all phase/neutral/EGC conductors as applicable." },
      { id: "generator-control-cable", description: "Generator control / start wiring", itemType: "material", category: "Wire/Cable Pulling", quantity: 1, unit: "LF", laborMhPerUnit: 0, requiresReview: true, notes: "Replace 1 LF with measured control-cable length and select the verified cable labor basis." },
      { id: "generator-terminations", description: "Generator feeder terminations", itemType: "labor", category: "Equipment Termination", quantity: 1, unit: "EA", laborMhPerUnit: 0, requiresReview: true, notes: "Set the actual termination count and conductor size; do not assume terminations are included in raceway or wire-pull labor." },
      { id: "ats-terminations", description: "ATS line/load/generator terminations", itemType: "labor", category: "Equipment Termination", quantity: 1, unit: "EA", laborMhPerUnit: 0, requiresReview: true, notes: "Set actual termination count and size for utility, load, generator, neutral, and grounding conductors." },
      { id: "grounding-bonding", description: "Generator / ATS grounding and bonding", itemType: "labor", category: "Equipment Termination", quantity: 1, unit: "EA", laborMhPerUnit: 0, requiresReview: true, notes: "Include required grounding/bonding components based on separately derived system configuration." },
      { id: "disconnect-breaker", description: "Generator disconnect / breaker work", itemType: "equipment", category: "Equipment Termination", quantity: 1, unit: "EA", laborMhPerUnit: 0, requiresReview: true, notes: "Use only when applicable; select the correct device and verified installation labor." },
      { id: "generator-pad", description: "Generator equipment pad / mounting base", itemType: "labor", category: "Rough-in", quantity: 1, unit: "EA", laborMhPerUnit: 0, requiresReview: true, notes: "Use manufacturer pad, precast pad, or site-built base as applicable. Enter labor/material separately." },
      { id: "startup-testing", description: "Generator startup, testing, and commissioning", itemType: "labor", category: "Equipment Termination", quantity: 1, unit: "EA", laborMhPerUnit: 0, requiresReview: true, notes: "Include electrical startup/testing scope not provided by the manufacturer or generator vendor." },
    ],
  },
];

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
    requiresReview: Boolean(input.requiresReview),
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
    laborMatchStatus: component.requiresReview ? "review" : (component.laborItemId ? "assembly" : ""),
    laborReviewRequired: Boolean(component.requiresReview),
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
