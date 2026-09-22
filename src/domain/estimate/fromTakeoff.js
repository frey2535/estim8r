import { assignLaborHours } from "../labor/libraryDocument.js";
import { compositeWage, defaultCrew, journeymanWage } from "../labor/employeeClasses.js";
import { defaultProductivityFactors } from "../labor/productivity.js";
import { makeLaborSelection } from "../labor/selection.js";
import { fillEmptyHeader, headerFromDrawings } from "./fromDrawings.js";
import { applySavedLineOrder } from "./lineOrder.js";

export function estimateStorageKey(fileName, fileSize) {
  return `estim8r.estimate.v1:${fileName || "drawing"}:${fileSize || 0}`;
}

export const ACTIVE_ESTIMATE_KEY = "estim8r.estimate.active";
export const WAGE_BOOK_KEY = "estim8r.wagebook.v1";

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function itemTypeFor(category, unit) {
  if (unit === "LF" || category === "Raceway") return "Conduit";
  if (category === "Lighting") return "Fixture";
  if (category === "Panels / MCC") return "Gear";
  return "Device";
}

function makeLine({ takeoffKey, source, category, description, quantity, unit, rate }) {
  const labor = assignLaborHours({ category, symbol: description, unit });
  const selection = labor.mhPerUnit
    ? makeLaborSelection({
        laborItemId: labor.laborItemId,
        option: {
          sourceType: labor.sourceType || "experimental",
          mh: labor.mhPerUnit,
          sourceRecordId: labor.laborUnitId || "",
          sourceName: labor.sourceName,
          verificationStatus: labor.verificationStatus || "unverified",
          productionAllowed: false,
          warning: labor.note,
        },
        factors: defaultProductivityFactors(),
        acknowledgedUnverified: false,
      })
    : null;
  return {
    id: takeoffKey,
    takeoffKey,
    source,
    itemType: itemTypeFor(category, unit),
    category: category || "",
    description,
    quantity: round2(quantity),
    unit,
    materialUnitCost: 0,
    laborMhPerUnit: labor.mhPerUnit,
    laborRate: rate,
    laborItemId: labor.laborItemId,
    laborSource: labor.sourceName,
    laborSelection: selection,
    notes: labor.note,
    included: true,
    quantityEdited: false,
    laborRateEdited: false,
    laborMhEdited: false,
  };
}

export function linesFromRollup(rollup, rate) {
  const lines = [];
  for (const row of rollup?.rows || []) {
    const parts = [];
    if (row.count > 0) parts.push({ quantity: row.count, unit: "EA" });
    if (row.hasLength && row.lf > 0) parts.push({ quantity: row.lf, unit: "LF" });
    if (row.hasArea && row.sf > 0) parts.push({ quantity: row.sf, unit: "SF" });
    for (const part of parts) {
      lines.push(makeLine({
        takeoffKey: `${row.category}|${row.symbol}|${part.unit}`.toLowerCase(),
        source: "takeoff",
        category: row.category,
        description: row.symbol || row.category,
        quantity: part.quantity,
        unit: part.unit,
        rate,
      }));
    }
  }
  return lines;
}

export function linesFromDrawing(drawingDocs, rate) {
  const items = [...(drawingDocs?.symbols || []), ...(drawingDocs?.scheduleItems || [])];
  return items.map((item) => makeLine({
    takeoffKey: `drawing|${item.id}`,
    source: "drawing",
    category: item.category || "From drawing",
    description: item.label,
    quantity: 0,
    unit: "EA",
    rate,
  }));
}

export function scopeFromDrawing({ fileName, drawingDocs, pageCount }) {
  const pages = (drawingDocs?.pages || []).filter((page) => page.kind && page.kind !== "drawing");
  const pageBits = pages.slice(0, 8).map((page) => `${page.kind} p${page.page}`);
  const legend = (drawingDocs?.symbols || []).slice(0, 12).map((item) => item.abbr || item.label);
  const schedules = (drawingDocs?.scheduleItems || []).slice(0, 12).map((item) => item.abbr || item.label);
  const note = drawingDocs?.notes?.[0] || "";
  return [
    fileName ? `Drawing: ${fileName}` : "",
    pageCount ? `Sheets: ${pageCount}` : "",
    pageBits.length ? `Read: ${pageBits.join(", ")}` : "",
    legend.length ? `Legend: ${legend.join(", ")}` : "",
    schedules.length ? `Schedule types: ${schedules.join(", ")}` : "",
    note,
    "Line quantities copy the takeoff. Editing this estimate does not change the takeoff sheet.",
  ].filter(Boolean).join("\n");
}

