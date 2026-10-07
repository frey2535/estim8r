import { AUDITED_LABOR_ITEMS } from "../labor/auditedLibrary.js";
import {
  categoriesForType,
  laborItemMatchesLine,
  laborItemsForLine,
  lineTypeForLibraryItem,
  LINE_TYPES,
  TYPE_FOR_LIBRARY_CATEGORY,
  unmappedLibraryCategories,
} from "./lineLaborCatalog.js";
import { filterLaborLibrary } from "./manualLineLabor.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const active = AUDITED_LABOR_ITEMS.filter((row) => row.active !== false);

assert(LINE_TYPES.includes("Equipment") && LINE_TYPES.includes("Conduit"), "core types exist");
assert(unmappedLibraryCategories(active).length === 0, `every manual category has a Type: ${unmappedLibraryCategories(active).join(", ")}`);

const mappedCategories = new Set(active.map((row) => row.category));
for (const category of mappedCategories) {
  assert(TYPE_FOR_LIBRARY_CATEGORY[category], `Type map covers ${category}`);
}

const reachable = new Set();
for (const type of LINE_TYPES) {
  for (const item of laborItemsForLine(active, { itemType: type })) reachable.add(item.id);
}
const missing = active.filter((row) => !reachable.has(row.id));
assert(missing.length === 0, `every uploaded row is selectable by Type, missing ${missing.slice(0, 8).map((row) => `${row.id} ${row.category}`).join("; ")}`);

const equipment = laborItemsForLine(active, { itemType: "Equipment" });
const equipmentManual = active.filter((row) => lineTypeForLibraryItem(row) === "Equipment");
assert(equipment.length === equipmentManual.length && equipment.length > 0, `Type Equipment lists all equipment labor, got ${equipment.length} vs ${equipmentManual.length}`);
assert(equipment.some((row) => row.id === "EL-01842"), "Type Equipment includes 10 kW generator");
assert(equipment.some((row) => row.category === "Equipment Connections"), "Type Equipment includes Equipment Connections");
assert(equipment.some((row) => row.category === "Motors"), "Type Equipment includes Motors");
assert(equipment.some((row) => row.category === "EV Charging"), "Type Equipment includes EV Charging");

const equipmentCats = categoriesForType("Equipment", active);
assert(equipmentCats.includes("Equipment installation"), "work categories include Equipment installation");
assert(equipmentCats.includes("Equipment terminations"), "work categories include Equipment terminations");
assert(equipmentCats.includes("Equipment Connections"), "work categories include Equipment Connections");
assert(equipmentCats.includes("Generators"), "work categories include Generators");
assert(equipmentCats.includes("Motor Connections"), "work categories include Motor Connections");
assert(equipmentCats.includes("Emergency Power"), "work categories include Emergency Power");

const installs = laborItemsForLine(active, { itemType: "Equipment", category: "Equipment installation" });
assert(installs.length > 0 && installs.every((row) => lineTypeForLibraryItem(row) === "Equipment"), "Equipment installation is equipment rows only");
assert(installs.some((row) => row.id === "EL-01842"), "Equipment installation includes set/connect generator");
assert(installs.some((row) => row.category === "Equipment Connections"), "Equipment installation includes Equipment Connections");

const terminations = laborItemsForLine(active, { itemType: "Equipment", category: "Equipment terminations" });
assert(terminations.length > 0 && terminations.every((row) => /terminat/i.test(`${row.subcategory} ${row.item_name}`)), "Equipment terminations are termination rows");

const generators = laborItemsForLine(active, { itemType: "Equipment", category: "Generators" });
assert(generators.length === 8 && generators.every((row) => row.subcategory === "Generators"), `Generators subcategory is the 8 generator rows, got ${generators.length}`);

const conduitInstall = laborItemsForLine(active, { itemType: "Conduit", category: "Conduit Installation" });
assert(conduitInstall.length > 0 && conduitInstall.every((row) => row.subcategory === "Conduit Installation"), "Conduit Installation is the manual work category");
assert(conduitInstall.some((row) => row.id === "EL-00039"), "1/2 EMT install is under Conduit Installation");
assert(conduitInstall.some((row) => /PVC Sch/i.test(row.material_type)), "Conduit Installation includes PVC, not only EMT");

const emtLegacy = laborItemsForLine(active, { itemType: "Conduit", category: "EMT conduit" });
assert(emtLegacy.some((row) => row.id === "EL-00039"), "saved EMT conduit lines still match");
assert(emtLegacy.every((row) => row.material_type === "EMT" && row.subcategory === "Conduit Installation"), "EMT conduit alias stays EMT install only");

assert(filterLaborLibrary(active, "emt").length === 0, "unscoped typeahead is empty");
assert(filterLaborLibrary(active, "1/2", { itemType: "Conduit", category: "EMT conduit" }).some((row) => row.id === "EL-00039"), "legacy typeahead still finds 1/2 EMT");
assert(filterLaborLibrary(active, "generator", { itemType: "Equipment" }).some((row) => row.id === "EL-01842"), "Type Equipment typeahead finds generator without a category");
assert(filterLaborLibrary(active, "", { itemType: "Equipment" }).length === equipment.length, "empty Equipment search lists every equipment row");
assert(!laborItemMatchesLine(active.find((row) => row.id === "EL-01372"), { itemType: "Conduit", category: "Conduit Installation" }), "THHN does not match Conduit");

const none = laborItemsForLine(active, { itemType: "", category: "" });
assert(none.length === 0, "no type does not dump the full library");

if (!process.exitCode) console.log("line labor catalog checks passed");
