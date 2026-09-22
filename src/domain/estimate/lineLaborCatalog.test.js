import { AUDITED_LABOR_ITEMS } from "../labor/auditedLibrary.js";
import {
  categoriesForType,
  laborItemMatchesLine,
  laborItemsForLine,
  LINE_TYPES,
} from "./lineLaborCatalog.js";
import { filterLaborLibrary } from "./manualLineLabor.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(LINE_TYPES.includes("Conduit") && LINE_TYPES.includes("Wire") && LINE_TYPES.includes("Fixture"), "core types exist");
assert(categoriesForType("Conduit").includes("EMT conduit"), "EMT conduit category");
assert(categoriesForType("Conduit").includes("PVC conduit"), "PVC conduit category");
assert(categoriesForType("Conduit").includes("GRC / RMC"), "GRC category");
assert(categoriesForType("Wire").includes("THHN") && categoriesForType("Wire").includes("XHHW") && categoriesForType("Wire").includes("MC"), "wire categories");
assert(categoriesForType("Fixture").includes("Lighting"), "lighting category");
assert(categoriesForType("Device").includes("Receptacles") && categoriesForType("Device").includes("Devices"), "device categories");

const emt = laborItemsForLine(AUDITED_LABOR_ITEMS, { itemType: "Conduit", category: "EMT conduit" });
assert(emt.length > 0 && emt.every((row) => row.material_type === "EMT" && row.subcategory === "Conduit Installation"), `EMT conduit is only EMT install, got ${emt.length}`);
assert(emt.some((row) => row.id === "EL-00039"), "1/2 EMT install is in the EMT conduit list");
assert(!emt.some((row) => /pvc|thhn|fixture|receptacle/i.test(`${row.material_type} ${row.item_name}`)), "EMT conduit list has no PVC, wire, or fixtures");
assert(!emt.some((row) => row.subcategory === "Fittings"), "EMT conduit list excludes fittings");

const pvc = laborItemsForLine(AUDITED_LABOR_ITEMS, { itemType: "Conduit", category: "PVC conduit" });
assert(pvc.some((row) => row.id === "EL-00576"), "3/4 PVC install is in PVC conduit");
assert(pvc.every((row) => /PVC Sch/i.test(row.material_type) && row.subcategory === "Conduit Installation"), "PVC conduit is only PVC install");

const grc = laborItemsForLine(AUDITED_LABOR_ITEMS, { itemType: "Conduit", category: "GRC / RMC" });
assert(grc.length > 0 && grc.every((row) => /RMC/i.test(row.material_type) && row.subcategory === "Conduit Installation"), "GRC / RMC is only rigid install");

const thhn = laborItemsForLine(AUDITED_LABOR_ITEMS, { itemType: "Wire", category: "THHN" });
assert(thhn.length > 0 && thhn.every((row) => /THHN/i.test(row.material_type)), "THHN list is only THHN");
assert(!thhn.some((row) => /XHHW|MC cable/i.test(row.material_type)), "THHN list excludes XHHW and MC");

const xhhw = laborItemsForLine(AUDITED_LABOR_ITEMS, { itemType: "Wire", category: "XHHW" });
assert(xhhw.length > 0 && xhhw.every((row) => /XHHW/i.test(row.material_type)), "XHHW list is only XHHW");

const mc = laborItemsForLine(AUDITED_LABOR_ITEMS, { itemType: "Wire", category: "MC" });
assert(mc.length > 0 && mc.every((row) => /MC cable/i.test(row.material_type)), "MC list is only MC cable");

const lights = laborItemsForLine(AUDITED_LABOR_ITEMS, { itemType: "Fixture", category: "Lighting" });
assert(lights.some((row) => row.id === "EL-01527"), "flood light is a lighting fixture");
assert(lights.every((row) => row.category === "Lighting" && !/contactor|control panel|sensor/i.test(row.item_name)), "Lighting is fixture-install rows only");
assert(!lights.some((row) => row.category === "Devices" || row.category === "Raceways"), "Lighting excludes devices and conduit");

const recs = laborItemsForLine(AUDITED_LABOR_ITEMS, { itemType: "Device", category: "Receptacles" });
assert(recs.length > 0 && recs.every((row) => /receptacle/i.test(row.item_name)), "Receptacles list is only receptacles");

const none = laborItemsForLine(AUDITED_LABOR_ITEMS, { itemType: "", category: "" });
assert(none.length === 0, "no type does not dump the full library");
assert(filterLaborLibrary(AUDITED_LABOR_ITEMS, "emt").length === 0, "unscoped typeahead is empty");
assert(filterLaborLibrary(AUDITED_LABOR_ITEMS, "1/2", { itemType: "Conduit", category: "EMT conduit" }).some((row) => row.id === "EL-00039"), "scoped typeahead still finds 1/2 EMT");
assert(!laborItemMatchesLine(AUDITED_LABOR_ITEMS.find((row) => row.id === "EL-01372"), { itemType: "Conduit", category: "EMT conduit" }), "THHN does not match EMT conduit");

if (!process.exitCode) console.log("line labor catalog checks passed");
