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

export function deviceFromKnownFields(mark, drawingItem, catalogItem) {
  const raw = mark?.typeCode
    || mark?.abbr
    || drawingItem?.type
    || drawingItem?.abbr
    || catalogItem?.type
    || catalogItem?.abbr
    || mark?.symbol
    || drawingItem?.id
    || catalogItem?.id
    || "";
  return String(raw).trim();
}

function xmlText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    const device = deviceFromKnownFields(mark, drawingItem, catalogItem);
    const model = modelFromKnownFields(mark) || modelFromKnownFields(drawingItem) || modelFromKnownFields(catalogItem);
    const description = mark.symbolLabel || drawingItem?.label || catalogItem?.label || mark.symbol || mark.typeCode || "Device";
    const category = mark.category || drawingItem?.takeoffCategory || catalogItem?.category || "";
    const key = `${device}|${model}|${description}|${category}`;
    if (!rows.has(key)) {
      rows.set(key, {
        device,
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
    a.device.localeCompare(b.device) || a.description.localeCompare(b.description) || a.model.localeCompare(b.model)
  ));
  const quantity = list.reduce((sum, row) => sum + row.quantity, 0);
  return {
    title: "Supply house material quote",
    projectName: projectName || String(fileName || "").replace(/\.[^.]+$/, "") || "Takeoff",
    fileBase: supplyQuoteFileBase(fileName),
    generatedAt: new Date().toISOString(),
    rows: list,
    totals: { quantity, items: list.length },
  };
}

const QUOTE_HEADERS = ["Device / equipment", "Model", "Description", "Quantity"];

function quoteExportRows(quote) {
  const rows = quote.rows.length
    ? quote.rows
    : [{ device: "", model: "", description: quote.emptyDescription || "No takeoff devices", quantity: 0 }];
  return [
    ...rows,
    { device: "", model: "", description: "TOTAL", quantity: quote.totals.quantity },
  ];
}

