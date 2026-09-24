import { jsPDF } from "jspdf";
import { brandingLayout, companyLines, normalizeBranding } from "./branding.js";
import { estimateGrandTotal } from "./projectDocuments.js";
import { includedLines, resolveVisibleTotals, TOTAL_OPTIONS } from "./presentation.js";
import { estimateLineLaborCost } from "./manualLineLabor.js";

const HIDDEN_LABELS = [
  "employee class",
  "hourly wage",
  "productivity factor",
  "overhead",
  "profit",
  "crew rate",
  "journeyman",
];

function hexRgb(hex) {
  const value = String(hex || "").replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16) || 0,
    g: parseInt(value.slice(2, 4), 16) || 0,
    b: parseInt(value.slice(4, 6), 16) || 0,
  };
}

function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function safeName(value, fallback) {
  const next = String(value || "").trim() || fallback;
  return next.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || fallback;
}

export function estimatePdfFileName(estimate) {
  const project = safeName(estimate?.header?.projectName, "estimate");
  const number = String(estimate?.header?.estimateNumber || "").trim();
  return number ? `${project}-${safeName(number, "estimate")}.pdf` : `${project}.pdf`;
}

export function estimatePresentation(estimate) {
  const header = estimate?.header || {};
  const design = estimate?.pdfDesign || {};
  const moneyTotals = estimateGrandTotal(estimate);
  const visible = resolveVisibleTotals(estimate);
  const sourceLines = includedLines(estimate);
  const itemized = Boolean(estimate?.itemized);
  const lines = itemized
    ? sourceLines.map((line) => {
        const qty = Number(line.quantity) || 0;
        const material = qty * (Number(line.materialUnitCost) || 0);
        const labor = estimateLineLaborCost(line);
        return {
          itemType: line.itemType || "",
          category: line.category || "",
          description: line.description || "",
          quantity: qty,
          unit: line.unit || "",
          material,
          labor,
          amount: material + labor,
          notes: line.notes || "",
        };
      })
    : [{
        itemType: "",
        category: "",
        description: "Materials and labor",
        quantity: 1,
        unit: "LS",
        material: 0,
        labor: 0,
        amount: moneyTotals.total,
        notes: "",
      }];
  return {
    title: header.projectName || "Electrical Estimate",
    documentTitle: design.documentTitle || "Electrical Estimate",
    subtitle: design.subtitle || "",
    estimateNumber: header.estimateNumber || "",
    projectAddress: header.projectAddress || "",
    customerCompany: header.customerCompany || "",
    customerName: header.customerName || "",
    customerPhone: header.customerPhone || "",
    customerEmail: header.customerEmail || "",
    estimatorName: header.estimatorName || "",
    bidDue: header.bidDue || "",
    scopeNotes: header.scopeNotes || "",
    lines,
    totals: Object.fromEntries(
      TOTAL_OPTIONS
        .filter((option) => visible[option.key])
        .map((option) => [option.key, moneyTotals[option.key]]),
    ),
  };
}

export function presentationHasInternals(presentation) {
  const blob = JSON.stringify(presentation || {}).toLowerCase();
  return HIDDEN_LABELS.some((label) => blob.includes(label));
}

export function estimateHasPdfLines(estimate) {
  return includedLines(estimate).some((line) => {
    const label = String(line?.description || line?.itemType || line?.category || line?.notes || "").trim();
    const qty = Number(line?.quantity) || 0;
    const material = qty * (Number(line?.materialUnitCost) || 0);
    const labor = estimateLineLaborCost(line);
    return Boolean(label || material || labor);
  });
}

export function estimatePdfPreviewKey(estimate, brandingInput) {
  return JSON.stringify({
    presentation: estimatePresentation(estimate),
    fileName: estimatePdfFileName(estimate),
    branding: normalizeBranding(brandingInput),
    pdfDesign: estimate?.pdfDesign || {},
  });
}

export function createEstimatePdfPreview(estimate, brandingInput) {
  const fileName = estimatePdfFileName(estimate);
  const presentation = estimatePresentation(estimate);
  if (!estimateHasPdfLines(estimate)) {
    return { status: "empty", fileName, presentation, blob: null, strings: [] };
  }
  const built = estimatePdfBlob(estimate, brandingInput);
  return {
    status: "ready",
    fileName: built.fileName,
    presentation: built.presentation,
    blob: built.blob,
    strings: built.strings,
  };
}

