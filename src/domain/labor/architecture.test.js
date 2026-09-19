import { AUDITED_LABOR_ITEMS, listBundledLaborTaxonomy, verificationSummary } from "./auditedLibrary.js";
import { calculateEstimatedHours } from "./laborEngine.js";
import { upsertCustomLabor } from "./customLabor.js";
import { namedFromCrew, crewFromNamed } from "./crews.js";
import { defaultCrew, compositeWage } from "./employeeClasses.js";
import { defaultLaborRates, applyRatesToCrew } from "./rates.js";
import { defaultProductivityFactors, setFactorMultiplier, productivitySummary } from "./productivity.js";
import { buildLaborSourceOptions, makeLaborSelection, applySelectionToLine } from "./selection.js";
import { EXPERIMENTAL_LABOR_SOURCE, isProductionSafeLabor } from "./sources.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const summary = verificationSummary();
assert(summary.items === 1921, `1921 taxonomy items, got ${summary.items}`);
assert(summary.experimental === 1921, `1921 experimental units, got ${summary.experimental}`);
assert(summary.unverified === 1921, `1921 unverified units, got ${summary.unverified}`);
assert(summary.productionAllowed === 0, "no imported unit is production-allowed");
assert(summary.verified === 0, "no imported unit is verified");
assert(!JSON.stringify(AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-00050")?.labor_units).toLowerCase().includes("neca"), "EL-00050 is not labeled NECA");

const taxonomy = listBundledLaborTaxonomy();
assert(taxonomy.length > 5, "taxonomy has multiple categories");
assert(taxonomy.every((row) => row.category && Array.isArray(row.subcategories)), "taxonomy is category/subcategory");

const item = AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-00050");
const options = buildLaborSourceOptions({ laborItem: item });
assert(options.length === 4, "selector shows four sources");
assert(options[0].sourceType === "published_reference" && options[0].available === false && options[0].mh == null, "published/NECA is empty");
assert(options[2].sourceType === "experimental" && options[2].mh === 0.05, "experimental keeps imported 0.05 MH");
assert(options[3].sourceType === "custom" && options[3].available === false, "custom starts empty");

const factors = setFactorMultiplier(defaultProductivityFactors(), "height", 1.25);
const selection = makeLaborSelection({
  laborItemId: item.id,
  option: options[2],
  factors,
  acknowledgedUnverified: true,
});
assert(selection.selectedSource === "experimental", "selection is experimental");
assert(selection.factorMultiplier === 1.25, `factor multiplier ${selection.factorMultiplier}`);
assert(selection.effectiveMhPerUnit === 0.0625, `effective mh ${selection.effectiveMhPerUnit}`);
assert(selection.productionSafe === false, "experimental is not production-safe");

const hours = calculateEstimatedHours({ quantity: 200, quantityPerLaborUnit: 1, selection });
assert(hours.estimatedHours === 12.5, `200 LF * 0.0625 = 12.5, got ${hours.estimatedHours}`);

const line = applySelectionToLine({
  id: "1",
  quantity: 200,
  laborRate: 68,
  laborRateEdited: false,
}, selection, { rate: 68 });
assert(line.laborMhPerUnit === 0.0625, "line MH includes productivity");
assert(line.laborSource === EXPERIMENTAL_LABOR_SOURCE.name, line.laborSource);

const custom = upsertCustomLabor([], { laborItemId: "EL-00050", itemName: "Install EMT", unit: "LF", normalMh: 0.04 });
assert(custom.saved.normal_mh === 0.04, "custom labor stores estimator hours");
let threw = false;
try {
  upsertCustomLabor([], { laborItemId: "EL-00050", itemName: "Install EMT", unit: "LF" });
} catch {
  threw = true;
}
assert(threw, "custom labor refuses invented blank hours");

const rates = defaultLaborRates({ journeyman: 70 });
assert(rates.find((row) => row.classId === "journeyman").hourlyRate === 70, "labor rates use stored wage book");
const priced = applyRatesToCrew(defaultCrew(), rates);
assert(priced.find((row) => row.id === "journeyman").wage === 70, "crew wages follow the rate book");

const named = namedFromCrew("Service pair", defaultCrew().map((row) => (
  row.id === "journeyman" || row.id === "apprentice-1"
    ? { ...row, selected: true, headcount: 1 }
    : { ...row, selected: false, headcount: 0 }
)));
assert(named.members.length === 2, "named crew stores selected classes");
const restored = crewFromNamed(named);
assert(compositeWage(restored).count === 2, "named crew restores composition");

assert(productivitySummary(defaultProductivityFactors()).multiplier === 1, "default factors do not invent a multiplier");
assert(!isProductionSafeLabor({ sourceType: "experimental", verificationStatus: "unverified", productionAllowed: false }), "gate blocks experimental");

if (!process.exitCode) console.log("labor architecture checks passed");
