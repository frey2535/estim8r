import { jsPDF } from "jspdf";
import { brandingLayout, normalizeBranding, resolveLogoBox } from "./branding.js";
import { estimateGrandTotal } from "./projectDocuments.js";
import { includedLines, resolveVisibleTotals, TOTAL_OPTIONS } from "./presentation.js";
import { estimateLineLaborCost } from "./manualLineLabor.js";

export const DEFAULT_DOCUMENT_TITLE = "Electrical";
export const LEGACY_DOCUMENT_TITLE = "Electrical Estimate";
export const DEFAULT_SCOPE_TEXT = "This estimate is valid for 30 days and is not an invoice.";
export const DEFAULT_TERMS_TEXT =
  "This estimate is valid for 30 days and is not an invoice. Pricing may change if scope, site conditions, or materials change.";

const SCOPE_SAME_PAGE_MAX_LINES = 15;
const SIG_BLOCK_H = 86;

export function normalizeDocumentTitle(value) {
  const text = String(value ?? "").trim();
  if (!text || text === LEGACY_DOCUMENT_TITLE) return DEFAULT_DOCUMENT_TITLE;
  return text;
}

const HIDDEN_LABELS = [
  "employee class",
  "hourly wage",
  "productivity factor",
  "overhead",
  "profit",
  "crew rate",
  "journeyman",
];

