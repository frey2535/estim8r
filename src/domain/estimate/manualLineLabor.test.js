import { applyManualLineLabor, hydrateManualLineLabor, lookupManualLineLabor, UNMATCHED_LABOR_NOTE } from "./manualLineLabor.js";
import { defaultProductivityFactors, setFactorMultiplier } from "../labor/productivity.js";
import { EXPERIMENTAL_LABOR_SOURCE } from "../labor/sources.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

function line(overrides = {}) {
  return {
    id: "manual-1",
    takeoffKey: "",
    source: "manual",
    itemType: "Material",
    category: "",
    description: "",
    quantity: 1,
    unit: "EA",
    materialUnitCost: 0,
    laborMhPerUnit: 0,
    laborRate: 68,
    notes: "",
    included: true,
    quantityEdited: true,
    laborRateEdited: false,
    laborMhEdited: false,
    ...overrides,
  };
}

const emt = applyManualLineLabor(line({ description: '1/2" EMT', quantity: 10, unit: "FT" }));
assert(emt.laborItemId === "EL-00039", `1/2 EMT maps to EL-00039, got ${emt.laborItemId}`);
assert(emt.laborMhPerUnit === 0.038, `1/2 EMT MH/unit ${emt.laborMhPerUnit}`);
assert(Number((10 * emt.laborMhPerUnit).toFixed(4)) === 0.38, `10 FT * 0.038 = 0.38 hours, got ${10 * emt.laborMhPerUnit}`);
assert(emt.laborRate === 68, "labor $ follows the selected class");
assert(emt.laborMatchStatus === "matched", "1/2 EMT is a library match");
assert(emt.laborSource === EXPERIMENTAL_LABOR_SOURCE.name, emt.laborSource);
assert(!/neca/i.test(JSON.stringify(emt)), "matched EMT is not labeled NECA");
assert(emt.quantity === 10 && emt.quantityEdited === true, "quantity stays editable on the estimate");

const pvc = applyManualLineLabor(line({ description: '3/4" PVC', quantity: 25, unit: "LF" }));
assert(pvc.laborItemId === "EL-00576", `3/4 PVC maps to EL-00576, got ${pvc.laborItemId}`);
assert(pvc.laborMhPerUnit === 0.0338, `3/4 PVC MH/unit ${pvc.laborMhPerUnit}`);
assert(pvc.laborMatchStatus === "matched", "3/4 PVC is a library match");

const saved = hydrateManualLineLabor(line({
  description: '1/2" EMT',
  quantity: 10,
  unit: "FT",
  laborMhPerUnit: 0,
  laborMhEdited: true,
}));
assert(saved.laborItemId === "EL-00039" && saved.laborMhPerUnit === 0.038, "saved 0-MH lines are hydrated from the library");
assert(hydrateManualLineLabor(line({ description: "EMT 1/2", laborMhPerUnit: 0.2, laborMhEdited: true, laborMatchStatus: "overridden" })).laborMhPerUnit === 0.2, "explicit MH override is kept");

const lighting = applyManualLineLabor(line({ description: "lighting", quantity: 6, unit: "EA" }));
assert(lighting.laborMhPerUnit === 0, `generic lighting must not invent hours, got ${lighting.laborMhPerUnit}`);
assert(lighting.laborMatchStatus === "unmatched", "generic lighting is unmatched");
assert(lighting.notes === UNMATCHED_LABOR_NOTE, lighting.notes);
assert(!/neca/i.test(lighting.notes), "unmatched state is not labeled NECA");

const troffer = applyManualLineLabor(line({ description: "2x4 troffer", quantity: 4, unit: "EA", itemType: "Fixture" }));
assert(troffer.laborItemId === "EL-01517", `troffer maps to EL-01517, got ${troffer.laborItemId}`);
assert(troffer.laborMhPerUnit === 0.75, `troffer MH/unit ${troffer.laborMhPerUnit}`);
assert(Number((4 * troffer.laborMhPerUnit).toFixed(2)) === 3, "4 fixtures * 0.75 = 3 hours");

const factors = setFactorMultiplier(defaultProductivityFactors(), "height", 1.25);
const emtHigh = applyManualLineLabor(line({ description: "EMT 1/2", quantity: 100, unit: "LF" }), { factors, rate: 70 });
assert(emtHigh.laborMhPerUnit === 0.0475, `productivity 1.25 * 0.038 = 0.0475, got ${emtHigh.laborMhPerUnit}`);
assert(emtHigh.laborRate === 70, "crew rate fills Labor $/hr when the line is not overridden");

const rateHold = applyManualLineLabor(line({
  description: "EMT 1/2",
  unit: "LF",
  laborRate: 91,
  laborRateEdited: true,
}), { rate: 70 });
assert(rateHold.laborRate === 91, "overridden labor $ is kept");

const typedNotes = applyManualLineLabor(line({ description: "mystery widget", unit: "EA", notes: "Field note" }));
assert(typedNotes.laborMatchStatus === "unmatched", "unknown item is unmatched");
assert(typedNotes.notes === "Field note", "estimator notes are not overwritten");

const blank = applyManualLineLabor(line());
assert(blank.laborMatchStatus === "", "empty line has no unmatched banner");
assert(blank.laborMhPerUnit === 0, "empty line stays at 0 MH");

const lookup = lookupManualLineLabor(line({ description: 'EMT 3/4"', unit: "LF" }));
assert(lookup.laborItemId === "EL-00050" && lookup.mhPerUnit === 0.05, `3/4 EMT lookup ${lookup.laborItemId} ${lookup.mhPerUnit}`);

if (!process.exitCode) console.log("manual estimate line labor checks passed");
