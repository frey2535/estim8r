import { AUDITED_LABOR_ITEMS } from "../labor/auditedLibrary.js";
import {
  categoriesForType,
  laborItemMatchesLine,
  laborItemsForLine,
  lineTypesForLibraryItem,
  LINE_TYPES,
  TYPE_FOR_LIBRARY_CATEGORY,
  unmappedLibraryCategories,
  unreachableCatalogRows,
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

const unreachable = unreachableCatalogRows(active);
assert(
  unreachable.length === 0,
  `every uploaded row must appear for each of its Types and work categories, first misses: ${unreachable.slice(0, 8).map((row) => `${row.id} ${row.reason} ${row.itemType || ""} ${row.workCategory || row.category || ""}`).join("; ")}`,
);
assert(active.length === 1921, `expected the full uploaded manual, got ${active.length}`);

const equipment = laborItemsForLine(active, { itemType: "Equipment" });
const equipmentManual = active.filter((row) => lineTypesForLibraryItem(row).includes("Equipment"));
assert(equipment.length === equipmentManual.length && equipment.length > 0, `Type Equipment lists all equipment labor, got ${equipment.length} vs ${equipmentManual.length}`);
assert(equipment.filter((row) => row.category === "Distribution").length === 117, `Type Equipment includes all Distribution rows, got ${equipment.filter((row) => row.category === "Distribution").length}`);
assert(equipment.some((row) => row.id === "EL-01842"), "Type Equipment includes 10 kW generator");
assert(equipment.some((row) => row.category === "Equipment Connections"), "Type Equipment includes Equipment Connections");
assert(equipment.some((row) => row.category === "Motors"), "Type Equipment includes Motors");
assert(equipment.some((row) => row.category === "EV Charging"), "Type Equipment includes EV Charging");
assert(equipment.some((row) => row.id === "EL-01617"), "Type Equipment includes 100 A Install ATS");

const equipmentCats = categoriesForType("Equipment", active);
assert(equipmentCats.includes("Equipment installation"), "work categories include Equipment installation");
assert(equipmentCats.includes("Equipment terminations"), "work categories include Equipment terminations");
assert(equipmentCats.includes("Equipment Connections"), "work categories include Equipment Connections");
assert(equipmentCats.includes("Generators"), "work categories include Generators");
assert(equipmentCats.includes("Motor Connections"), "work categories include Motor Connections");
assert(equipmentCats.includes("Emergency Power"), "work categories include Emergency Power");
assert(equipmentCats.includes("Transfer switches"), "work categories include Transfer switches");
assert(equipmentCats.includes("ATS"), "work categories include the manual ATS subcategory");

const installs = laborItemsForLine(active, { itemType: "Equipment", category: "Equipment installation" });
assert(installs.length > 0 && installs.every((row) => lineTypesForLibraryItem(row).includes("Equipment")), "Equipment installation is equipment rows only");
assert(installs.some((row) => row.id === "EL-01842"), "Equipment installation includes set/connect generator");
assert(installs.some((row) => row.category === "Equipment Connections"), "Equipment installation includes Equipment Connections");

const terminations = laborItemsForLine(active, { itemType: "Equipment", category: "Equipment terminations" });
assert(terminations.length > 0 && terminations.every((row) => /terminat/i.test(`${row.subcategory} ${row.item_name}`)), "Equipment terminations are termination rows");

const generators = laborItemsForLine(active, { itemType: "Equipment", category: "Generators" });
assert(generators.length === 8 && generators.every((row) => row.subcategory === "Generators"), `Generators subcategory is the 8 generator rows, got ${generators.length}`);

const atsIds = ["EL-01617", "EL-01622", "EL-01627", "EL-01632", "EL-01637", "EL-01642", "EL-01647", "EL-01652", "EL-01657", "EL-01662"];
const atsSizes = ["100 A", "200 A", "400 A", "600 A", "800 A", "1200 A", "1600 A", "2000 A", "3000 A", "4000 A"];
const transfer = laborItemsForLine(active, { itemType: "Equipment", category: "Transfer switches" });
assert(transfer.length === 10 && transfer.every((row) => row.item_name === "Install ATS" && row.subcategory === "ATS"), `Transfer switches is the 10 Install ATS rows, got ${transfer.length}`);
assert(atsIds.every((id) => transfer.some((row) => row.id === id)), "Transfer switches lists every ATS id");
assert(atsSizes.every((size) => transfer.some((row) => row.size === size)), "Transfer switches lists every ATS ampacity");
assert(laborItemsForLine(active, { itemType: "Equipment", category: "ATS" }).length === 10, "manual ATS subcategory also lists the 10 rows");
assert(laborItemsForLine(active, { itemType: "Equipment", category: "Equipment installation" }).some((row) => row.id === "EL-01617"), "Equipment installation includes Install ATS");
assert(laborItemsForLine(active, { itemType: "Equipment", category: "Emergency Power" }).some((row) => row.id === "EL-01617"), "Emergency Power work category includes Install ATS");
assert(laborItemsForLine(active, { itemType: "Gear", category: "Transfer switches" }).some((row) => row.id === "EL-01662"), "Gear still reaches 4000 A ATS");
assert(filterLaborLibrary(active, "400 A", { itemType: "Equipment", category: "Transfer switches" }).some((row) => row.id === "EL-01627"), "typeahead finds 400 A Install ATS");

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

assert(LINE_TYPES.includes("Subcontract"), "Subcontract is a line type");
assert(
  !active.some((row) => /subcontract/i.test(`${row.category} ${row.subcategory} ${row.item_name}`)),
  "workbook has no subcontract catalog rows — do not invent them",
);
const subcontract = laborItemsForLine(active, { itemType: "Subcontract" });
assert(subcontract.length > 0, "Type Subcontract is not an empty picker");
assert(
  subcontract.every((row) => lineTypesForLibraryItem(row).includes("Subcontract")),
  "Subcontract lists only subcontractible rows",
);
assert(subcontract.some((row) => row.id === "EL-00007"), "Subcontract includes mini excavator trenching");
assert(subcontract.some((row) => row.id === "EL-00031"), "Subcontract includes concrete encasement");
assert(subcontract.some((row) => row.id === "EL-00034"), "Subcontract includes patch concrete");
assert(subcontract.some((row) => row.id === "EL-00036"), "Subcontract includes excavate equipment pad");
assert(subcontract.some((row) => row.id === "EL-01828"), "Subcontract includes excavate pole base");
assert(subcontract.filter((row) => row.category === "Site/Earthwork").length === 38, `Subcontract includes all Site/Earthwork rows, got ${subcontract.filter((row) => row.category === "Site/Earthwork").length}`);
const subcontractCats = categoriesForType("Subcontract", active);
assert(subcontractCats.includes("Excavation"), "Subcontract work categories include Excavation");
assert(subcontractCats.includes("Concrete"), "Subcontract work categories include Concrete");
assert(subcontractCats.includes("Site/Earthwork"), "Subcontract work categories include Site/Earthwork");
assert(subcontractCats.includes("Trenching"), "Subcontract work categories include Trenching");
assert(subcontractCats.includes("Civil Support"), "Subcontract work categories include Civil Support");
assert(!subcontractCats.some((label) => /rental/i.test(label)), "do not invent a Rentals category");
const excavation = laborItemsForLine(active, { itemType: "Subcontract", category: "Excavation" });
assert(excavation.length > 0 && excavation.every((row) => /excav|trench/i.test(`${row.subcategory} ${row.item_name}`)), "Excavation is existing trench/excavate rows");
const concrete = laborItemsForLine(active, { itemType: "Subcontract", category: "Concrete" });
assert(concrete.length > 0 && concrete.every((row) => /concrete/i.test(`${row.item_name}`)), "Concrete is existing concrete rows");
assert(filterLaborLibrary(active, "excavat", { itemType: "Subcontract" }).some((row) => row.id === "EL-00036"), "Subcontract typeahead finds excavate equipment pad");
assert(laborItemsForLine(active, { itemType: "Labor", category: "Site/Earthwork" }).length === 38, "Site/Earthwork stays reachable under Labor");

if (!process.exitCode) console.log("line labor catalog checks passed");
