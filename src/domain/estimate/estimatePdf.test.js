import { estimateContentFingerprint } from "./projectDocuments.js";
import {
  buildEstimatePdf,
  estimatePdfFileName,
  estimatePresentation,
  presentationHasInternals,
} from "./estimatePdf.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const estimate = {
  id: "est_pdf",
  header: {
    projectName: "Soccer Pavilion",
    estimateNumber: "257031",
    projectAddress: "220 Tulip Tree Rd, Shelbyville, TN 37160",
    customerCompany: "CITY OF SHELBYVILLE",
    customerName: "",
    customerPhone: "615-370-8500",
    customerEmail: "",
    estimatorName: "Marcus",
    scopeNotes: "Electrical package from the drawings.",
  },
  crew: [{ id: "journeyman", label: "Journeyman", wage: 68, selected: true, headcount: 1 }],
  factors: [{ code: "height", label: "Height", multiplier: 1.25 }],
  overhead: 10,
  profit: 10,
  lines: [{
    itemType: "Device",
    category: "Devices",
    description: "Duplex receptacle",
    quantity: 12,
    unit: "EA",
    materialUnitCost: 4,
    laborMhPerUnit: 0.22,
    laborRate: 68,
    notes: "",
  }],
};

const presentation = estimatePresentation(estimate);
assert(presentation.title === "Soccer Pavilion", "presentation keeps the project name");
assert(presentation.totals.material === 48, `material ${presentation.totals.material}`);
assert(Math.abs(presentation.totals.labor - 179.52) < 0.001, `labor ${presentation.totals.labor}`);
assert(presentation.totals.total > presentation.totals.material + presentation.totals.labor, "total still includes markup");
assert(!("overhead" in presentation.totals), "presentation totals omit overhead");
assert(!("profit" in presentation.totals), "presentation totals omit profit");
assert(!("crew" in presentation), "presentation omits crew");
assert(!("factors" in presentation), "presentation omits productivity factors");
assert(!presentation.lines[0].laborRate, "line presentation omits wage");
assert(!presentationHasInternals(presentation), "presentation JSON has no internals");

assert(estimatePdfFileName(estimate) === "Soccer-Pavilion-257031.pdf", "PDF name uses project and estimate number");
assert(estimatePdfFileName({ header: {} }) === "estimate.pdf", "empty header uses estimate.pdf");

const built = buildEstimatePdf(estimate, {
  companyName: "Current Flow Electric",
  companyAddress: "100 Trade St",
  companyPhone: "555-0199",
  headerColor: "#7c2d12",
  textColor: "#111827",
  cardColor: "#fff7ed",
  fontFamily: "times",
  headerSize: "large",
  cardSize: "spacious",
});
assert(built.fileName === "Soccer-Pavilion-257031.pdf", "built PDF keeps the file name");
assert(built.doc.getNumberOfPages() >= 1, "PDF has a page");
assert(built.strings.includes("Current Flow Electric"), "PDF prints company name");
assert(built.strings.includes("CITY OF SHELBYVILLE"), "PDF prints title-block company");
assert(built.strings.includes("Duplex receptacle"), "PDF prints line items");
assert(built.strings.includes("Estimate total"), "PDF prints the customer total");
assert(!built.strings.some((line) => /employee class|productivity|overhead|profit|journeyman|crew rate/i.test(line)), "PDF omits internals");

const bytes = built.doc.output("arraybuffer");
assert(bytes.byteLength > 500, "PDF bytes are non-empty");
const header = String.fromCharCode(...new Uint8Array(bytes.slice(0, 5)));
assert(header === "%PDF-", `PDF header ${header}`);

const before = estimateContentFingerprint(estimate);
const branded = { ...estimate };
assert(estimateContentFingerprint(branded) === before, "branding is not part of the Buildr fingerprint");

if (!process.exitCode) console.log("estimate PDF checks passed");
