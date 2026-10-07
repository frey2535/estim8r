import assert from "node:assert/strict";
import {
  buildEstimateSupplyQuote,
  createSupplyQuotePdfPreview,
  estimateLineBelongsOnSupplyQuote,
  isLaborOnlySupplyQuoteLine,
  knownEstimateModel,
  supplyQuotePreviewKey,
} from "./estimateSupplyQuote.js";
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
const trench = {
  id: "e",
  itemType: "Labor",
  category: "Site/Earthwork",
  description: "Hand trenching",
  quantity: 40,
  unit: "LF",
  laborItemId: "EL-00001",
};
const sawcut = {
  id: "f",
  itemType: "Labor",
  category: "Civil Support",
  description: "Sawcutting concrete",
  quantity: 12,
  unit: "LF",
};
const excavation = {
  id: "g",
  itemType: "Subcontract",
  category: "Excavation",
  description: "Mini excavator trenching",
  quantity: 80,
  unit: "LF",
  laborItemId: "EL-00007",
};
const allowance = {
  id: "h",
  itemType: "Allowance",
  category: "",
  description: "Misc field allowance",
  quantity: 1,
  unit: "LOT",
};
const groundRod = {
  id: "i",
  itemType: "Labor",
  category: "Grounding",
  description: "Install Ground rod",
  quantity: 4,
  unit: "EA",
  laborItemId: "EL-01665",
};
const meterBase = {
  id: "j",
  itemType: "Labor",
  category: "Residential",
  description: "Install Meter base",
  quantity: 1,
  unit: "EA",
  laborItemId: "EL-01874",
};

const library = [
  { id: "EL-00001", category: "Site/Earthwork", subcategory: "Trenching", item_name: "Hand trenching", unit: "LF" },
  { id: "EL-00007", category: "Site/Earthwork", subcategory: "Trenching", item_name: "Mini excavator trenching", unit: "LF" },
  { id: "EL-00032", category: "Site/Earthwork", subcategory: "Civil Support", item_name: "Sawcut asphalt/concrete", unit: "LF" },
  { id: "EL-01665", category: "Grounding", subcategory: "Grounding & Bonding", item_name: "Install Ground rod", unit: "EA" },
  { id: "EL-01874", category: "Residential", subcategory: "Service & Devices", item_name: "Install Meter base", unit: "EA" },
];

assert.equal(isLaborOnlySupplyQuoteLine(trench, library[0]), true);
assert.equal(isLaborOnlySupplyQuoteLine(sawcut, null), true);
assert.equal(isLaborOnlySupplyQuoteLine(excavation, library[1]), true);
assert.equal(isLaborOnlySupplyQuoteLine(allowance, null), true);
assert.equal(isLaborOnlySupplyQuoteLine(emt, null), false);
assert.equal(estimateLineBelongsOnSupplyQuote(groundRod, library[3]), true, "ground rods are a buy-list item");
assert.equal(estimateLineBelongsOnSupplyQuote(meterBase, library[4]), true, "meter bases are a buy-list item");

const quote = buildEstimateSupplyQuote({
  lines: [emt, lights, blank, omitted, trench, sawcut, excavation, allowance, groundRod, meterBase],
  itemized: true,
  library,
  projectName: "Roadside sign",
});

assert.equal(quote.rows.length, 4, "labor-only and omitted lines stay off the quote");
assert.deepEqual(quote.rows.map((row) => row.description), [
  '1/2" EMT',
  "Lights that shone upon a roadside sign",
  "Install Ground rod",
  "Install Meter base",
]);
assert.equal(quote.rows[0].device, "EMT conduit");
assert.equal(quote.rows[0].quantity, 10, "qty is the entered stick count, not labor feet");
assert.equal(quote.rows[0].model, "", "no model is invented for conduit");
assert.equal(quote.rows[1].device, "Lighting");
assert.equal(quote.rows[1].quantity, 2);
assert.equal(quote.totals.quantity, 17);
assert(!quote.rows.some((row) => /trench|sawcut|excav|allowance/i.test(row.description)), "labor-only copy stays off the quote");
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
assert(!excel.includes("Hand trenching"), "hand trenching is not on the excel");
assert(!excel.includes("Sawcutting concrete"), "sawcutting is not on the excel");
assert(excel.includes("No supply-house items yet") === false);

const empty = buildEstimateSupplyQuote({ lines: [blank, trench], library, projectName: "Blank job" });
assert.equal(empty.rows.length, 0, "labor-only alone is an empty supply quote");
const emptyExcel = supplyQuoteToExcel(empty);
assert(emptyExcel.includes("No supply-house items yet"), "empty estimate quote does not use the takeoff empty row");
assert(!emptyExcel.includes("No takeoff devices"), "takeoff empty copy stays off estimate exports");

const pdf = buildSupplyQuotePdf(quote);
assert(typeof pdf.doc.output === "function", "pdf document is created");
assert(pdf.strings.includes("1/2\" EMT"), "pdf lists the estimate description");
assert(pdf.strings.some((text) => text.includes("Labor-only work stays on the estimate.")));
assert(!pdf.strings.includes("Hand trenching"), "pdf does not list hand trenching");
assert(!pdf.strings.includes("Sawcutting concrete"), "pdf does not list sawcutting");
assert(!pdf.strings.includes("2GTL4"), "pdf does not invent a model");

const emptyPreview = createSupplyQuotePdfPreview(empty);
assert.equal(emptyPreview.status, "empty", "preview is empty when only labor-only lines exist");
assert.equal(emptyPreview.blob, null, "empty preview does not invent a PDF blob");

const preview = createSupplyQuotePdfPreview(quote);
const rebuilt = buildSupplyQuotePdf(quote);
assert.equal(preview.status, "ready", "preview is ready when buy-list lines exist");
assert.equal(preview.fileName, rebuilt.fileName, "preview uses the download file name");
assert.deepEqual(preview.strings, rebuilt.strings, "preview is the same quote PDF as download");
assert(preview.blob instanceof Blob, "ready preview exposes the download blob");
assert(supplyQuotePreviewKey(quote) !== supplyQuotePreviewKey(empty), "preview key follows filtered rows");

console.log("estimate supply quote tests passed");
