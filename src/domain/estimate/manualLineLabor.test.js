import { AUDITED_LABOR_ITEMS } from "../labor/auditedLibrary.js";
import {
  applyLibraryItemToLine,
  applyManualLineLabor,
  conduitQtyHint,
  estimateLineHours,
  filterLaborLibrary,
  hydrateManualLineLabor,
  laborInstallQuantity,
} from "./manualLineLabor.js";
import { defaultProductivityFactors, setFactorMultiplier } from "../labor/productivity.js";
import { EXPERIMENTAL_LABOR_SOURCE } from "../labor/sources.js";
import { estimateGrandTotal } from "./projectDocuments.js";

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

const emtItem = AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-00039");
const pvcItem = AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-00576");
const floodItem = AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-01527");
assert(emtItem && pvcItem && floodItem, "workbook still has EMT, PVC, and flood light rows");

assert(filterLaborLibrary(AUDITED_LABOR_ITEMS, "1/2", { itemType: "Conduit", category: "EMT conduit" }).some((row) => row.id === "EL-00039"), "typeahead finds 1/2 EMT in EMT conduit");
assert(filterLaborLibrary(AUDITED_LABOR_ITEMS, "3/4", { itemType: "Conduit", category: "PVC conduit" }).some((row) => row.id === "EL-00576"), "typeahead finds 3/4 PVC in PVC conduit");
assert(filterLaborLibrary(AUDITED_LABOR_ITEMS, "flood", { itemType: "Fixture", category: "Lighting" }).some((row) => row.id === "EL-01527"), "typeahead finds flood light in Lighting");
assert(filterLaborLibrary(AUDITED_LABOR_ITEMS, "xyzzy-no-such-item", { itemType: "Conduit", category: "EMT conduit" }).length === 0, "empty search is unmatched, not invented");

const emt = applyLibraryItemToLine(line({ quantity: 10, unit: "FT" }), emtItem);
assert(emt.laborItemId === "EL-00039", `1/2 EMT pick is EL-00039, got ${emt.laborItemId}`);
assert(emt.laborMhPerUnit === 0.038, `1/2 EMT MH/LF ${emt.laborMhPerUnit}`);
assert(laborInstallQuantity(emt, emtItem) === 100, `10 sticks × 10' = 100 LF, got ${laborInstallQuantity(emt, emtItem)}`);
assert(estimateLineHours(emt, emtItem) === 3.8, `100 LF × 0.038 = 3.8 hours, got ${estimateLineHours(emt, emtItem)}`);
assert(emt.quantity === 10, "stick count stays editable");
assert(conduitQtyHint(emt, emtItem).includes("100 LF"), conduitQtyHint(emt, emtItem));
assert(emt.laborSource === EXPERIMENTAL_LABOR_SOURCE.name, emt.laborSource);
assert(!/neca/i.test(JSON.stringify(emt)), "picked EMT is not labeled NECA");

const emtFeet = applyLibraryItemToLine(line({ quantity: 10, unit: "LF" }), emtItem);
assert(laborInstallQuantity(emtFeet, emtItem) === 10, "LF qty is feet, not sticks");
assert(estimateLineHours(emtFeet, emtItem) === 0.38, `10 LF × 0.038 = 0.38, got ${estimateLineHours(emtFeet, emtItem)}`);

const pvc = applyLibraryItemToLine(line({ quantity: 1, unit: "EA" }), pvcItem);
assert(pvc.laborItemId === "EL-00576", `3/4 PVC pick is EL-00576, got ${pvc.laborItemId}`);
assert(pvc.laborMhPerUnit === 0.0338, `3/4 PVC MH/LF ${pvc.laborMhPerUnit}`);
assert(laborInstallQuantity(pvc, pvcItem) === 10, "1 stick of PVC is 10 LF");
assert(estimateLineHours(pvc, pvcItem) === 0.338, `10 LF × 0.0338 = 0.338 hours, got ${estimateLineHours(pvc, pvcItem)}`);

const sign = applyLibraryItemToLine(line({
  description: "Lights that shone upon a roadside sign",
  quantity: 2,
  unit: "EA",
}), floodItem);
assert(sign.laborItemId === "EL-01527", `street-sign lights pick a fixture row, got ${sign.laborItemId}`);
assert(sign.description === "Lights that shone upon a roadside sign", "prose description is kept after a library pick");
assert(sign.laborMhPerUnit === 0.65, `flood light MH/ea ${sign.laborMhPerUnit}`);
assert(estimateLineHours(sign, floodItem) === 1.3, `2 fixtures × 0.65 = 1.3 hours, got ${estimateLineHours(sign, floodItem)}`);
assert(sign.laborMatchStatus === "matched", "a library pick is not unmatched");

const proseOnly = applyManualLineLabor(line({ description: "Lights that shone upon a roadside sign", quantity: 2 }));
assert(proseOnly.laborMhPerUnit === 0, "prose without a pick does not invent hours");
assert(proseOnly.laborMatchStatus === "", "prose without a pick is not an unmatched banner");

const factors = setFactorMultiplier(defaultProductivityFactors(), "height", 1.25);
const emtHigh = applyLibraryItemToLine(line({ quantity: 10, unit: "STICK" }), emtItem, { factors, rate: 70 });
assert(emtHigh.laborMhPerUnit === 0.0475, `productivity 1.25 × 0.038 = 0.0475, got ${emtHigh.laborMhPerUnit}`);
assert(estimateLineHours(emtHigh, emtItem) === 4.75, `100 LF × 0.0475 = 4.75, got ${estimateLineHours(emtHigh, emtItem)}`);
assert(emtHigh.laborRate === 70, "crew rate fills Labor $/hr when the line is not overridden");

const rateHold = applyLibraryItemToLine(line({
  quantity: 10,
  laborRate: 91,
  laborRateEdited: true,
}), emtItem, { rate: 70 });
assert(rateHold.laborRate === 91, "overridden labor $ is kept");

const takeoff = estimateLineHours({ source: "takeoff", quantity: 100, unit: "LF", category: "Raceways", laborMhPerUnit: 0.038 });
assert(takeoff === 3.8, "takeoff conduit qty is already feet");

const totals = estimateGrandTotal({
  overhead: 0,
  profit: 0,
  lines: [applyLibraryItemToLine(line({ quantity: 10, laborRate: 68 }), emtItem)],
});
assert(Math.abs(totals.hours - 3.8) < 0.0001, `totals use 100 LF, got ${totals.hours}`);
assert(Math.abs(totals.labor - 3.8 * 68) < 0.02, `labor $ ${totals.labor}`);

const saved = hydrateManualLineLabor(line({
  laborItemId: "EL-00039",
  quantity: 10,
  laborMhPerUnit: 0,
  laborMhEdited: false,
}), { items: AUDITED_LABOR_ITEMS });
assert(saved.laborMhPerUnit === 0.038, "saved library picks hydrate MH/unit");
assert(hydrateManualLineLabor(line({
  laborItemId: "EL-00039",
  laborMhPerUnit: 0.2,
  laborMhEdited: true,
  laborMatchStatus: "overridden",
}), { items: AUDITED_LABOR_ITEMS }).laborMhPerUnit === 0.2, "explicit MH override is kept");

if (!process.exitCode) console.log("manual estimate line labor checks passed");
