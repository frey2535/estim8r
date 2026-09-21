import { jsPDF } from "jspdf";
import { DEVICE_SYMBOLS } from "./catalog.js";
import { TRADE_ONLY_SYMBOLS } from "./trades.js";

const LEGEND_SHEET_KINDS = new Set([
  "legend",
  "lighting-schedule",
  "device-schedule",
  "equipment-schedule",
  "spec",
]);

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function sameKey(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

export function pageKindsFromDocs(docs) {
  const map = {};
  for (const page of docs?.pages || []) {
    if (page?.page) map[page.page] = page.kind;
  }
  return map;
}

export function isQuoteDeviceMark(mark) {
  return mark?.type === "count" || mark?.type === "drop";
}

export function isLegendQuoteSource(mark, pageKinds = {}) {
  if (mark?.source === "legend") return true;
  return LEGEND_SHEET_KINDS.has(pageKinds[mark?.sheet]);
}

export function modelFromKnownFields(item) {
  if (!item) return "";
  const raw = item.model ?? item.modelNumber ?? item.catalogNumber ?? item.catalogNo ?? "";
  return String(raw).trim();
}

export function catalogForQuote() {
  return [...DEVICE_SYMBOLS, ...TRADE_ONLY_SYMBOLS];
}

function isLegendCatalogRow(item) {
  return item?.source === "legend" || String(item?.id || "").startsWith("legend:");
}

export function findKnownMatch(mark, list = []) {
  return (list || []).find((item) => {
    if (isLegendCatalogRow(item)) return false;
    return sameKey(item.id, mark?.symbol)
      || sameKey(item.abbr, mark?.typeCode)
      || sameKey(item.abbr, mark?.abbr)
      || sameKey(item.type, mark?.typeCode);
  }) || null;
}

export function supplyQuoteFileBase(fileName) {
  const base = String(fileName || "drawing").replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-") || "drawing";
  return `supply-quote-${base}`;
}

export function buildSupplyQuote({
  marks = [],
  drawingSymbols = [],
  catalog = catalogForQuote(),
  pageKinds = {},
  projectName = "",
  fileName = "",
} = {}) {
  const rows = new Map();
  for (const mark of marks) {
    if (!isQuoteDeviceMark(mark)) continue;
    if (isLegendQuoteSource(mark, pageKinds)) continue;
    const drawingItem = findKnownMatch(mark, drawingSymbols);
    const catalogItem = findKnownMatch(mark, catalog);
    const model = modelFromKnownFields(mark) || modelFromKnownFields(drawingItem) || modelFromKnownFields(catalogItem);
    const description = mark.symbolLabel || drawingItem?.label || catalogItem?.label || mark.symbol || mark.typeCode || "Device";
    const category = mark.category || drawingItem?.takeoffCategory || catalogItem?.category || "";
    const key = `${model}|${description}|${category}`;
    if (!rows.has(key)) {
      rows.set(key, {
        model,
        description,
        category,
        quantity: 0,
        unit: "EA",
      });
    }
    rows.get(key).quantity += 1;
  }
  const list = [...rows.values()].sort((a, b) => (
    a.description.localeCompare(b.description) || a.model.localeCompare(b.model)
  ));
  const quantity = list.reduce((sum, row) => sum + row.quantity, 0);
  return {
    title: "Supply house material quote",
    projectName: projectName || String(fileName || "").replace(/\.[^.]+$/, "") || "Takeoff",
    fileBase: supplyQuoteFileBase(fileName),
    rows: list,
    totals: { quantity, items: list.length },
  };
}

export function supplyQuoteToCsv(quote) {
  const lines = [
    ["Model", "Description", "Quantity", "Unit", "Category"].map(csvCell).join(","),
    ...quote.rows.map((row) => [
      csvCell(row.model),
      csvCell(row.description),
      row.quantity,
      csvCell(row.unit),
      csvCell(row.category),
    ].join(",")),
  ];
  if (!quote.rows.length) lines.push(["", "No takeoff devices", 0, "EA", ""].map(csvCell).join(","));
  lines.push(["", "TOTAL", quote.totals.quantity, "EA", ""].map(csvCell).join(","));
  return `\uFEFF${lines.join("\n")}\n`;
}

export function buildSupplyQuotePdf(quote) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const strings = [];
  const write = (text, x, y, options) => {
    const value = String(text ?? "");
    if (!value) return;
    strings.push(value);
    doc.text(value, x, y, options);
  };
  const left = 40;
  const right = 572;
  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  write(quote.title, left, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  write(quote.projectName, left, y);
  y += 14;
  doc.setTextColor(90);
  write("For a material quote. Model numbers are only listed when the drawing or catalog has them.", left, y);
  doc.setTextColor(0);
  y += 22;
  const cols = [
    { label: "Model", x: left, width: 120 },
    { label: "Description", x: left + 120, width: 260 },
    { label: "Qty", x: left + 400, width: 40 },
    { label: "Unit", x: left + 440, width: 36 },
    { label: "Category", x: left + 476, width: right - (left + 476) },
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  for (const col of cols) write(col.label, col.x, y);
  y += 8;
  doc.setDrawColor(180);
  doc.line(left, y, right, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  const rows = quote.rows.length ? quote.rows : [{ model: "", description: "No takeoff devices", quantity: 0, unit: "EA", category: "" }];
  for (const row of rows) {
    const desc = doc.splitTextToSize(String(row.description || ""), 256);
    const height = Math.max(14, desc.length * 12);
    if (y + height > 740) {
      doc.addPage();
      y = 48;
    }
    write(String(row.model || ""), cols[0].x, y);
    write(desc, cols[1].x, y);
    write(String(row.quantity ?? ""), cols[2].x, y);
    write(String(row.unit || "EA"), cols[3].x, y);
    write(String(row.category || ""), cols[4].x, y, { maxWidth: cols[4].width });
    y += height;
  }
  y += 8;
  doc.setFont("helvetica", "bold");
  write(`Total ${quote.totals.quantity} EA`, left, y);
  return { doc, fileName: `${quote.fileBase}.pdf`, strings };
}

export function supplyQuoteCsvFileName(quote) {
  return `${quote.fileBase}.csv`;
}
