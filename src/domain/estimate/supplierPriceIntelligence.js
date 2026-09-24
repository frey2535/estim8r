function clean(value) { return String(value ?? "").trim(); }
function key(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function money(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; }

export function parseSupplierPriceCsv(text, { supplier = "", effectiveDate = "", reference = "" } = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(key);
  const col = (...names) => headers.findIndex((h) => names.includes(h));
  const description = col("description", "item description", "product description", "item");
  const model = col("model", "model number", "catalog", "catalog number", "sku", "part number");
  const price = col("price", "unit price", "unit cost", "cost", "net price");
  const unit = col("unit", "uom");
  if (price < 0 || (description < 0 && model < 0)) throw new Error("CSV needs a description or model/SKU column and a unit price/cost column.");
  return rows.slice(1).map((row, index) => ({
    id: "supplier-price-" + index + "-" + key(row[model] || row[description]),
    supplier: clean(supplier),
    effectiveDate: clean(effectiveDate),
    reference: clean(reference),
    description: description >= 0 ? clean(row[description]) : "",
    model: model >= 0 ? clean(row[model]) : "",
    unit: unit >= 0 ? clean(row[unit]) : "",
    unitCost: money(row[price]),
  })).filter((row) => row.unitCost != null && (row.description || row.model));
}

export function matchSupplierPrices(line, priceRows = []) {
  const model = key(line?.model || line?.modelNumber || line?.catalogNumber);
  const description = key(line?.description);
  return priceRows.map((row) => {
    const rowModel = key(row.model);
    const rowDescription = key(row.description);
    let score = 0;
    if (model && rowModel && model === rowModel) score = 100;
    else if (model && rowModel && (model.includes(rowModel) || rowModel.includes(model))) score = 90;
    else if (description && rowDescription && description === rowDescription) score = 80;
    else if (description && rowDescription) {
      const words = new Set(description.split(" ").filter((word) => word.length > 2));
      const other = new Set(rowDescription.split(" ").filter((word) => word.length > 2));
      const overlap = [...words].filter((word) => other.has(word)).length;
      score = Math.round(70 * overlap / Math.max(words.size, other.size, 1));
    }
    return { ...row, matchScore: score };
  }).filter((row) => row.matchScore >= 35).sort((a, b) => b.matchScore - a.matchScore || a.unitCost - b.unitCost);
}

export function supplierComparison(line, supplierBooks = []) {
  return supplierBooks.flatMap((book) => matchSupplierPrices(line, book.rows || []).map((row) => ({
    ...row,
    supplier: row.supplier || book.supplier || "",
    effectiveDate: row.effectiveDate || book.effectiveDate || "",
    reference: row.reference || book.reference || "",
  }))).sort((a, b) => b.matchScore - a.matchScore || a.unitCost - b.unitCost);
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < String(text).length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); if (row.some((v) => clean(v))) rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell); if (row.some((v) => clean(v))) rows.push(row);
  return rows;
}
