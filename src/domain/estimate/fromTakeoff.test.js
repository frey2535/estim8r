import { linesFromRollup, mergeEstimate, syncEstimateDraft } from "./fromTakeoff.js";
import { buildTrueElectricalEstimateDraft } from "./trueElectricalTakeoff.js";
import { parseTitleBlock } from "./fromDrawings.js";
import { compositeWage, defaultCrew, journeymanWage } from "../labor/employeeClasses.js";
import { assignLaborHours } from "../labor/libraryDocument.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const crew = defaultCrew();
assert(crew.filter((row) => row.selected).length === 1, "only journeyman selected by default");
assert(crew.find((row) => row.selected).id === "journeyman", "default class is journeyman");
assert(crew.every((row) => row.wage === 95), "every class starts at the $95 shop rate");
assert(compositeWage(crew).rate === 95, "default crew rate is $95");
assert(compositeWage(crew).rate === journeymanWage(crew), "default rate is journeyman wage");

const both = crew.map((row) => (
  row.id === "foreman" || row.id === "journeyman"
    ? { ...row, selected: true, headcount: 1, wage: row.id === "foreman" ? 85 : 68 }
    : { ...row, selected: false, headcount: 0 }
));
const blended = compositeWage(both);
assert(blended.count === 2, "two classes can be selected");
assert(blended.rate === (85 + 68) / 2, `blend ${blended.rate}`);

const rollup = {
  rows: [
    { category: "Receptacles", symbol: "Duplex receptacle", count: 12, lf: 0, sf: 0, hasLength: false, hasArea: false },
    { category: "Raceway", symbol: 'EMT 3/4"', count: 0, lf: 200, sf: 0, hasLength: true, hasArea: false },
  ],
};
const lines = linesFromRollup(rollup, 68);
assert(lines.length === 2, "one line per takeoff quantity");
assert(lines[0].quantity === 12 && lines[0].unit === "EA", "receptacle quantity");
assert(lines[0].laborItemId === "EL-01500" && lines[0].laborMhPerUnit === 0.22, `duplex mh ${lines[0].laborMhPerUnit}`);
assert(lines[0].laborRate === 68, "journeyman rate on the line");
assert(lines[1].unit === "LF" && lines[1].quantity === 200, "conduit lf");
assert(Math.abs(lines[1].laborMhPerUnit - 0.05) < 0.0001, `emt mh/lf ${lines[1].laborMhPerUnit}`);
assert(lines[1].laborItemId === "EL-00050", "audited 3/4 EMT labor item");
assert(lines[1].laborSource.includes("experimental"), `experimental source ${lines[1].laborSource}`);
assert(lines[1].laborSelection?.selectedSource === "experimental", "new lines carry an experimental selection");
assert(lines[1].laborSelection?.verificationStatus === "unverified", "new lines are unverified");
const laborCost = lines.reduce((sum, line) => sum + line.quantity * line.laborMhPerUnit * line.laborRate, 0);
assert(Math.abs(laborCost - (12 * 0.22 * 68 + 200 * 0.05 * 68)) < 0.01, `estimate labor from installed qty ${laborCost}`);

const prior = { ...lines[0], quantity: 99, quantityEdited: true, laborMhPerUnit: 9.99, laborMhEdited: true, laborSelection: undefined, notes: "kept" };
const edited = mergeEstimate({ lines: [prior] }, lines);
assert(edited[0].quantity === 99, "edited estimate quantity is kept");
assert(edited[0].laborMhPerUnit === 9.99, "existing estimate man-hours are not overwritten");
assert(edited[0].laborSelection === undefined, "legacy estimate lines keep their stored labor basis");
assert(edited[1].quantity === 200, "new takeoff line is added");

const reorderedExisting = { lines: [lines[1], { ...lines[0], quantity: 99, quantityEdited: true }] };
const keptOrder = mergeEstimate(reorderedExisting, lines);
assert(keptOrder[0].id === lines[1].id && keptOrder[1].id === lines[0].id, "takeoff sync keeps the estimator's line order");

const draft = syncEstimateDraft(null, {
  fileName: "level-1.pdf",
  fileSize: 10,
  drawingDocs: { symbols: [{ id: "legend:r", label: "Duplex receptacle", abbr: "R", category: "Receptacles" }], scheduleItems: [], pages: [], notes: [] },
  rollup,
  pageCount: 4,
});
assert(draft.liveLinkedTakeoff === true, "estimate stays live-linked to overlay takeoff");
assert(draft.header.projectName === "level-1", "project name from drawing");
assert(draft.lines.every((line) => line.source === "takeoff"), "takeoff quantities win over blank legend lines");
assert(assignLaborHours({ category: "Lighting", symbol: "2x4 troffer", unit: "EA" }).mhPerUnit === 0.75, "workbook troffer match");

