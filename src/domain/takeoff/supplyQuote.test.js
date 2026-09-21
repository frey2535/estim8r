import {
  buildSupplyQuote,
  buildSupplyQuotePdf,
  modelFromKnownFields,
  supplyQuoteCsvFileName,
  supplyQuoteToCsv,
} from "./supplyQuote.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const marks = [
  { id: "1", type: "count", sheet: 2, symbol: "2x4", symbolLabel: "Type 1 2x4 troffer", abbr: "1", typeCode: "1", category: "Lighting" },
  { id: "2", type: "count", sheet: 2, symbol: "2x4", symbolLabel: "Type 1 2x4 troffer", abbr: "1", typeCode: "1", category: "Lighting" },
  { id: "3", type: "drop", sheet: 2, symbol: "duplex", symbolLabel: "Duplex receptacle", abbr: "R", category: "Receptacles" },
  { id: "4", type: "note", sheet: 2, symbolLabel: "Check panel" },
  { id: "5", type: "count", sheet: 8, source: "legend", symbol: "legend:r", symbolLabel: "Duplex from legend", abbr: "R" },
  { id: "6", type: "count", sheet: 9, symbol: "2x4", symbolLabel: "Schedule-only row", abbr: "1E" },
  { id: "7", type: "route", tool: "conduit", symbolLabel: '3/4" EMT' },
];

const quote = buildSupplyQuote({
  marks,
  fileName: "E1.01 Lighting.pdf",
  pageKinds: { 2: "drawing", 8: "legend", 9: "lighting-schedule" },
  drawingSymbols: [
    { id: "legend:r", abbr: "R", label: "Duplex receptacle", model: "SHOULD-NOT-APPEAR-ALONE" },
    { id: "sched:1", abbr: "1", type: "1", label: "Type 1 2x4 troffer", model: "2GTL4" },
  ],
  catalog: [
    { id: "2x4", abbr: "2x4", label: "2x4 recessed troffer / flat panel" },
    { id: "duplex", abbr: "R", label: "Duplex receptacle" },
  ],
});

assert(quote.rows.length === 2, `only plan devices are quoted, got ${quote.rows.length}`);
assert(!quote.rows.some((row) => /legend|Schedule-only|Check panel|EMT/i.test(row.description)), "legend, notes, and conduit are not quote rows");
assert(quote.rows.find((row) => row.description.includes("Type 1"))?.quantity === 2, "same device type is totaled");
assert(quote.rows.find((row) => row.description.includes("Duplex"))?.quantity === 1, "receptacle count is 1");
assert(quote.rows.find((row) => row.description.includes("Type 1"))?.model === "2GTL4", "model comes from the matched drawing schedule field");
assert(quote.rows.find((row) => row.description.includes("Duplex"))?.model === "", "model stays blank when catalog and mark have none");
assert(quote.totals.quantity === 3, "quote quantity is takeoff device count");
assert(modelFromKnownFields({ label: "Lithonia 2GTL4" }) === "", "description text is not treated as a model");

const invented = buildSupplyQuote({
  marks: [{ id: "a", type: "count", sheet: 1, symbol: "duplex", symbolLabel: "Duplex receptacle", abbr: "R" }],
  catalog: [{ id: "duplex", abbr: "R", label: "Duplex receptacle" }],
});
assert(invented.rows[0].model === "", "no model is invented for a catalog device without a model field");

const csv = supplyQuoteToCsv(quote);
assert(csv.includes("Model,Description,Quantity,Unit,Category"), "csv has quote headers");
assert(csv.includes("2GTL4"), "csv includes the known model");
assert(csv.includes("Type 1 2x4 troffer"), "csv includes the takeoff description");
assert(supplyQuoteCsvFileName(quote) === "supply-quote-E1.01-Lighting.csv", `csv name is ${supplyQuoteCsvFileName(quote)}`);

const pdf = buildSupplyQuotePdf(quote);
assert(typeof pdf.doc.output === "function", "pdf document is created");
assert(pdf.fileName === "supply-quote-E1.01-Lighting.pdf", "pdf file name matches the drawing");
assert(pdf.strings.includes("2GTL4") && pdf.strings.some((line) => /Duplex receptacle/.test(line)), "pdf lists model and description");
assert(!pdf.strings.includes("SHOULD-NOT-APPEAR-ALONE"), "legend-only models do not become their own rows");

if (!process.exitCode) console.log("supply quote checks passed");