function applyRate(line, rate) {
  if (line.laborRateEdited) return line;
  return { ...line, laborRate: rate };
}

export function mergeEstimate(existing, incomingLines) {
  const byKey = new Map((existing?.lines || []).map((line) => [line.takeoffKey || line.id, line]));
  const next = [];
  const seen = new Set();
  for (const incoming of incomingLines) {
    seen.add(incoming.takeoffKey);
    const prior = byKey.get(incoming.takeoffKey);
    if (!prior) {
      next.push(incoming);
      continue;
    }
    next.push({
      ...prior,
      quantity: prior.quantityEdited ? prior.quantity : incoming.quantity,
      unit: prior.quantityEdited ? prior.unit : incoming.unit,
      laborMhPerUnit: prior.laborMhEdited ? prior.laborMhPerUnit : incoming.laborMhPerUnit,
      laborSource: prior.laborSource || incoming.laborSource,
      laborItemId: prior.laborItemId || incoming.laborItemId,
      laborSelection: prior.laborSelection || undefined,
      notes: prior.notes || incoming.notes,
    });
  }
  for (const line of existing?.lines || []) {
    const key = line.takeoffKey || line.id;
    if (seen.has(key)) continue;
    if (line.source === "drawing" && !line.quantityEdited && Number(line.quantity) === 0 && incomingLines.some((item) => item.source === "takeoff")) {
      continue;
    }
    next.push(line);
  }
  return applySavedLineOrder(next, (existing?.lines || []).map((line) => line.id));
}

export function buildEstimateDraft({ fileName, fileSize, drawingDocs, rollup, pageCount, wageBook, markup }) {
  const crew = defaultCrew(wageBook);
  const rate = compositeWage(crew).rate || journeymanWage(crew);
  const takeoffLines = linesFromRollup(rollup, rate);
  const drawingLines = takeoffLines.length ? [] : linesFromDrawing(drawingDocs, rate);
  const base = fileName ? String(fileName).replace(/\.[^.]+$/, "") : "Drawing estimate";
  const fromDrawings = headerFromDrawings({ fileName, drawingDocs, markup });
  return {
    version: 1,
    fileName: fileName || "",
    fileSize: fileSize || 0,
    header: {
      projectName: fromDrawings.projectName || base,
      projectAddress: fromDrawings.projectAddress,
      estimateNumber: fromDrawings.estimateNumber,
      customerCompany: fromDrawings.customerCompany,
      customerName: fromDrawings.customerName,
      customerPhone: fromDrawings.customerPhone,
      customerEmail: fromDrawings.customerEmail,
      estimatorName: "",
      bidDue: "",
      scopeNotes: scopeFromDrawing({ fileName, drawingDocs, pageCount }),
    },
    crew,
    factors: defaultProductivityFactors(),
    namedCrewId: null,
    overhead: 10,
    profit: 10,
    lines: [...takeoffLines, ...drawingLines],
    itemized: false,
    visibleTotals: undefined,
    separateFromTakeoff: true,
    scopeEdited: false,
  };
}

export function syncEstimateDraft(existing, input) {
  const wageBook = input.wageBook || {};
  const crew = existing?.crew?.length ? existing.crew : defaultCrew(wageBook);
  const rate = compositeWage(crew).rate || journeymanWage(crew);
  const takeoffLines = linesFromRollup(input.rollup, rate).map((line) => applyRate(line, rate));
  const drawingLines = takeoffLines.length ? [] : linesFromDrawing(input.drawingDocs, rate).map((line) => applyRate(line, rate));
  const incoming = [...takeoffLines, ...drawingLines];
  if (!existing) return buildEstimateDraft(input);
  const fromDrawings = headerFromDrawings(input);
  return {
    ...existing,
    crew,
    header: fillEmptyHeader({
      ...existing.header,
      scopeNotes: existing.scopeEdited ? existing.header?.scopeNotes : scopeFromDrawing(input),
    }, fromDrawings, { fileName: input.fileName }),
    lines: mergeEstimate(existing, incoming).map((line) => applyRate(line, rate)),
    separateFromTakeoff: true,
  };
}
