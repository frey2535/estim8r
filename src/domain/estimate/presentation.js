export const DEFAULT_VISIBLE_TOTALS = {
  material: true,
  labor: true,
  contingency: false,
  overhead: false,
  profit: false,
  bondInsurance: false,
  total: true,
};

export const TOTAL_OPTIONS = [
  { key: "material", label: "Material Total" },
  { key: "labor", label: "Labor Total" },
  { key: "contingency", label: "Contingency" },
  { key: "overhead", label: "Overhead" },
  { key: "profit", label: "Profit" },
  { key: "bondInsurance", label: "Bond / Insurance" },
  { key: "total", label: "Total" },
];

export function resolveVisibleTotals(estimate) {
  return { ...DEFAULT_VISIBLE_TOTALS, ...(estimate?.visibleTotals || {}) };
}

export function lineIncluded(line, estimate) {
  if (!estimate?.itemized) return true;
  return line?.included !== false;
}

export function includedLines(estimate) {
  return (estimate?.lines || []).filter((line) => lineIncluded(line, estimate));
}

export function setAllLinesIncluded(lines, included) {
  return (lines || []).map((line) => ({ ...line, included: Boolean(included) }));
}