function hexRgb(hex, fallback = [17, 24, 39]) {
  const raw = String(hex || "").trim();
  const match = raw.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return { r: fallback[0], g: fallback[1], b: fallback[2] };
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbTuple(hex, fallback) {
  const { r, g, b } = hexRgb(hex, fallback);
  return [r, g, b];
}

function isDarkRgb([r, g, b]) {
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

function softFill(docBg, docText, mix = 0.03) {
  return [
    Math.min(255, Math.round(docBg[0] * (1 - mix) + docText[0] * mix)),
    Math.min(255, Math.round(docBg[1] * (1 - mix) + docText[1] * mix)),
    Math.min(255, Math.round(docBg[2] * (1 - mix) + docText[2] * mix)),
  ];
}

function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function fmtDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString();
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
        const amount = material + labor;
        return {
          itemType: line.itemType || "",
          category: line.category || "",
          description: line.description || "",
          quantity: qty,
          unit: line.unit || "",
          material,
          labor,
          unitPrice: qty ? amount / qty : amount,
          amount,
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
        unitPrice: moneyTotals.total,
        amount: moneyTotals.total,
        notes: "",
      }];
  return {
    title: header.projectName || "",
    documentTitle: normalizeDocumentTitle(design.documentTitle),
    subtitle: design.subtitle || "",
    estimateNumber: header.estimateNumber || "",
    estimateDate: header.estimateDate || header.issueDate || "",
    projectAddress: header.projectAddress || "",
    customerCompany: header.customerCompany || "",
    customerName: header.customerName || "",
    customerPhone: header.customerPhone || "",
    customerEmail: header.customerEmail || "",
    estimatorName: header.estimatorName || "",
    bidDue: header.bidDue || "",
    scopeNotes: header.scopeNotes || "",
    terms: String(design.terms || "").trim(),
    lines,
    totals: Object.fromEntries(
      TOTAL_OPTIONS
        .filter((option) => visible[option.key])
        .map((option) => [option.key, moneyTotals[option.key]]),
    ),
    grandTotal: moneyTotals.total,
    subtotal: lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
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
    const material = qty * (Number(line.materialUnitCost) || 0);
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

function estimateContacts(branding, design, presentation) {
  const office = {
    title: "Office",
    name: branding.companyName,
    phone: branding.companyPhone,
    email: branding.companyEmail,
  };
  const employee = {
    title: String(design.companyEmployeeTitle || "Estimator").trim() || "Estimator",
    name: String(design.companyEmployeeName || presentation.estimatorName || "").trim(),
    phone: String(design.companyEmployeePhone || "").trim(),
    email: String(design.companyEmployeeEmail || "").trim(),
  };
  const contacts = [];
  if (office.name || office.phone || office.email) contacts.push(office);
  if (design.showCompanyCard !== false && (employee.name || employee.phone || employee.email)) {
    contacts.push(employee);
  }
  return contacts.slice(0, 4);
}

/**
 * Customer PDF layout matches Buildr created-estimate documents
 * (src/lib/documentPdf.js kind=estimate). Estim8r stays standalone.
 */
export function buildEstimatePdf(estimate, brandingInput) {
  const branding = brandingLayout(normalizeBranding(brandingInput));
  const presentation = estimatePresentation(estimate);
  const design = {
    showHeader: true,
    showProjectCard: true,
    showScope: true,
    showSignatures: true,
    showCompanyCard: true,
    ...(estimate?.pdfDesign || {}),
  };
  design.documentTitle = normalizeDocumentTitle(design.documentTitle);

  const headerBg = rgbTuple(branding.headerColor, [17, 24, 39]);
  const darkHeader = isDarkRgb(headerBg);
  const headerText = darkHeader ? [255, 255, 255] : [17, 24, 39];
  const headerSub = darkHeader ? [209, 213, 219] : [55, 65, 81];
  const headerAccent = darkHeader ? [249, 115, 22] : [234, 88, 12];
  const docBg = rgbTuple(branding.pageColor, [255, 255, 255]);
  const docText = rgbTuple(branding.textColor, [17, 24, 39]);
  const border = [229, 231, 235];
  const stripe = [249, 250, 251];
  const font = branding.font;
  const baseSize = Math.min(10, Math.max(9, Number(design.bodySize) || 10));

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentW = pageW - margin * 2;
  const footerReserve = 30;
  const bottomLimit = pageH - footerReserve;
  const strings = [];

  const box = resolveLogoBox(branding, design);
  let logoW = box.width;
  let logoH = box.height;
  const maxLogoH = 80;
  const maxLogoW = pageW - 72;
  if (logoW > maxLogoW || logoH > maxLogoH) {
    const scale = Math.min(maxLogoW / Math.max(logoW, 1), maxLogoH / Math.max(logoH, 1));
    logoW *= scale;
    logoH *= scale;
  }
  const reservedLogoH = branding.logoDataUrl ? logoH : 52;
  const headerPad = 16;
  const showHeader = design.showHeader !== false;
  const headerH = showHeader ? headerPad * 2 + reservedLogoH + 48 : 0;

  function write(text, x, y, options) {
    if (Array.isArray(text)) {
      const lines = text.map((line) => String(line ?? "")).filter(Boolean);
      lines.forEach((line) => strings.push(line));
      if (lines.length) doc.text(text, x, y, options);
      return;
    }
    const value = String(text ?? "");
    if (!value) return;
    strings.push(value);
    doc.text(value, x, y, options);
  }

  let allowPageBreak = false;
  let y = 0;

  const ensureSpace = (needed) => {
    if (y + needed <= bottomLimit) return;
    if (!allowPageBreak) return;
    doc.addPage();
    doc.setFillColor(...docBg);
    doc.rect(0, 0, pageW, pageH, "F");
    y = 48;
  };

  doc.setFillColor(...docBg);
  doc.rect(0, 0, pageW, pageH, "F");

  if (showHeader) {
    doc.setFillColor(...headerBg);
    doc.rect(0, 0, pageW, headerH, "F");
    y = headerPad;
    if (branding.logoDataUrl) {
      try {
        doc.addImage(
          branding.logoDataUrl,
          logoFormat(branding.logoDataUrl),
          (pageW - logoW) / 2,
          y,
          logoW,
          logoH,
        );
        y += logoH + 8;
      } catch {
        doc.setFont(font, "bold");
        doc.setFontSize(14);
        doc.setTextColor(...headerText);
        write(branding.companyName || "Company", pageW / 2, y + 14, { align: "center" });
        y += 26;
      }
    } else {
      doc.setFont(font, "bold");
      doc.setFontSize(14);
      doc.setTextColor(...headerText);
      write(branding.companyName || "Company", pageW / 2, y + 14, { align: "center" });
      y += 26;
    }

    doc.setDrawColor(...headerAccent);
    doc.setLineWidth(1);
    doc.line(margin + 48, y, pageW - margin - 48, y);
    y += 10;

    const contacts = estimateContacts(branding, design, presentation);
    const colW = contentW / Math.max(contacts.length, 1);
    contacts.forEach((contact, index) => {
      const cx = margin + colW * index + colW / 2;
      doc.setFont(font, "bold");
      doc.setFontSize(7);
      doc.setTextColor(...headerAccent);
      write(String(contact.title || "Contact").toUpperCase(), cx, y, { align: "center" });
      doc.setFont(font, "bold");
      doc.setFontSize(9);
      doc.setTextColor(...headerText);
      write(String(contact.name || branding.companyName || ""), cx, y + 11, { align: "center" });
      doc.setFont(font, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...headerSub);
      if (contact.phone) write(String(contact.phone), cx, y + 22, { align: "center" });
      if (contact.email) write(String(contact.email), cx, y + 32, { align: "center" });
    });
  }

  const scopeText = design.showScope === false
    ? ""
    : (presentation.scopeNotes || DEFAULT_SCOPE_TEXT);
  const scopeLines = scopeText ? doc.splitTextToSize(String(scopeText), contentW - 22) : [];
  const scopeLineCount = scopeLines.length;
  const termsText = presentation.terms || design.footerText || DEFAULT_TERMS_TEXT;
  const termsLines = termsText ? doc.splitTextToSize(termsText, contentW - 40) : [];
  const items = presentation.lines.length
    ? presentation.lines
    : [{ description: "No line items yet", quantity: 0, unitPrice: 0, amount: 0 }];

  const titleBlockH = 40;
  const cardH = 60;
  const scopeLineH = 11;
  const scopeH = scopeLines.length ? scopeLines.length * scopeLineH + 30 : 0;
  const rowH = 19;
  const tableH = rowH + items.length * rowH;
  const totalsH = 36;
  const termsH = termsLines.length ? termsLines.length * 10 + 14 : 0;
  const sigH = design.showSignatures === false ? 0 : SIG_BLOCK_H;

  const bodyStart = headerH + 8;
  const fixed = titleBlockH + cardH + scopeH + tableH + totalsH + termsH + sigH;
  const slots = 6;
  const available = Math.max(0, bottomLimit - bodyStart - fixed);
  const unit = available / slots;
  const clampGap = (base, share, min, max) => Math.round(Math.min(max, Math.max(min, base + share)));
  const gapTitle = clampGap(10, unit * 0.9, 10, 28);
  const gapCards = clampGap(8, unit, 8, 26);
  const gapScope = clampGap(8, unit, 8, 24);
  const gapTable = clampGap(8, unit, 8, 22);
  const gapTotals = clampGap(10, unit, 10, 26);
  const gapTerms = clampGap(12, unit * 1.1, 12, 32);

  y = headerH + gapTitle;
  const templateTitle = String(presentation.documentTitle || DEFAULT_DOCUMENT_TITLE).toUpperCase();

  doc.setFont(font, "bold");
  doc.setFontSize(17);
  doc.setTextColor(...docText);
  write(templateTitle, margin, y);

  const muted = softFill(docBg, docText, 0.45);
  doc.setFont(font, "normal");
  doc.setFontSize(baseSize - 1);
  doc.setTextColor(...muted);
  write(`#${presentation.estimateNumber || "—"}`, margin, y + 14);
  doc.setTextColor(...docText);

  const rightX = pageW - margin;
  doc.setFont(font, "normal");
  doc.setFontSize(baseSize - 1);
  write("Estimate Date", rightX, y - 2, { align: "right" });
  doc.setFont(font, "bold");
  write(fmtDate(presentation.estimateDate), rightX, y + 10, { align: "right" });
  doc.setFont(font, "normal");
  write("Valid Until", rightX, y + 22, { align: "right" });
  doc.setFont(font, "bold");
  write(fmtDate(presentation.bidDue), rightX, y + 34, { align: "right" });

  y = headerH + gapTitle + titleBlockH + gapCards;

  if (design.showProjectCard !== false) {
    const half = (contentW - 14) / 2;
    doc.setFillColor(...softFill(docBg, docText, 0.035));
    doc.roundedRect(margin, y, half, cardH, 5, 5, "F");
    doc.roundedRect(margin + half + 14, y, half, cardH, 5, 5, "F");
    doc.setDrawColor(...border);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, half, cardH, 5, 5, "S");
    doc.roundedRect(margin + half + 14, y, half, cardH, 5, 5, "S");

    doc.setFont(font, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    write("BILL TO", margin + 12, y + 16);
    doc.setFont(font, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...docText);
    write(presentation.customerName || presentation.customerCompany || "—", margin + 12, y + 32);
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    write(presentation.customerEmail || "", margin + 12, y + 46);

    const px = margin + half + 14;
    doc.setFont(font, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    write("PROJECT", px + 12, y + 16);
    doc.setFont(font, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...docText);
    write(doc.splitTextToSize(presentation.title || "—", half - 24)[0] || "—", px + 12, y + 32);
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    if (presentation.projectAddress) {
      write(doc.splitTextToSize(presentation.projectAddress, half - 24)[0], px + 12, y + 46);
    }
    y += cardH + gapScope;
  } else {
    y += Math.max(0, gapScope - 4);
  }

  if (scopeLines.length) {
    doc.setFillColor(...softFill(docBg, docText, 0.04));
    doc.roundedRect(margin, y, contentW, scopeH, 5, 5, "F");
    doc.setDrawColor(...border);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentW, scopeH, 5, 5, "S");
    doc.setFont(font, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    write("SCOPE OF WORK", margin + 12, y + 15);
    doc.setFont(font, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...docText);
    write(scopeLines, margin + 12, y + 28);
    y += scopeH + gapTable;
  } else {
    y += Math.max(0, gapTable - 4);
  }

  const keepSignaturesOnPage = scopeLineCount > 0 && scopeLineCount <= SCOPE_SAME_PAGE_MAX_LINES;
  allowPageBreak = false;

  const cols = [
    { key: "desc", label: "Description", w: contentW * 0.5 },
    { key: "qty", label: "Qty", w: contentW * 0.12, align: "center" },
    { key: "unit", label: "Unit Price", w: contentW * 0.19, align: "right" },
    { key: "total", label: "Total", w: contentW * 0.19, align: "right" },
  ];

  const drawTableHeader = () => {
    doc.setFillColor(...softFill(docBg, docText, 0.07));
    doc.rect(margin, y, contentW, rowH, "F");
    doc.setDrawColor(...border);
    doc.setLineWidth(0.6);
    doc.rect(margin, y, contentW, rowH, "S");
    let x = margin;
    doc.setFont(font, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...docText);
    cols.forEach((col) => {
      const tx = col.align === "right" ? x + col.w - 7 : col.align === "center" ? x + col.w / 2 : x + 7;
      write(col.label, tx, y + 13, col.align ? { align: col.align } : undefined);
      x += col.w;
    });
    y += rowH;
  };

  ensureSpace(rowH + 8);
  drawTableHeader();

  items.forEach((item, index) => {
    ensureSpace(rowH + 4);
    if (index % 2 === 1) {
      doc.setFillColor(...stripe);
      doc.rect(margin, y, contentW, rowH, "F");
    } else {
      doc.setFillColor(...docBg);
      doc.rect(margin, y, contentW, rowH, "F");
    }
    doc.setDrawColor(...border);
    doc.rect(margin, y, contentW, rowH, "S");
    const description = String(item.description || item.itemType || item.category || "");
    const values = [
      description,
      item.quantity === "" || item.quantity == null ? "" : String(item.quantity),
      item.unitPrice != null && item.unitPrice !== "" ? money(item.unitPrice) : "",
      money(item.amount),
    ];
    let x = margin;
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...docText);
    cols.forEach((col, colIndex) => {
      const tx = col.align === "right" ? x + col.w - 7 : col.align === "center" ? x + col.w / 2 : x + 7;
      const text = colIndex === 0 ? doc.splitTextToSize(values[colIndex], col.w - 12)[0] : values[colIndex];
      write(text || "", tx, y + 13, col.align ? { align: col.align } : undefined);
      x += col.w;
    });
    y += rowH;
  });

  y += gapTotals;
  const totalsX = pageW - margin - 190;
  ensureSpace(totalsH);
  doc.setFont(font, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...docText);
  write("Subtotal", totalsX, y);
  write(money(presentation.subtotal), pageW - margin, y, { align: "right" });
  y += 13;
  doc.setDrawColor(...border);
  doc.setLineWidth(1.1);
  doc.line(totalsX, y, pageW - margin, y);
  y += 14;
  doc.setFont(font, "bold");
  doc.setFontSize(11);
  write("ESTIMATE TOTAL", totalsX, y);
  doc.setTextColor(22, 163, 74);
  write(money(presentation.grandTotal), pageW - margin, y, { align: "right" });
  doc.setTextColor(...docText);
  y += gapTerms;

  if (termsLines.length && y + termsH + sigH <= bottomLimit) {
    doc.setFont(font, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...docText);
    write("Terms:", margin, y);
    doc.setFont(font, "normal");
    doc.setTextColor(...muted);
    write(termsLines, margin + 40, y);
    y += termsH;
  }

  if (design.showSignatures !== false) {
    if (!keepSignaturesOnPage && scopeLineCount > SCOPE_SAME_PAGE_MAX_LINES) {
      allowPageBreak = true;
    }
    const remaining = bottomLimit - y - sigH;
    if (remaining > 8) y += Math.min(remaining, gapTerms);
    if (y + sigH > bottomLimit) y = Math.max(headerH + 8, bottomLimit - sigH);

    const sigW = (contentW - 24) / 2;
    const leftSigX = margin;
    const rightSigX = margin + sigW + 24;
    const sigTop = y;
    const contractorName = design.companyEmployeeName || presentation.estimatorName || branding.companyName || "";
    const customerName = presentation.customerName || presentation.customerCompany || "";

    const drawSigBlock = (x, label, name) => {
      doc.setFont(font, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...docText);
      write(label, x, sigTop);
      const lineY = sigTop + 44;
      doc.setDrawColor(...docText);
      doc.setLineWidth(0.75);
      doc.line(x, lineY, x + sigW, lineY);
      doc.setFont(font, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...muted);
      write(name || "______________________________", x, lineY + 12);
      write("Date: ____________________", x, lineY + 24);
    };

    drawSigBlock(leftSigX, "Contractor Signature", contractorName);
    drawSigBlock(rightSigX, "Customer Signature", customerName);
  }

  doc.setFont(font, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  const footer = [branding.companyName, branding.companyPhone, branding.companyEmail].filter(Boolean).join(" · ");
  if (footer) write(footer, pageW / 2, pageH - 14, { align: "center" });

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
