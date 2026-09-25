import {
  buildMarkupPages,
  buildrSyncFromResult,
  canSaveProjectDocuments,
  decideSaveDestination,
  estimateFileNameForSave,
  isDrawingFileName,
  saveRequiresProjectName,
  standaloneEstimateFileName,
  deleteProjectFolder,
  estimateContentFingerprint,
  estimateGrandTotal,
  findDocumentForEstim8r,
  findInvoiceForEstim8r,
  matchProjectByName,
  parseEstim8rEstimateId,
  projectFolderKey,
  upsertProjectFolder,
} from "./projectDocuments.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(projectFolderKey("  Main Hospital  ") === "main hospital", "project key is trimmed and lowercased");
assert(matchProjectByName([{ name: "Main Hospital" }], "main hospital")?.name === "Main Hospital", "match ignores case");
assert(matchProjectByName([{ name: "Other" }], "Main Hospital") === null, "unrelated project is not matched");

assert(decideSaveDestination({
  hasBuildrAccount: true,
  canUseBuildr: true,
  matchingProject: { id: "p1", name: "Main Hospital" },
}).action === "buildr", "existing Buildr project saves to Buildr");

assert(decideSaveDestination({
  hasBuildrAccount: true,
  canUseBuildr: true,
  matchingProject: null,
}).action === "prompt", "Buildr account without a project prompts to create one");

assert(decideSaveDestination({
  hasBuildrAccount: false,
  canUseBuildr: false,
  matchingProject: null,
}).action === "local", "no Buildr account saves in Estim8r");

assert(decideSaveDestination({
  hasBuildrAccount: true,
  canUseBuildr: false,
  matchingProject: null,
}).action === "local", "Buildr account without company access stays in Estim8r");

assert(decideSaveDestination({
  hasBuildrAccount: true,
  canUseBuildr: true,
  matchingProject: null,
  existingProjectId: "proj_1",
}).action === "buildr", "already synced estimate updates the stored Buildr project");
assert(decideSaveDestination({
  hasBuildrAccount: true,
  canUseBuildr: true,
  matchingProject: null,
  existingProjectId: "proj_1",
}).project.id === "proj_1", "stored Buildr project id is reused");

assert(decideSaveDestination({
  hasBuildrAccount: false,
  canUseBuildr: false,
  matchingProject: null,
  existingProjectId: "proj_1",
}).action === "buildr", "later edits reuse the stored Buildr project even if account lookup is empty");

assert(decideSaveDestination({
  hasBuildrAccount: true,
  canUseBuildr: true,
  matchingProject: { id: "p2", name: "Standalone Job" },
  linkedCompanyId: "co_1",
}).action === "buildr", "a linked company with a matching project saves to Buildr");

assert(decideSaveDestination({
  hasBuildrAccount: false,
  canUseBuildr: false,
  matchingProject: null,
  linkedCompanyId: "co_1",
}).action === "error", "a linked company without a Buildr account is an error, not a silent local save");

assert(decideSaveDestination({
  hasBuildrAccount: true,
  canUseBuildr: true,
  matchingProject: null,
  linkedCompanyId: "co_1",
  accountError: "Buildr is unavailable.",
}).action === "error", "a Buildr lookup failure is surfaced when a company is linked");

assert(decideSaveDestination({
  hasBuildrAccount: true,
  canUseBuildr: false,
  matchingProject: null,
  linkedCompanyId: "co_1",
}).action === "error", "a linked company the login cannot use is an error");

assert(canSaveProjectDocuments({ fileName: "plan.pdf", projectName: "Main Hospital" }) === true, "drawing plus project name can save");
assert(canSaveProjectDocuments({ fileName: "", projectName: "Main Hospital" }) === true, "a named estimate can save without a drawing");
assert(canSaveProjectDocuments({ projectName: "Main Hospital" }) === true, "project name alone is enough to save");
assert(canSaveProjectDocuments({ fileName: "plan.pdf", projectName: "" }) === false, "no project name cannot save");
assert(canSaveProjectDocuments({ fileName: "", projectName: "" }) === false, "blank standalone estimate cannot save yet");
assert(saveRequiresProjectName({ projectName: "" }) === "Enter a project name to save this estimate.", "missing name asks for a project name");
assert(saveRequiresProjectName({ projectName: "Main Hospital" }) === "", "named estimate has no name error");
assert(isDrawingFileName("plan.pdf") === true, "uploaded drawing is a drawing file");
assert(isDrawingFileName("standalone:main hospital") === false, "standalone storage key is not a drawing");
assert(isDrawingFileName("") === false, "empty file name is not a drawing");
assert(standaloneEstimateFileName("  Main Hospital  ") === "standalone:main hospital", "standalone file name keys by project");
assert(estimateFileNameForSave({ fileName: "plan.pdf", projectName: "Main Hospital" }) === "plan.pdf", "drawing estimates keep the drawing file name");
assert(estimateFileNameForSave({ fileName: "", projectName: "Main Hospital" }) === "standalone:main hospital", "standalone estimates key by project name");
assert(estimateFileNameForSave({ fileName: "", projectName: "" }) === "", "unnamed standalone estimate has no storage file");

