import {
  buildMarkupPages,
  canSaveProjectDocuments,
  decideSaveDestination,
  estimateGrandTotal,
  matchProjectByName,
  projectFolderKey,
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

assert(canSaveProjectDocuments({ fileName: "plan.pdf", projectName: "Main Hospital" }) === true, "drawing plus project name can save");
assert(canSaveProjectDocuments({ fileName: "", projectName: "Main Hospital" }) === false, "no drawing cannot save");
assert(canSaveProjectDocuments({ fileName: "plan.pdf", projectName: "" }) === false, "no project name cannot save");

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

if (!process.exitCode) console.log("project document checks passed");
