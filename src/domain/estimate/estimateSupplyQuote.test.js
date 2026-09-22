import assert from "node:assert/strict";
import { buildEstimateSupplyQuote, knownEstimateModel } from "./estimateSupplyQuote.js";
import { buildSupplyQuotePdf, supplyQuoteToExcel } from "../takeoff/supplyQuote.js";

const emt = {
  id: "a",
  itemType: "Conduit",
  category: "EMT conduit",
  description: '1/2" EMT',
  quantity: 10,
  unit: "STICK",
  laborItemId: "EL-00039",
};
const lights = {
  id: "b",
  itemType: "Fixture",
  category: "Lighting",
  description: "Lights that shone upon a roadside sign",
  quantity: 2,
  unit: "EA",
  model: "",
};
const blank = { id: "c", itemType: "", category: "", description: "", quantity: 1, unit: "EA" };
const omitted = { ...lights, id: "d", included: false, description: "Omitted pole light" };

const quote = buildEstimateSupplyQuote({
  lines: [emt, lights, blank, omitted],
  itemized: true,
  projectName: "Roadside sign",
});

assert.equal(quote.rows.length, 2, "blank and omitted lines stay off the quote");
assert.equal(quote.rows[0].device, "EMT conduit");
assert.equal(quote.rows[0].description, '1/2" EMT');
assert.equal(quote.rows[0].quantity, 10, "qty is the entered stick count, not labor feet");
assert.equal(quote.rows[0].model, "", "no model is invented for conduit");
assert.equal(quote.rows[1].device, "Lighting");
assert.equal(quote.rows[1].quantity, 2);
assert.equal(quote.rows[1].model, "");
assert.equal(quote.totals.quantity, 12);
assert.equal(knownEstimateModel({ description: "Lithonia 2GTL4 flood" }), "", "description text is not a model");
assert.equal(knownEstimateModel({ model: "2GTL4" }), "2GTL4");

const withModel = buildEstimateSupplyQuote({
  lines: [{ ...lights, model: "2GTL4" }],
  projectName: "Roadside sign",
});
assert.equal(withModel.rows[0].model, "2GTL4", "estimator-entered model is kept");

const excel = supplyQuoteToExcel(quote);
assert(excel.includes("Excel.Sheet"), "excel is a SpreadsheetML workbook");
assert(excel.includes("Device / equipment"), "excel has the device column");
assert(excel.includes("1/2") && excel.includes("EMT"), "excel includes the line description");
assert(!excel.includes("Omitted pole light"), "omitted lines are not on the excel");
assert(excel.includes("No estimate lines yet") === false);

const empty = buildEstimateSupplyQuote({ lines: [blank], projectName: "Blank job" });
const emptyExcel = supplyQuoteToExcel(empty);
assert(emptyExcel.includes("No estimate lines yet"), "empty estimate quote does not use the takeoff empty row");
assert(!emptyExcel.includes("No takeoff devices"), "takeoff empty copy stays off estimate exports");

const pdf = buildSupplyQuotePdf(quote);
assert(typeof pdf.doc.output === "function", "pdf document is created");
assert(pdf.strings.includes("1/2\" EMT"), "pdf lists the estimate description");
assert(pdf.strings.includes("Model numbers are only listed when entered on the estimate line."));
assert(!pdf.strings.includes("2GTL4"), "pdf does not invent a model");

console.log("estimate supply quote tests passed");