export function supplyQuoteToCsv(quote) {
  const lines = [
    QUOTE_HEADERS.map(csvCell).join(","),
    ...quoteExportRows(quote).map((row) => [
      csvCell(row.device),
      csvCell(row.model),
      csvCell(row.description),
      row.quantity,
    ].join(",")),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

export function supplyQuoteToExcel(quote) {
  const headerCells = QUOTE_HEADERS.map((label) => (
    `<Cell><Data ss:Type="String">${xmlText(label)}</Data></Cell>`
  )).join("");
  const body = quoteExportRows(quote).map((row) => [
    "<Row>",
    `<Cell><Data ss:Type="String">${xmlText(row.device)}</Data></Cell>`,
    `<Cell><Data ss:Type="String">${xmlText(row.model)}</Data></Cell>`,
    `<Cell><Data ss:Type="String">${xmlText(row.description)}</Data></Cell>`,
    `<Cell><Data ss:Type="Number">${Number(row.quantity) || 0}</Data></Cell>`,
    "</Row>",
  ].join("")).join("");
  return [
    `<?xml version="1.0"?>`,
    `<?mso-application progid="Excel.Sheet"?>`,
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`,
    `<Worksheet ss:Name="Supply quote">`,
    `<Table>`,
    `<Column ss:Width="90"/><Column ss:Width="110"/><Column ss:Width="240"/><Column ss:Width="70"/>`,
    `<Row>${headerCells}</Row>`,
    body,
    `</Table>`,
    `</Worksheet>`,
    `</Workbook>`,
    "",
  ].join("\n");
}

export function buildSupplyQuotePdf(quote, branding = {}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const strings = [];
  const write = (text, x, y, options) => {
    const value = Array.isArray(text) ? text : String(text ?? "");
    if ((Array.isArray(value) && !value.length) || (!Array.isArray(value) && !value)) return;
    if (Array.isArray(value)) value.forEach((part) => strings.push(String(part)));
    else strings.push(value);
    doc.text(value, x, y, options);
  };
  const hex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  const primary = hex(branding.primaryColor, "#1d4ed8");
  const dark = hex(branding.secondaryColor, "#0f172a");
  const light = hex(branding.cardColor, "#f8fafc");
  const textColor = hex(branding.textColor, "#0f172a");
  const companyName = String(branding.companyName || "").trim();
  const companyLines = [
    branding.companyAddress,
    [branding.companyPhone, branding.companyEmail].filter(Boolean).join("  ·  "),
    branding.companyWebsite,
    branding.companyLicense ? `License ${branding.companyLicense}` : "",
  ].map((value) => String(value || "").trim()).filter(Boolean);
  const left = 42;
  const right = 570;
  const pageWidth = 612;
  const bottom = 748;
  const tableWidth = right - left;
  const cols = [
    { key: "device", label: "Device / equipment", x: left, width: 105 },
    { key: "model", label: "Model", x: left + 105, width: 120 },
    { key: "description", label: "Description", x: left + 225, width: 245 },
    { key: "quantity", label: "Qty", x: left + 470, width: 58 },
  ];

  function setText(hexColor = textColor) {
    doc.setTextColor(hexColor);
  }

  function drawLogo() {
    const dataUrl = String(branding.logoDataUrl || "");
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(dataUrl)) return 0;
    try {
      const format = /image\/(jpeg|jpg)/i.test(dataUrl) ? "JPEG" : /image\/webp/i.test(dataUrl) ? "WEBP" : "PNG";
      doc.addImage(dataUrl, format, left, 30, 86, 44, undefined, "FAST");
      return 96;
    } catch {
      return 0;
    }
  }

  function drawHeader(firstPage = false) {
    doc.setFillColor(dark);
    doc.rect(0, 0, pageWidth, 86, "F");
    const logoOffset = drawLogo();
    const companyX = left + logoOffset;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(companyName ? 15 : 11);
    doc.setTextColor("#ffffff");
    write(companyName || "Supply House Quote", companyX, 43);
    if (companyLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      companyLines.slice(0, 3).forEach((line, index) => write(line, companyX, 57 + index * 10));
    }
    doc.setTextColor(textColor);
    if (firstPage) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      write("Supply House Material Quote", left, 118);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      write(quote.projectName || "Estimate", left, 137);
      doc.setFontSize(8.5);
      doc.setTextColor("#64748b");
      const note = quote.modelNote || "Equipment and materials only. Model numbers are shown only when entered on the estimate.";
      const noteLines = doc.splitTextToSize(note, tableWidth);
      write(noteLines, left, 153);
      doc.setTextColor(textColor);
      return 153 + Math.max(18, noteLines.length * 10) + 10;
    }
    return 104;
  }

  function drawTableHeader(y) {
    doc.setFillColor(primary);
    doc.roundedRect(left, y, tableWidth, 24, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor("#ffffff");
    for (const col of cols) {
      write(col.label, col.x + 6, y + 16, col.key === "quantity" ? { align: "right" } : undefined);
    }
    doc.setTextColor(textColor);
    return y + 30;
  }

  function pageBreak() {
    doc.addPage();
    let y = drawHeader(false);
    return drawTableHeader(y);
  }

  let y = drawHeader(true);
  y = drawTableHeader(y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const rows = quote.rows.length
    ? quote.rows
    : [{ device: "", model: "", description: quote.emptyDescription || "No supply-house items", quantity: 0, unit: "" }];

  rows.forEach((row, index) => {
    const deviceLines = doc.splitTextToSize(String(row.device || ""), cols[0].width - 12);
    const modelLines = doc.splitTextToSize(String(row.model || "—"), cols[1].width - 12);
    const descLines = doc.splitTextToSize(String(row.description || ""), cols[2].width - 12);
    const qtyText = `${row.quantity ?? ""}${row.unit ? ` ${row.unit}` : ""}`;
    const lineCount = Math.max(deviceLines.length, modelLines.length, descLines.length, 1);
    const rowHeight = Math.max(28, lineCount * 10 + 12);
    if (y + rowHeight > bottom) y = pageBreak();

    if (index % 2 === 0) {
      doc.setFillColor(light);
      doc.rect(left, y - 4, tableWidth, rowHeight, "F");
    }
    doc.setDrawColor("#e2e8f0");
    doc.line(left, y + rowHeight - 4, right, y + rowHeight - 4);
    doc.setTextColor(textColor);
    write(deviceLines, cols[0].x + 6, y + 9);
    write(modelLines, cols[1].x + 6, y + 9);
    write(descLines, cols[2].x + 6, y + 9);
    doc.setFont("helvetica", "bold");
    write(qtyText, right - 6, y + 9, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += rowHeight;
  });

  if (y + 56 > bottom) y = pageBreak();
  y += 12;
  doc.setFillColor("#f1f5f9");
  doc.roundedRect(left, y, tableWidth, 42, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(textColor);
  write("Quote summary", left + 12, y + 17);
  doc.setFontSize(9);
  write(`${quote.totals?.items || rows.length} line item${Number(quote.totals?.items || rows.length) === 1 ? "" : "s"}`, left + 12, y + 32);
  write(quote.totalLabel || `Total quantity ${quote.totals?.quantity || 0}`, right - 12, y + 32, { align: "right" });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor("#64748b");
    write(`Page ${page} of ${pageCount}`, right, 774, { align: "right" });
    write("Supply house material quote", left, 774);
  }

  return { doc, fileName: `${quote.fileBase}.pdf`, strings };
}

export function supplyQuoteCsvFileName(quote) {
  return `${quote.fileBase}.csv`;
}

export function supplyQuoteExcelFileName(quote) {
  return `${quote.fileBase}.xls`;
}
