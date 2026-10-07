import { ACTIVE_ESTIMATE_KEY, estimateStorageKey, WAGE_BOOK_KEY } from "./fromTakeoff.js";
import { openEstimateSession, persistShopWageBook, readActiveEstimate, readShopWageBook, startNewEstimate, writeEstimate } from "./estimateStore.js";
import { defaultCrew } from "../labor/employeeClasses.js";
import { LABOR_RATES_KEY, LEGACY_DEFAULT_WAGES } from "../labor/rates.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: (key) => { store.delete(key); },
};

const saved = writeEstimate({
  fileName: "soccer.pdf",
  fileSize: 99,
  header: { projectName: "Soccer Pavilion", projectAddress: "220 Tulip Tree Rd" },
  lines: [{ id: "1", description: "Duplex receptacle", quantity: 12 }],
  overhead: 10,
  profit: 10,
});
assert(readActiveEstimate()?.header?.projectName === "Soccer Pavilion", "writeEstimate becomes the active estimate");
assert(localStorage.getItem(ACTIVE_ESTIMATE_KEY) === estimateStorageKey("soccer.pdf", 99), "active key points at the last estimate");

assert(openEstimateSession({}) === null, "New Estimate does not return the last job");
assert(readActiveEstimate() === null, "New Estimate clears the active pointer");
assert(store.get(estimateStorageKey("soccer.pdf", 99)), "the saved estimate file is not deleted");

const reopened = openEstimateSession({ fileName: "soccer.pdf", fileSize: 99 });
assert(reopened?.id === saved.id, "opening a saved estimate loads that file");
assert(reopened.header.projectName === "Soccer Pavilion", "opened estimate keeps its header");
assert(readActiveEstimate()?.header?.projectName === "Soccer Pavilion", "opening a saved estimate makes it active");

startNewEstimate();
assert(readActiveEstimate() === null, "startNewEstimate leaves no active estimate");
assert(openEstimateSession({ fileName: "missing.pdf", fileSize: 1 }) === null, "a missing file opens a blank template");

const standalone = writeEstimate({
  fileName: "standalone:main hospital",
  fileSize: 0,
  header: { projectName: "Main Hospital" },
  lines: [{ id: "2", description: "Panel", quantity: 1, materialUnitCost: 400, laborMhPerUnit: 2, laborRate: 68 }],
  overhead: 10,
  profit: 10,
});
assert(standalone.header.projectName === "Main Hospital", "standalone estimate writes without a drawing");
assert(openEstimateSession({ fileName: "standalone:main hospital", fileSize: 0 })?.id === standalone.id, "standalone estimates reopen from the Estimates folder");

const synced = writeEstimate({
  fileName: "standalone:main hospital",
  fileSize: 0,
  header: { projectName: "Main Hospital" },
  lines: standalone.lines,
  buildrSync: { estimateId: standalone.id, projectId: "proj_1", invoiceId: "inv_1", documents: {} },
});
const laterEdit = writeEstimate({
  fileName: "standalone:main hospital",
  fileSize: 0,
  header: { projectName: "Main Hospital" },
  lines: [{ ...standalone.lines[0], quantity: 2 }],
});
assert(laterEdit.id === synced.id, "later standalone edits keep the same estimate id");
assert(laterEdit.buildrSync?.invoiceId === "inv_1", "later edits keep the Buildr invoice id so Save can update");

const markedSave = writeEstimate({
  fileName: "standalone:markup job",
  fileSize: 0,
  header: { projectName: "Markup Job" },
  lines: [{ id: "3", description: "Wire", quantity: 10, materialUnitCost: 2 }],
  materialMarkup: 15,
  overhead: 10,
  profit: 10,
});
assert(markedSave.materialMarkup === 15, "writeEstimate stores material markup on the estimate JSON");
assert(openEstimateSession({ fileName: "standalone:markup job", fileSize: 0 })?.materialMarkup === 15, "reopened estimate keeps material markup");

const emptyShop = readShopWageBook();
assert(Object.values(emptyShop).every((wage) => wage === 95), "empty storage uses the $95 shop book");

localStorage.setItem(WAGE_BOOK_KEY, JSON.stringify(LEGACY_DEFAULT_WAGES));
localStorage.setItem(LABOR_RATES_KEY, JSON.stringify(Object.entries(LEGACY_DEFAULT_WAGES).map(([classId, hourlyRate]) => ({ classId, hourlyRate }))));
assert(readShopWageBook().journeyman === 95, "legacy $68-style storage is replaced with $95");

const customCrew = defaultCrew().map((row) => ({ ...row, wage: row.id === "journeyman" ? 110 : 95 }));
persistShopWageBook(customCrew);
assert(readShopWageBook().journeyman === 110, "a saved journeyman rate persists");
assert(readShopWageBook().helper === 95, "other classes stay at $95 after a custom save");

writeEstimate({
  fileName: "standalone:rate wipe",
  fileSize: 0,
  header: { projectName: "Rate Wipe" },
  crew: defaultCrew({ journeyman: 40 }),
  lines: [{ id: "4", description: "Wire", quantity: 1 }],
});
assert(readShopWageBook().journeyman === 110, "saving an estimate does not overwrite the shop wage book");
assert(openEstimateSession({}) === null, "New Estimate still opens a blank template");
assert(readShopWageBook().journeyman === 110, "New Estimate keeps the last saved shop rates");

if (!process.exitCode) console.log("estimate store checks passed");
