/**
 * Generic estimate intelligence. This module is intentionally company-agnostic.
 * It models estimate completeness, installed cost and reusable assemblies without
 * embedding proprietary published labor values.
 */

export const ESTIMATE_COMPLETENESS_FIELDS = [
  { code: "material", label: "Material", defaultRequired: true },
  { code: "installation_labor", label: "Installation labor", defaultRequired: true },
  { code: "equipment", label: "Equipment / rentals", defaultRequired: false },
  { code: "supervision", label: "Supervision", defaultRequired: true },
  { code: "mobilization", label: "Mobilization", defaultRequired: true },
  { code: "demobilization", label: "Demobilization", defaultRequired: true },
  { code: "freight_delivery", label: "Freight / delivery", defaultRequired: true },
  { code: "permits", label: "Permits / fees", defaultRequired: false },
  { code: "bonds_insurance", label: "Bonds / special insurance", defaultRequired: false },
  { code: "temporary_power", label: "Temporary power", defaultRequired: false },
  { code: "waste", label: "Waste", defaultRequired: true },
  { code: "sales_tax", label: "Sales tax", defaultRequired: true },
  { code: "overhead", label: "Overhead", defaultRequired: true },
  { code: "profit", label: "Profit", defaultRequired: true },
  { code: "contingency", label: "Contingency", defaultRequired: false },
];

export function defaultCompletenessChecklist() {
  return ESTIMATE_COMPLETENESS_FIELDS.map((item) => ({
    ...item,
    required: item.defaultRequired,
    addressed: false,
    note: "",
  }));
}

export function auditEstimateCompleteness(checklist = []) {
  const byCode = new Map((checklist || []).map((item) => [item.code, item]));
  const rows = ESTIMATE_COMPLETENESS_FIELDS.map((definition) => ({
    ...definition,
    ...(byCode.get(definition.code) || {}),
  }));
  const required = rows.filter((row) => row.required);
  const missing = required.filter((row) => !row.addressed);
  return {
    rows,
    requiredCount: required.length,
    addressedCount: required.length - missing.length,
    missing,
    bidReady: missing.length === 0,
  };
}

export function installedCost({
  quantity = 0,
  materialUnitCost = 0,
  laborMhPerUnit = 0,
  laborRate = 0,
  equipmentUnitCost = 0,
} = {}) {
  const qty = number(quantity);
  const material = qty * number(materialUnitCost);
  const laborHours = qty * number(laborMhPerUnit);
  const labor = laborHours * number(laborRate);
  const equipment = qty * number(equipmentUnitCost);
  return {
    quantity: qty,
    material: round(material),
    laborHours: round(laborHours, 4),
    labor: round(labor),
    equipment: round(equipment),
    installed: round(material + labor + equipment),
  };
}

export function expandAssembly(assembly, assemblyQuantity = 1) {
  const qty = number(assemblyQuantity);
  return (assembly?.components || []).map((component, index) => ({
    ...component,
    assemblyId: assembly.id,
    assemblyName: assembly.name,
    assemblyComponentIndex: index,
    quantity: round(qty * number(component.quantity), 4),
  }));
}

export function rollupByDrawing(lines = []) {
  const map = new Map();
  for (const line of lines || []) {
    const sheet = line.drawingSheet || line.sheetNumber || line.sheet || "Unassigned";
    const current = map.get(sheet) || { sheet, quantity: 0, laborHours: 0, material: 0, labor: 0, installed: 0, lineCount: 0 };
    const cost = installedCost(line);
    current.quantity += cost.quantity;
    current.laborHours += cost.laborHours;
    current.material += cost.material;
    current.labor += cost.labor;
    current.installed += cost.installed;
    current.lineCount += 1;
    map.set(sheet, current);
  }
  return [...map.values()].map((row) => ({
    ...row,
    quantity: round(row.quantity, 4),
    laborHours: round(row.laborHours, 4),
    material: round(row.material),
    labor: round(row.labor),
    installed: round(row.installed),
  }));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
