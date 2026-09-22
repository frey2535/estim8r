import { findLibraryItem, laborItemLabel } from "./manualLineLabor.js";
import { supplyQuoteFileBase } from "../takeoff/supplyQuote.js";

export function estimateLineHasQuoteData(line) {
  if (!line) return false;
  return Boolean(
    String(line.itemType || "").trim()
    || String(line.category || "").trim()
    || String(line.description || "").trim()
    || String(line.laborItemId || "").trim()
    || String(line.model || "").trim(),
  );
}

export function knownEstimateModel(line) {
  const raw = line?.model ?? line?.modelNumber ?? line?.catalogNumber ?? line?.catalogNo ?? "";
  return String(raw).trim();
}

export function estimateQuoteDevice(line) {
  return String(line?.category || line?.itemType || "").trim();
}

export function estimateQuoteDescription(line, laborItem) {
  return String(line?.description || "").trim() || laborItemLabel(laborItem) || "Line";
}

export function buildEstimateSupplyQuote({
  lines = [],
  itemized = false,
  library = [],
  projectName = "",
  fileName = "",
} = {}) {
  const rows = [];
  for (const line of lines) {
    if (itemized && line.included === false) continue;
    if (!estimateLineHasQuoteData(line)) continue;
    const laborItem = findLibraryItem(library, line);
    rows.push({
      id: line.id,
      device: estimateQuoteDevice(line),
      model: knownEstimateModel(line),
      description: estimateQuoteDescription(line, laborItem),
      quantity: Number(line.quantity) || 0,
      unit: line.unit || "",
    });
  }
  const quantity = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const name = String(projectName || "").trim()
    || String(fileName || "").replace(/^standalone:/, "").replace(/\.[^.]+$/, "")
    || "Estimate";
  return {
    title: "Supply house material quote",
    projectName: name,
    fileBase: supplyQuoteFileBase(name),
    generatedAt: new Date().toISOString(),
    emptyDescription: "No estimate lines yet",
    modelNote: "Model numbers are only listed when entered on the estimate line.",
    totalLabel: `Total ${quantity}`,
    rows,
    totals: { quantity, items: rows.length },
  };
}
