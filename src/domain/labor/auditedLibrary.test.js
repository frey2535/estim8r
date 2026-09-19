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

assert(AUDITED_LABOR_ITEMS.length === 5, `expected 5 audited rows, got ${AUDITED_LABOR_ITEMS.length}`);
assert(AUDITED_LABOR_ITEMS.every((row) => row.labor_units[0].production_allowed), "all imported rows are production ready");
assert(AUDITED_LABOR_ITEMS.every((row) => row.labor_units[0].verification_status === "verified"), "all imported rows are verified");

const listed = listBundledLaborLibrary({ search: "connector" });
assert(listed.length === 1 && listed[0].id === "EL-00051", "library search finds the connector");

const emt34 = matchAuditedLaborHours({ category: "Raceway", symbol: 'EMT 3/4"', unit: "LF" });
assert(emt34?.laborItemId === "EL-00050", `3/4 EMT maps to EL-00050, got ${emt34?.laborItemId}`);
assert(emt34?.mhPerUnit === 0.05, `3/4 EMT mh ${emt34?.mhPerUnit}`);

const emt1 = matchAuditedLaborHours({ category: "Raceway", symbol: 'EMT 1"', unit: "LF" });
assert(emt1?.laborItemId === "EL-00061", `1 in EMT maps to EL-00061, got ${emt1?.laborItemId}`);
assert(emt1?.mhPerUnit === 0.055, `1 in EMT mh ${emt1?.mhPerUnit}`);

const half = matchAuditedLaborHours({ category: "Raceway", symbol: "EMT 1/2", unit: "LF" });
assert(half === null, "1/2 EMT is not in the audited production set");

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
assert(assigned.laborItemId === "EL-00050", "assignLaborHours prefers audited production labor");
assert(assigned.note.includes("Verified production labor"), assigned.note);

const baseline = assignLaborHours({ category: "Lighting", symbol: "2x4 troffer", unit: "EA" });
assert(baseline.mhPerUnit === 1.1, "unmatched items still use the baseline library");

if (!process.exitCode) console.log("audited labor library checks passed");
