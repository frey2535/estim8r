import { ACTIVE_ESTIMATE_KEY, estimateStorageKey } from "./fromTakeoff.js";
import { openEstimateSession, readActiveEstimate, startNewEstimate, writeEstimate } from "./estimateStore.js";

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

if (!process.exitCode) console.log("estimate store checks passed");
