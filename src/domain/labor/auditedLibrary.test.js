import {
  AUDITED_LABOR_ITEMS,
  listBundledLaborLibrary,
  matchAuditedLaborHours,
  textHasSize,
} from "./auditedLibrary.js";
import { assignLaborHours } from "./libraryDocument.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(AUDITED_LABOR_ITEMS.length === 1921, `expected 1921 workbook rows, got ${AUDITED_LABOR_ITEMS.length}`);
assert(listBundledLaborLibrary().length === 1921, "library lists every workbook row");
assert(AUDITED_LABOR_ITEMS.filter((row) => row.labor_units[0].production_allowed).length === 5, "five production-ready rows");
assert(AUDITED_LABOR_ITEMS.filter((row) => row.labor_units[0].verification_status === "unverified").length === 1916, "1,916 model-baseline rows");

const listed = listBundledLaborLibrary({ search: "EL-00051" });
assert(listed.length === 1 && listed[0].id === "EL-00051", "library search finds the connector by id");

const emt34 = matchAuditedLaborHours({ category: "Raceway", symbol: 'EMT 3/4"', unit: "LF" });
assert(emt34?.laborItemId === "EL-00050", `3/4 EMT maps to EL-00050, got ${emt34?.laborItemId}`);
assert(emt34?.mhPerUnit === 0.05, `3/4 EMT mh ${emt34?.mhPerUnit}`);

const emt1 = matchAuditedLaborHours({ category: "Raceway", symbol: 'EMT 1"', unit: "LF" });
assert(emt1?.laborItemId === "EL-00061", `1 in EMT maps to EL-00061, got ${emt1?.laborItemId}`);
assert(emt1?.mhPerUnit === 0.055, `1 in EMT mh ${emt1?.mhPerUnit}`);

const half = matchAuditedLaborHours({ category: "Raceway", symbol: "EMT 1/2", unit: "LF" });
assert(half?.laborItemId === "EL-00039" && half.mhPerUnit === 0.038, `1/2 EMT uses model baseline ${half?.laborItemId} ${half?.mhPerUnit}`);

const connector = matchAuditedLaborHours({ category: "Raceways", symbol: "EMT connector 3/4 in", unit: "EA" });
assert(connector?.laborItemId === "EL-00051" && connector.mhPerUnit === 0.1, "connector uses EL-00051");

const coupling = matchAuditedLaborHours({ category: "Raceways", symbol: "3/4 EMT coupling", unit: "EA" });
assert(coupling?.laborItemId === "EL-00052" && coupling.mhPerUnit === 0.05, "coupling uses EL-00052");

const elbow = matchAuditedLaborHours({ category: "Raceways", symbol: "EMT factory elbow 3/4", unit: "EA" });
assert(elbow?.laborItemId === "EL-00053" && elbow.mhPerUnit === 0.22, "elbow uses EL-00053");

assert(textHasSize('emt 3/4"', "3/4 in"), "3/4 in matches 3/4\"");
assert(!textHasSize("emt 1/2", "1 in"), "1 in does not match 1/2");
assert(!textHasSize("emt 1-1/4", "1 in"), "1 in does not match 1-1/4");

const assigned = assignLaborHours({ category: "Raceway", symbol: 'EMT 3/4"', unit: "LF" });
assert(assigned.laborItemId === "EL-00050", "assignLaborHours prefers verified workbook labor");
assert(assigned.note.includes("Verified production labor"), assigned.note);

const troffer = assignLaborHours({ category: "Lighting", symbol: "2x4 troffer", unit: "EA" });
assert(troffer.laborItemId === "EL-01517" && troffer.mhPerUnit === 0.75, `troffer uses workbook ${troffer.laborItemId} ${troffer.mhPerUnit}`);

const duplex = assignLaborHours({ category: "Receptacles", symbol: "Duplex receptacle", unit: "EA" });
assert(duplex.laborItemId === "EL-01500" && duplex.mhPerUnit === 0.22, `duplex uses workbook ${duplex.laborItemId} ${duplex.mhPerUnit}`);

if (!process.exitCode) console.log("audited labor library checks passed");