const soccerBlock = parseTitleBlock(`
Shelbyville
Multipurpose
Soccer Field
Complex Pavilion
220 Tulip Tree Rd,
Shelbyville, TN 37160
CITY OF SHELBYVILLE
201 N Spring Street,
Shelbyville, TN 37160
WOLD ARCHITECTS
AND ENGINEERS
woldae.com | 615 370 8500
Comm: 257031
Drawn: YJR
`);
const soccer = syncEstimateDraft(null, {
  fileName: "257031-Soccer Pavilion-DRAWINGS.pdf",
  fileSize: 14039938,
  drawingDocs: { titleBlock: soccerBlock, symbols: [], scheduleItems: [], pages: [], notes: [] },
  rollup,
  pageCount: 52,
});
assert(soccer.header.customerCompany === "CITY OF SHELBYVILLE", "estimate company from title block");
assert(soccer.header.projectAddress === "220 Tulip Tree Rd, Shelbyville, TN 37160", "estimate address from title block");
assert(soccer.header.customerPhone === "615-370-8500", "estimate phone from title block");
assert(soccer.header.customerEmail === "", "no email on the drawings");
assert(soccer.header.customerName === "", "no contact name on the drawings");
assert(soccer.header.estimateNumber === "257031", "commission number from title block");
assert(soccer.liveLinkedTakeoff === true, "soccer estimate stays live-linked to overlay takeoff");

const editedHeader = syncEstimateDraft({
  ...soccer,
  header: { ...soccer.header, customerCompany: "Typed Contractor" },
}, {
  fileName: "257031-Soccer Pavilion-DRAWINGS.pdf",
  drawingDocs: { titleBlock: soccerBlock, symbols: [], scheduleItems: [], pages: [], notes: [] },
  rollup,
  pageCount: 52,
});
assert(editedHeader.header.customerCompany === "Typed Contractor", "typed company is not overwritten");
assert(editedHeader.lines.length === soccer.lines.length, "header fill does not change takeoff lines");

const overlayOnly = syncEstimateDraft({
  lines: [
    { takeoffKey: "harvest|generator", source: "takeoff", category: "Panels / MCC", description: "Generator", quantity: 147, unit: "EA" },
    { takeoffKey: "harvest|emt", source: "takeoff", category: "Raceway", description: '3/4" EMT', quantity: 4350.7, unit: "LF" },
  ],
}, {
  fileName: "pottsville.pdf",
  drawingDocs: {
    pages: [
      { page: 3, kind: "spec", text: "GENERATOR PANELBOARD EF-1 3/4\" EMT EXHAUST FAN COMCHECK" },
      { page: 48, kind: "legend", text: "AFF AHJ ABBREVIATIONS ELECTRICAL LEGEND" },
    ],
    symbols: [{ id: "legend:g", label: "Generator", abbr: "G", category: "Panels / MCC" }],
    scheduleItems: [{ id: "sched:emt", label: '3/4" EMT', abbr: "EMT", category: "Raceway", scheduleQty: 4350 }],
  },
  rollup: { rows: [{ category: "Receptacles", symbol: "Duplex receptacle", count: 1, lf: 0, sf: 0, hasLength: false, hasArea: false }], totals: { count: 1, lf: 0, sf: 0 } },
  marks: [{ id: "r1", type: "count", sheet: 50, category: "Receptacles", symbol: "duplex", symbolLabel: "Duplex receptacle" }],
  pageKinds: { 3: "spec", 48: "legend", 50: "drawing" },
  pageCount: 76,
});
assert(overlayOnly.lines.length === 1, `estimate follows overlay marks, got ${overlayOnly.lines.length}`);
assert(overlayOnly.lines[0].quantity === 1, "one overlay receptacle is one estimate quantity");
assert(!overlayOnly.lines.some((line) => /generator|emt|exhaust/i.test(line.description)), "spec sentences are not bid lines");

const trueDraft = buildTrueElectricalEstimateDraft(overlayOnly, {
  fileName: "pottsville.pdf",
  drawingDocs: overlayOnly && {
    pages: [{ page: 3, kind: "spec", text: "PROVIDE GENERATOR AND 246 PANELBOARDS. EF-1 EF-2 3/4\" EMT." }],
  },
  rollup: { rows: [{ category: "Receptacles", symbol: "Duplex receptacle", count: 1, lf: 0, sf: 0, hasLength: false, hasArea: false }], totals: { count: 1, lf: 0 } },
  marks: [{ id: "r1", type: "count", sheet: 50, category: "Receptacles", symbol: "duplex", symbolLabel: "Duplex receptacle" }],
  pageKinds: { 50: "drawing" },
  runs: [],
});
assert(!trueDraft.lines.some((line) => /generator|panelboard|exhaust|emt/i.test(String(line.description))), "true takeoff does not invent gear/EMT from spec text");
assert(trueDraft.lines.filter((line) => line.category === "Receptacles").every((line) => line.quantity === 1), "true takeoff quantity stays the overlay count");

if (!process.exitCode) console.log("estimate labor checks passed");
