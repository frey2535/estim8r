import { linesFromRollup, mergeEstimate, syncEstimateDraft } from "./fromTakeoff.js";
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
assert(compositeWage(crew).rate === journeymanWage(crew), "default rate is journeyman wage");

const both = crew.map((row) => (
  row.id === "foreman" || row.id === "journeyman"
    ? { ...row, selected: true, headcount: 1 }
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
assert(lines[0].laborMhPerUnit === 0.55, `duplex mh ${lines[0].laborMhPerUnit}`);
assert(lines[0].laborRate === 68, "journeyman rate on the line");
assert(lines[1].unit === "LF" && lines[1].quantity === 200, "conduit lf");
assert(Math.abs(lines[1].laborMhPerUnit - 0.072) < 0.0001, `emt mh/lf ${lines[1].laborMhPerUnit}`);

const edited = mergeEstimate({ lines: [{ ...lines[0], quantity: 99, quantityEdited: true }] }, lines);
assert(edited[0].quantity === 99, "edited estimate quantity is kept");
assert(edited[1].quantity === 200, "new takeoff line is added");

const draft = syncEstimateDraft(null, {
  fileName: "level-1.pdf",
  fileSize: 10,
  drawingDocs: { symbols: [{ id: "legend:r", label: "Duplex receptacle", abbr: "R", category: "Receptacles" }], scheduleItems: [], pages: [], notes: [] },
  rollup,
  pageCount: 4,
});
assert(draft.separateFromTakeoff === true, "estimate is marked separate from takeoff");
assert(draft.header.projectName === "level-1", "project name from drawing");
assert(draft.lines.every((line) => line.source === "takeoff"), "takeoff quantities win over blank legend lines");
assert(assignLaborHours({ category: "Lighting", symbol: "2x4 troffer", unit: "EA" }).mhPerUnit === 1.1, "library match");

if (!process.exitCode) console.log("estimate labor checks passed");