function logoFormat(dataUrl) {
  if (/^data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
  if (/^data:image\/webp/i.test(dataUrl)) return "WEBP";
  return "PNG";
}

function wrap(doc, value, width) {
  const text = String(value || "");
  if (!text) return [];
  return doc.splitTextToSize(text, width);
}

export function buildEstimatePdf(estimate, brandingInput) {
  const branding = brandingLayout(normalizeBranding(brandingInput));
  const presentation = estimatePresentation(estimate);
  const design = { showProjectCard: true, showScope: true, showDescription: true, showQuantity: true, showUnit: true, showMaterial: true, showLabor: true, showAmount: true, showNotes: true, showPageNumbers: true, tableStyle: "grid", density: "comfortable", titleSize: 18, bodySize: 9, margin: 40, footerText: "", ...(estimate?.pdfDesign || {}) };
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = Math.max(20, Math.min(72, Number(design.margin) || 40));
  const page = { width: 612, height: 792, left: margin, right: 612 - margin };
  const strings = [];
  const color = (hex) => hexRgb(hex);

  function write(text, x, y, options) {
    const value = String(text ?? "");
    if (!value) return 0;
    strings.push(value);
    doc.text(value, x, y, options);
    return doc.getTextDimensions(value).h;
  }

  function fill(hex) {
    const rgb = color(hex);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
  }

  function ink(hex) {
    const rgb = color(hex);
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
  }

  function pageBackground() {
    fill(branding.pageColor);
    doc.rect(0, 0, page.width, page.height, "F");
  }

  function headerBar(y = 0) {
    fill(branding.headerColor);
    doc.rect(0, y, page.width, branding.headerHeight, "F");
    const pad = 18;
    let x = pad;
    const logoY = y + (branding.headerHeight - branding.logo) / 2;
    if (branding.logoDataUrl) {
      try {
        doc.addImage(branding.logoDataUrl, logoFormat(branding.logoDataUrl), x, logoY, branding.logo, branding.logo);
        x += branding.logo + 12;
      } catch {
        /* skip a broken logo rather than failing the PDF */
      }
    }
    doc.setFont(branding.font, "bold");
    doc.setFontSize(branding.headerSize === "small" ? 14 : branding.headerSize === "large" ? 22 : 18);
    ink(branding.headerTextColor);
    write(branding.companyName || "Estimate", x, y + 28);
    doc.setFont(branding.font, "normal");
    doc.setFontSize(Number(design.bodySize) || 9);
    let lineY = y + 44;
    for (const line of companyLines(branding)) {
      write(line, x, lineY);
      lineY += 12;
    }
    return y + branding.headerHeight;
  }

  function card(x, y, width, height) {
    fill(branding.cardColor);
    doc.roundedRect(x, y, width, height, branding.cardRadius, branding.cardRadius, "F");
  }

  pageBackground();
  let cursor = headerBar(0) + 18;
  const cardWidth = page.right - page.left;
  doc.setFont(branding.font, "bold");
  doc.setFontSize(Number(design.titleSize) || 18);
  ink(branding.secondaryColor);
  write(presentation.documentTitle, page.left, cursor);
  cursor += (Number(design.titleSize) || 18) + 4;
  if (presentation.subtitle) { doc.setFont(branding.font, "normal"); doc.setFontSize(Number(design.bodySize) || 9); write(presentation.subtitle, page.left, cursor); cursor += 16; }

  const infoLines = [
    ["Project", presentation.title, "Estimate #", presentation.estimateNumber],
    ["Address", presentation.projectAddress, "Customer", presentation.customerCompany],
    ["Contact", presentation.customerName, "Phone", presentation.customerPhone],
    ["Email", presentation.customerEmail, "Estimator", presentation.estimatorName],
    ["Bid due", presentation.bidDue, "", ""],
  ].filter((row) => row[1] || row[3]);
  const noteLines = wrap(doc, presentation.scopeNotes, cardWidth - branding.cardPad * 2);
  const infoHeight = branding.cardPad * 2 + infoLines.length * 28 + (noteLines.length ? noteLines.length * 12 + 18 : 0);
  if (design.showProjectCard) card(page.left, cursor, cardWidth, Math.max(72, infoHeight));
  doc.setFont(branding.font, "bold");
  doc.setFontSize(11);
  ink(branding.secondaryColor);
  if (design.showProjectCard) write("Project & customer", page.left + branding.cardPad, cursor + 16);
  let infoY = cursor + 36;
  doc.setFontSize(9);
  for (const [leftLabel, leftValue, rightLabel, rightValue] of infoLines) {
    doc.setFont(branding.font, "bold");
    ink(branding.secondaryColor);
    write(leftLabel, page.left + branding.cardPad, infoY);
    if (rightLabel) write(rightLabel, page.left + cardWidth / 2, infoY);
    doc.setFont(branding.font, "normal");
    ink(branding.textColor);
    write(leftValue || "—", page.left + branding.cardPad, infoY + 12);
    if (rightLabel) write(rightValue || "—", page.left + cardWidth / 2, infoY + 12);
    infoY += 28;
  }
  if (design.showScope && noteLines.length) {
    doc.setFont(branding.font, "bold");
    ink(branding.secondaryColor);
    write("Scope", page.left + branding.cardPad, infoY);
    doc.setFont(branding.font, "normal");
    ink(branding.textColor);
    noteLines.forEach((line, index) => write(line, page.left + branding.cardPad, infoY + 14 + index * 12));
  }
  cursor += Math.max(72, infoHeight) + 18;

  const availableWidth = page.right - page.left;
  const requestedColumns = estimate?.itemized === false
    ? [
        { key: "description", label: "Description", weight: 3.5, align: "left" },
        { key: "amount", label: "Total", weight: 1.0, align: "right" },
      ]
    : [
        design.showItemType ? { key: "itemType", label: "Type", weight: 1.0, align: "left" } : null,
        design.showCategory ? { key: "category", label: "Category", weight: 1.0, align: "left" } : null,
        design.showDescription !== false ? { key: "description", label: "Item", weight: 2.5, align: "left" } : null,
        design.showQuantity !== false ? { key: "quantity", label: "Qty", weight: 0.65, align: "right" } : null,
        design.showUnit !== false ? { key: "unit", label: "Unit", weight: 0.65, align: "left" } : null,
        design.showMaterial !== false ? { key: "material", label: "Material", weight: 1.0, align: "right" } : null,
        design.showLabor !== false ? { key: "labor", label: "Labor", weight: 1.0, align: "right" } : null,
        design.showAmount !== false ? { key: "amount", label: "Amount", weight: 1.0, align: "right" } : null,
      ].filter(Boolean);
  const weightTotal = requestedColumns.reduce((sum, column) => sum + column.weight, 0) || 1;
  const columns = requestedColumns.map((column) => ({ ...column, width: availableWidth * column.weight / weightTotal }));

  function ensureSpace(needed) {
    if (cursor + needed < 750) return;
    doc.addPage();
    pageBackground();
    cursor = headerBar(0) + 16;
  }

  function cellValue(line, key) {
    if (key === "quantity") return Number(line.quantity || 0).toFixed(2);
    if (key === "material" || key === "labor" || key === "amount") return money(line[key]);
    return line[key] || "";
  }

  function drawTableHeader() {
    fill(branding.primaryColor);
    doc.rect(page.left, cursor, cardWidth, 22, "F");
    doc.setFont(branding.font, "bold");
    doc.setFontSize(8);
    ink(branding.headerTextColor);
    let x = page.left + 8;
    for (const column of columns) {
      write(column.label, column.align === "right" ? x + column.width - 4 : x, cursor + 15, {
        align: column.align === "right" ? "right" : "left",
      });
      x += column.width;
    }
    cursor += 22;
  }

  ensureSpace(80);
  doc.setFont(branding.font, "bold");
  doc.setFontSize(12);
  ink(branding.secondaryColor);
  write("Estimate", page.left, cursor);
  cursor += 16;
  drawTableHeader();

  const rows = presentation.lines.length
    ? presentation.lines
    : [{ description: "No line items yet", quantity: 0, unit: "", material: 0, labor: 0, amount: 0 }];

  rows.forEach((line, index) => {
    const firstColumn = columns[0];
    const firstValue = firstColumn ? cellValue(line, firstColumn.key) : "";
    const firstLines = wrap(doc, firstValue || "Item", Math.max(30, (firstColumn?.width || cardWidth) - 10));
    const height = Math.max(22, firstLines.length * 12 + 10);
    ensureSpace(height + 8);
    if (index % 2 === 0) {
      fill(branding.cardColor);
      doc.rect(page.left, cursor, cardWidth, height, "F");
    }
    doc.setFont(branding.font, "normal");
    doc.setFontSize(8);
    ink(branding.textColor);
    let x = page.left + 8;
    firstLines.forEach((part, partIndex) => write(part, x, cursor + 14 + partIndex * 12));
    x += firstColumn?.width || 0;
    for (const column of columns.slice(1)) {
      write(cellValue(line, column.key), column.align === "right" ? x + column.width - 4 : x, cursor + 14, {
        align: column.align === "right" ? "right" : "left",
      });
      x += column.width;
    }
    cursor += height;
  });

  cursor += 16;
  const totalRows = TOTAL_OPTIONS.filter((option) => option.key in presentation.totals);
  const totalsHeight = branding.cardPad * 2 + Math.max(22, totalRows.length * 22 + 12);
  ensureSpace(totalsHeight + 8);
  card(page.right - 240, cursor, 240, totalsHeight);
  totalRows.forEach((option, index) => {
    const y = cursor + branding.cardPad + 16 + index * 22;
    const last = option.key === "total";
    doc.setFont(branding.font, last ? "bold" : "normal");
    doc.setFontSize(last ? 12 : 10);
    ink(last ? branding.accentColor : branding.textColor);
    write(option.label, page.right - 228, y);
    write(money(presentation.totals[option.key]), page.right - 16, y, { align: "right" });
  });

  return {
    doc,
    strings,
    fileName: estimatePdfFileName(estimate),
    presentation,
  };
}

export function estimatePdfBlob(estimate, brandingInput) {
  const { doc, fileName, presentation, strings } = buildEstimatePdf(estimate, brandingInput);
  return {
    blob: doc.output("blob"),
    fileName,
    presentation,
    strings,
  };
}

export function printEstimatePdf(doc) {
  if (typeof document === "undefined") return;
  const url = doc.output("bloburl");
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  document.body.appendChild(frame);
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 1500);
    }
  };
}
