import { DEFAULT_DROP_FEET } from "./catalog.js";
import { areaFromPercent, feetFromPercent, polygonArea, polylineLength } from "./geometry.js";
import { junctionHardwareRows, isJunctionBoxMark } from "./junctionHardware.js";
import { isReviewOnlyMark } from "./detectionRecord.js";
import { DEFAULT_LINE_SIZE, resolvedLineSize } from "./sizes.js";
import { applyTypicalMultiplier } from "./liveLinkedTakeoff.js";

const LENGTH_TYPES = new Set(["line", "route", "homerun", "measure"]);

function calibrationForMark(mark, calibration) {
  if (mark?.calibration?.feet) return mark.calibration;
  if (calibration && !calibration.feet && typeof calibration === "object") {
    return calibration[mark?.sheet || 1] || null;
  }
  return calibration || null;
}

/**
 * @param {any} mark
 * @param {any} calibration
 * @param {any} aspect
 */
export function markLengthFeet(mark, calibration, aspect) {
  if (mark?.lengthEdited && mark.storedFeet != null && mark.storedFeet !== "") return Number(mark.storedFeet);
  const resolvedCalibration = calibrationForMark(mark, calibration);
  if (!LENGTH_TYPES.has(mark.type) && mark.type !== "drop") return null;
  if (mark.type === "drop") {
    if (mark.feet != null) return Number(mark.feet);
    return resolvedCalibration ? DEFAULT_DROP_FEET : null;
  }
  const points = mark.points || [];
  const percent = polylineLength(points, aspect);
  const feet = feetFromPercent(percent, resolvedCalibration);
  if (feet == null) return null;
  const runs = Number(mark.parallelRuns) || 1;
  return feet * Math.max(1, runs);
}

/**
 * @param {any} mark
 * @param {any} calibration
 * @param {any} aspect
 */
export function markAreaFeet(mark, calibration, aspect) {
  if (mark.type !== "area") return null;
  return areaFromPercent(polygonArea(mark.points || [], aspect), calibrationForMark(mark, calibration));
}

/**
 * @param {any} marks
 * @param {any} calibration
 * @param {any} aspect
 * @param {any} sheet
 */
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
    if (mark.bidUse === false) continue;
    if (mark.type === "note" || mark.type === "cloud" || mark.type === "measure") {
      if (mark.type === "note" || mark.type === "cloud") rowFor(mark).notes += 1;
      continue;
    }
    // Junction boxes roll up as a single total row; EMT connectors are derived, not drawn as marks.
    if (isJunctionBoxMark(mark)) continue;
    const row = rowFor(mark);
    if (mark.type === "count" || mark.type === "drop") {
      if (isReviewOnlyMark(mark)) continue;
      row.count += 1;
    }
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

  const hardware = junctionHardwareRows(scoped);
  const list = applyTypicalMultiplier([...rows.values(), ...hardware.rows], scoped)
    .sort((a, b) => a.category.localeCompare(b.category) || a.symbol.localeCompare(b.symbol));
  const totals = list.reduce((acc, row) => {
    acc.count += row.count;
    acc.lf += row.lf;
    acc.sf += row.sf;
    return acc;
  }, { count: 0, lf: 0, sf: 0 });

  const calibrated = scoped.length ? scoped.every((mark) => Boolean(calibrationForMark(mark, calibration)?.feet) || !mark.points?.length) : Boolean(calibration?.feet || Object.values(calibration || {}).some((item) => item?.feet));
  return {
    rows: list,
    totals,
    calibrated,
    junctionBoxes: hardware.junctionBoxes,
    emtConnectors: hardware.emtConnectors,
  };
}

/**
 * @param {any} rollup
 * @param {any} edits
 */
export function applyScheduleEdits(rollup, edits = {}) {
  const keys = Object.keys(edits || {});
  if (!keys.length) return rollup;
  const rows = rollup.rows.map((row) => {
    const edit = edits[`${row.category}|${row.symbol}`];
    if (!edit) return row;
    const count = edit.count != null && edit.count !== "" ? Number(edit.count) : row.count;
    const lf = edit.lf != null && edit.lf !== "" ? Number(edit.lf) : row.lf;
    const sf = edit.sf != null && edit.sf !== "" ? Number(edit.sf) : row.sf;
    return {
      ...row,
      symbol: edit.symbol || row.symbol,
      category: edit.category || row.category,
      count,
      lf,
      sf,
      hasLength: edit.lf != null && edit.lf !== "" ? true : row.hasLength,
      hasArea: edit.sf != null && edit.sf !== "" ? true : row.hasArea,
    };
  });
  const totals = rows.reduce((acc, row) => {
    acc.count += Number(row.count) || 0;
    acc.lf += Number(row.lf) || 0;
    acc.sf += Number(row.sf) || 0;
    return acc;
  }, { count: 0, lf: 0, sf: 0 });
  return { ...rollup, rows, totals };
}

/**
 * @param {any} marks
 */
export function nextConduitRunNumber(marks) {
  const nums = (marks || []).filter(isConduitMark).map((mark) => Number(mark.runNumber) || 0);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

/**
 * @param {any} mark
 */
export function isConduitMark(mark) {
  return mark?.tool === "conduit" || (mark?.type === "route" && mark?.tool === "conduit");
}

/**
 * @param {any} marks
 * @param {any} calibration
 * @param {any} aspect
 * @param {any} globalLineSize
 */
export function conduitRuns(marks, calibration, aspect = 1, globalLineSize = DEFAULT_LINE_SIZE) {
  return (marks || []).filter(isConduitMark).map((mark, index) => {
    const lf = markLengthFeet(mark, calibration, aspect);
    return {
      id: mark.id,
      runNumber: mark.runNumber || index + 1,
      sheet: mark.sheet || 1,
      type: Number(mark.parallelRuns) > 1
        ? `${mark.parallelRuns}× ${mark.symbolLabel || mark.symbol || "Conduit"}`
        : (mark.symbolLabel || mark.symbol || "Conduit"),
      parallelRuns: Number(mark.parallelRuns) || 1,
      size: mark.conduitSize || "",
      material: mark.conduitMaterial || "",
      color: mark.color || "#2563eb",
      thickness: resolvedLineSize(mark, globalLineSize),
      lf: lf == null ? 0 : lf,
      calibrated: lf != null,
    };
  });
}

/**
 * @param {any} runs
 */
export function projectConduitTotal(runs) {
  return (runs || []).reduce((sum, run) => sum + (Number(run.lf) || 0), 0);
}

/**
 * @param {any} rollup
 * @param {any} runs
 */
export function quantitiesToCsv(rollup, runs = []) {
  const header = "Category,Symbol,Count,LF,SF";
  const lines = rollup.rows.map((row) => [
    csv(row.category),
    csv(row.symbol),
    row.count,
    row.hasLength ? row.lf.toFixed(2) : "",
    row.hasArea ? row.sf.toFixed(2) : "",
  ].join(","));
  lines.push(["TOTAL", "", rollup.totals.count, rollup.totals.lf.toFixed(2), rollup.totals.sf.toFixed(2)].join(","));
  if (runs.length) {
    lines.push("");
    lines.push("Conduit run,Sheet,Type,LF");
    for (const run of runs) {
      lines.push([`Run ${run.runNumber}`, run.sheet, csv(run.type), run.lf.toFixed(2)].join(","));
    }
    lines.push(["PROJECT CONDUIT TOTAL", "", "", projectConduitTotal(runs).toFixed(2)].join(","));
  }
  return [header, ...lines].join("\n");
}

function csv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