const markup = buildMarkupPages({
  fileName: "plan.pdf",
  pageCount: 2,
  marks: [
    { id: "a", sheet: 1, tool: "count" },
    { id: "b", sheet: 2, tool: "markup" },
    { id: "c", sheet: 2, tool: "count" },
  ],
  calibration: { feet: 10 },
});
assert(markup.pages.length === 2, "one markup page per sheet");
assert(markup.pages[0].marks.length === 1, "page 1 marks");
assert(markup.pages[1].marks.length === 2, "page 2 marks");
assert(markup.titleBlock === undefined, "markup without a title block stays in the old shape");
assert(Array.isArray(markup.reviewPages), "saved markup also carries AI review pages");

const markedUp = buildMarkupPages({
  fileName: "plan.pdf",
  pageCount: 1,
  marks: [],
  titleBlock: { customerCompany: "CITY OF SHELBYVILLE", projectAddress: "220 Tulip Tree Rd, Shelbyville, TN 37160" },
});
assert(markedUp.titleBlock.customerCompany === "CITY OF SHELBYVILLE", "saved markup can carry extracted title-block fields");

const money = estimateGrandTotal({
  overhead: 10,
  profit: 10,
  lines: [{ quantity: 2, materialUnitCost: 50, laborMhPerUnit: 1, laborRate: 50 }],
});
assert(money.material === 100, `material ${money.material}`);
assert(money.labor === 100, `labor ${money.labor}`);
assert(Math.abs(money.total - 242) < 0.001, `grand ${money.total}`);

const itemizedMoney = estimateGrandTotal({
  itemized: true,
  overhead: 10,
  profit: 10,
  lines: [
    { quantity: 2, materialUnitCost: 50, laborMhPerUnit: 1, laborRate: 50, included: true },
    { quantity: 8, materialUnitCost: 50, laborMhPerUnit: 1, laborRate: 50, included: false },
  ],
});
assert(itemizedMoney.material === 100, `itemized material ${itemizedMoney.material}`);
assert(itemizedMoney.labor === 100, `itemized labor ${itemizedMoney.labor}`);

const memory = globalThis.localStorage;
if (!memory) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
}
upsertProjectFolder({ projectName: "Delete Me", projectAddress: "1 Main", fileName: "gone.pdf", fileSize: 12 });
assert(deleteProjectFolder({ id: "delete me" }).every((folder) => folder.projectName !== "Delete Me"), "folder delete removes the card");
const namedOnly = upsertProjectFolder({
  projectName: "Named Only",
  projectAddress: "2 Main",
  fileName: standaloneEstimateFileName("Named Only"),
  fileSize: 0,
});
assert(namedOnly.fileName === "standalone:named only", "Estimates folder can store a standalone estimate");
assert(namedOnly.projectName === "Named Only", "standalone folder keeps the project name");

assert(parseEstim8rEstimateId("Imported from Estim8r\nEstim8r-id: est_abc") === "est_abc", "parse stored estimate id");
assert(findInvoiceForEstim8r(
  [{ id: "inv_old", invoiceNumber: "E-1" }, { id: "inv_1", notes: "Estim8r-id: est_abc" }],
  { estimateId: "est_abc" },
)?.id === "inv_1", "invoice keyed by Estim8r estimate id");
assert(findInvoiceForEstim8r(
  [{ id: "inv_1", notes: "Estim8r-id: est_abc" }],
  { invoiceId: "inv_1", estimateId: "est_abc" },
)?.id === "inv_1", "invoice keyed by stored Buildr invoice id");
assert(findDocumentForEstim8r(
  [{ id: "d1", docType: "estim8r_estimate", number: "est_abc", title: "old.json" }],
  { docType: "estim8r_estimate", estimateId: "est_abc", title: "new.json" },
)?.id === "d1", "document keyed by estimate id, not title");

const firstPrint = estimateContentFingerprint({ id: "est_abc", header: { projectName: "A" }, lines: [{ quantity: 1 }] });
const editedPrint = estimateContentFingerprint({ id: "est_abc", header: { projectName: "A" }, lines: [{ quantity: 2 }] });
assert(firstPrint !== editedPrint, "line edits change the sync fingerprint");
assert(buildrSyncFromResult({
  project: { id: "proj_1" },
  invoice: { id: "inv_1" },
  documents: [{ id: "doc_e", doc_type: "estim8r_estimate" }],
}, "est_abc").projectId === "proj_1", "sync record keeps project id");

if (!process.exitCode) console.log("project document checks passed");
