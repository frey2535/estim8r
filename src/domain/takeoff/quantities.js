import { DEFAULT_DROP_FEET } from "./catalog";
import { areaFromPercent, feetFromPercent, polygonArea, polylineLength } from "./geometry";

const LENGTH_TYPES = new Set(["line", "route", "homerun", "measure"]);

export function markLengthFeet(mark, calibration, aspect) {
  if (!LENGTH_TYPES.has(mark.type) && mark.type !== "drop") return null;
  if (mark.type === "drop") {
    if (mark.feet != null) return Number(mark.feet);
    return calibration ? DEFAULT_DROP_FEET : null;
  }
  const points = mark.points || [];
  const percent = polylineLength(points, aspect);
  return feetFromPercent(percent, calibration);
}

export function markAreaFeet(mark, calibration, aspect) {
  if (mark.type !== "area") return null;
  return areaFromPercent(polygonArea(mark.points || [], aspect), calibration);
}

export function rollupTakeoff(marks, calibration, aspect = 1, sheet = null) {
  const scoped = (marks || []).filter((mark) => sheet == null || mark.sheet === sheet);
  const rows = new Map();

  const rowFor = (mark) => {
    const key = `${mark.category || "Uncategorized"}|${mark.symbolLabel || mark.symbol || ""}`;
    if (!rows.has(key)) {
      rows.set(key, {
        category: mark.category || "Uncategorized",
        symbol: mark.symbolLabel || mark.symbol || "",
        count: 0,
        lf: 0,
        sf: 0,
        notes: 0,
        hasLength: false,
        hasArea: false,
      });
    }
    return rows.get(key);
  };

  for (const mark of scoped) {
    if (mark.type === "note" || mark.type === "cloud" || mark.type === "measure") {
      if (mark.type === "note" || mark.type === "cloud") rowFor(mark).notes += 1;
      continue;
    }
    const row = rowFor(mark);
    if (mark.type === "count" || mark.type === "drop") row.count += 1;
    const lf = markLengthFeet(mark, calibration, aspect);
    if (lf != null) {
      row.lf += lf;
      row.hasLength = true;
    }
    const sf = markAreaFeet(mark, calibration, aspect);
    if (sf != null) {
      row.sf += sf;
      row.hasArea = true;
    }
  }

  const list = [...rows.values()].sort((a, b) => a.category.localeCompare(b.category) || a.symbol.localeCompare(b.symbol));
  const totals = list.reduce((acc, row) => {
    acc.count += row.count;
    acc.lf += row.lf;
    acc.sf += row.sf;
    return acc;
  }, { count: 0, lf: 0, sf: 0 });

  return { rows: list, totals, calibrated: Boolean(calibration?.feet) };
}

export function quantitiesToCsv(rollup) {
  const header = "Category,Symbol,Count,LF,SF";
  const lines = rollup.rows.map((row) => [
    csv(row.category),
    csv(row.symbol),
    row.count,
    row.hasLength ? row.lf.toFixed(2) : "",
    row.hasArea ? row.sf.toFixed(2) : "",
  ].join(","));
  lines.push(["TOTAL", "", rollup.totals.count, rollup.totals.lf.toFixed(2), rollup.totals.sf.toFixed(2)].join(","));
  return [header, ...lines].join("\n");
}

function csv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
