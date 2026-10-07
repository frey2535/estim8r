import { estimateContentFingerprint } from "./projectDocuments.js";
import { includeTotalsCard, resolveVisibleTotals } from "./presentation.js";
import {
  buildEstimatePdf,
  createEstimatePdfPreview,
  DEFAULT_DOCUMENT_TITLE,
  estimateHasPdfLines,
  estimatePdfFileName,
  estimatePdfPreviewKey,
  estimatePresentation,
  normalizeDocumentTitle,
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
  itemized: true,
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

assert(DEFAULT_DOCUMENT_TITLE === "Electrical", "default document title is Electrical");
assert(normalizeDocumentTitle("Electrical Estimate") === "Electrical", "legacy Electrical Estimate becomes Electrical");
assert(normalizeDocumentTitle("Custom Bid") === "Custom Bid", "custom document titles stay");

const presentation = estimatePresentation(estimate);
assert(presentation.documentTitle === "Electrical", "PDF heading defaults to Electrical");
assert(presentation.title === "Soccer Pavilion", "presentation keeps the project name");
assert(presentation.totals.material === 48, `material ${presentation.totals.material}`);
assert(Math.abs(presentation.totals.labor - 179.52) < 0.001, `labor ${presentation.totals.labor}`);
assert(presentation.totals.total > presentation.totals.material + presentation.totals.labor, "total still includes markup");
const markedPresentation = estimatePresentation({ ...estimate, materialMarkup: 25 });
assert(markedPresentation.totals.material === 60, `PDF material includes material markup ${markedPresentation.totals.material}`);
assert(markedPresentation.grandTotal > presentation.grandTotal, "PDF grand total follows material markup");
assert(!("overhead" in presentation.totals), "presentation totals omit overhead");
assert(!("profit" in presentation.totals), "presentation totals omit profit");
assert(!("materialMarkup" in presentation.totals), "presentation totals omit material markup unless opted in");
assert(presentation.includeTotalsCard === false, "totals card stays off the customer estimate by default");
assert(presentation.totalsCard.length === 0, "default presentation has no totals card rows");
assert(includeTotalsCard({}) === false, "existing estimates do not include the totals card");
assert(resolveVisibleTotals({}).materialMarkup === false, "existing estimates hide the material markup line");
assert(resolveVisibleTotals({ visibleTotals: { material: true } }).materialMarkup === false, "saved totals without the key stay hidden");
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
assert(built.strings.includes("ELECTRICAL"), "PDF prints the Electrical heading in Buildr title case");
assert(!built.strings.includes("Electrical Estimate"), "PDF heading no longer says Electrical Estimate");
assert(!built.strings.includes("PROJECT ESTIMATE"), "PDF keeps Electrical instead of Buildr's default title");
assert(built.strings.includes("OFFICE"), "PDF prints the Buildr Office contact label");
assert(!built.strings.includes("ESTIMATOR"), "default header does not invent an Estimator column");
assert(built.strings.includes("Current Flow Electric"), "PDF prints company name");
assert(built.strings.includes("CITY OF SHELBYVILLE"), "PDF prints title-block company");
assert(built.strings.includes("Duplex receptacle"), "PDF prints line items");
assert(built.strings.includes("BILL TO"), "PDF uses Buildr Bill To card");
assert(built.strings.includes("PROJECT"), "PDF uses Buildr Project card");
assert(built.strings.includes("SCOPE OF WORK"), "PDF uses Buildr scope chrome");
assert(built.strings.includes("Description"), "PDF uses Buildr description column");
assert(built.strings.includes("Qty"), "PDF uses Buildr qty column");
assert(built.strings.includes("Unit Price"), "PDF uses Buildr unit price column");
assert(built.strings.includes("Total"), "PDF prints the line-item Total column");
assert(built.strings.includes("Subtotal"), "PDF prints Buildr subtotal");
assert(built.strings.includes("ESTIMATE TOTAL"), "PDF prints Buildr estimate total");
assert(built.strings.includes("Estimate Date"), "PDF prints Buildr date label");
assert(built.strings.includes("Valid Until"), "PDF prints Buildr valid-until label");
assert(built.strings.includes("Contractor Signature"), "PDF prints contractor signature");
assert(built.strings.includes("Customer Signature"), "PDF prints customer signature");
assert(!built.strings.includes("Material Total"), "customer PDF omits material total label");
assert(!built.strings.includes("Labor Total"), "customer PDF omits labor total label");
assert(!built.strings.some((line) => /employee class|productivity|overhead|profit|journeyman|crew rate/i.test(line)), "PDF omits internals");

const bytes = built.doc.output("arraybuffer");
assert(bytes.byteLength > 500, "PDF bytes are non-empty");
const header = String.fromCharCode(...new Uint8Array(bytes.slice(0, 5)));
assert(header === "%PDF-", `PDF header ${header}`);

const itemized = estimatePresentation({
  ...estimate,
  itemized: true,
  lines: [
    { ...estimate.lines[0], included: true },
    {
      itemType: "Device",
      category: "Devices",
      description: "Excluded receptacle",
      quantity: 4,
      unit: "EA",
      materialUnitCost: 10,
      laborMhPerUnit: 0.22,
      laborRate: 68,
      included: false,
    },
  ],
});
assert(itemized.lines.length === 1, "itemized PDF omits unchecked lines");
assert(itemized.lines[0].description === "Duplex receptacle", "itemized PDF keeps checked lines");
assert(itemized.totals.material === 48, "itemized material ignores unchecked lines");

const withOverhead = estimatePresentation({ ...estimate, visibleTotals: { overhead: true, profit: true } });
assert(withOverhead.totals.overhead > 0, "opt-in overhead total is present");
assert(withOverhead.totals.profit > 0, "opt-in profit total is present");
const withMarkupLine = estimatePresentation({ ...estimate, materialMarkup: 25, visibleTotals: { materialMarkup: true } });
assert(withMarkupLine.totals.materialMarkup === 12, `opt-in material markup line ${withMarkupLine.totals.materialMarkup}`);
assert(withMarkupLine.totals.material === 60, "opt-in material line still includes the marked-up material total");
const overheadPdf = buildEstimatePdf({ ...estimate, visibleTotals: { overhead: true } }, { companyName: "Current Flow Electric" });
assert(!overheadPdf.strings.includes("Overhead"), "customer PDF matches Buildr and omits overhead");
assert(!overheadPdf.strings.includes("Profit"), "customer PDF matches Buildr and omits profit");
const cardPdf = buildEstimatePdf({
  ...estimate,
  includeTotalsCard: true,
  visibleTotals: { material: true, labor: true, total: true },
}, { companyName: "Current Flow Electric" });
assert(cardPdf.strings.includes("Material Total"), "opt-in totals card prints Material Total on the customer PDF");
assert(cardPdf.strings.includes("Labor Total"), "opt-in totals card prints Labor Total on the customer PDF");
assert(cardPdf.strings.includes("ESTIMATE TOTAL"), "opt-in totals card still prints ESTIMATE TOTAL");
assert(!cardPdf.strings.includes("Subtotal"), "opt-in totals card replaces the Buildr-only subtotal row");
assert(estimatePresentation({ ...estimate, includeTotalsCard: true }).totalsCard.some((row) => row.key === "material"), "opt-in presentation carries totals card rows");
assert(
  estimateContentFingerprint({ ...estimate, includeTotalsCard: true })
    !== estimateContentFingerprint(estimate),
  "including the totals card changes the sync fingerprint",
);

const before = estimateContentFingerprint(estimate);
const branded = { ...estimate };
assert(estimateContentFingerprint(branded) === before, "branding is not part of the Buildr fingerprint");

assert(!estimateHasPdfLines({ header: {}, lines: [{ quantity: 1, description: "" }] }), "a blank starter line is not previewable");
assert(!estimateHasPdfLines({ itemized: true, lines: [{ ...estimate.lines[0], included: false }] }), "unchecked itemized lines are empty");
assert(estimateHasPdfLines(estimate), "a filled estimate has preview lines");

const emptyPreview = createEstimatePdfPreview({ header: { projectName: "Empty Job" }, lines: [{ quantity: 1 }] }, { companyName: "Current Flow Electric" });
assert(emptyPreview.status === "empty", "preview is empty before lines exist");
assert(!emptyPreview.blob, "empty preview does not invent a PDF blob");

const branding = {
  companyName: "Current Flow Electric",
  companyAddress: "100 Trade St",
  headerColor: "#7c2d12",
};
const preview = createEstimatePdfPreview(estimate, branding);
const rebuilt = buildEstimatePdf(estimate, branding);
assert(preview.status === "ready", "preview is ready when lines exist");
assert(preview.fileName === rebuilt.fileName, "preview uses the download file name");
assert(JSON.stringify(preview.strings) === JSON.stringify(rebuilt.strings), "preview is the same branded PDF as download");
assert(preview.blob instanceof Blob, "ready preview exposes the download blob");

const key = estimatePdfPreviewKey(estimate, branding);
assert(key !== estimatePdfPreviewKey({
  ...estimate,
  lines: [{ ...estimate.lines[0], quantity: 24 }],
}, branding), "preview key follows Estimate Line quantity");
assert(key !== estimatePdfPreviewKey({
  ...estimate,
  header: { ...estimate.header, projectName: "Other Pavilion" },
}, branding), "preview key follows the header");
assert(key !== estimatePdfPreviewKey({ ...estimate, overhead: 25, profit: 20 }, branding), "preview key follows markup");
assert(key !== estimatePdfPreviewKey({ ...estimate, materialMarkup: 25 }, branding), "preview key follows material markup");
assert(key !== estimatePdfPreviewKey({ ...estimate, includeTotalsCard: true }, branding), "preview key follows totals card opt-in");
assert(key !== estimatePdfPreviewKey(estimate, { ...branding, companyName: "Other Electric" }), "preview key follows branding");
assert(key !== estimatePdfPreviewKey(estimate, { ...branding, logoStretchX: 220, logoStretchY: 70 }), "preview key follows independent logo stretch");

const stretched = buildEstimatePdf(estimate, { ...branding, logoStretchX: 220, logoStretchY: 70, logoDataUrl: "" });
assert(stretched.strings.includes("ELECTRICAL"), "stretched logo PDF still prints Electrical");
assert(stretched.strings.includes("Current Flow Electric"), "missing logo still prints the company name in the header");

const customLayout = buildEstimatePdf({
  ...estimate,
  pdfDesign: {
    pageBorderEnabled: true,
    pageBorderColor: "#ff0000",
    pageBorderWidth: 2,
    pageBorderInset: 12,
    headerHeightPt: 72,
    headerPaddingPt: 4,
    headerFillColor: "#ff8800",
    headerBorderEnabled: true,
    headerBorderColor: "#222222",
    headerBorderWidth: 2,
    cardHeightPt: 44,
    cardPaddingPt: 6,
    cardRadiusPt: 2,
    cardBorderEnabled: true,
    cardBorderColor: "#0000ff",
    cardBorderWidth: 1.5,
    cardFillEnabled: true,
    cardFillColor: "#eeeeee",
    gapTitlePt: 2,
    gapCardsPt: 3,
    gapScopePt: 4,
    gapTablePt: 5,
    gapTotalsPt: 6,
    gapTermsPt: 7,
    signatureTopGapPt: 8,
  },
}, { ...branding, logoDataUrl: "" });
assert(customLayout.doc.getNumberOfPages() >= 1, "custom PDF layout still renders");
assert(customLayout.strings.includes("ELECTRICAL"), "custom PDF layout preserves title");

if (!process.exitCode) console.log("estimate PDF checks passed");
