import {
  estimateLineHours,
  estimateLineLaborCost,
  findLibraryItem,
  laborInstallQuantity,
} from "../estimate/manualLineLabor.js";
import { includedLines } from "../estimate/presentation.js";
import {
  ALLOWED_REFERENCE_FAMILIES,
  EXPERIMENTAL_LABOR_SOURCE,
  SOURCE_LABELS,
  conditionMh,
  findVerifiedMarketReferences,
  isLicensedNeca,
  referenceEdition,
  referenceSourceName,
  sourceBadges,
} from "./sources.js";

export const NO_VERIFIED_MARKET_REFERENCE = "No verified market reference";

export const MARKET_COMPARE_WHY = "Market hours come only from a verified published labor unit (labor_units / labor_reference_units equivalent) that names its source and edition. The 1,921 imported rows are Estim8r Experimental / UNVERIFIED and never become a market average. Estim8r does not invent a national average, scrape prices, or populate NECA unless licensed.";

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function text(value) {
  return String(value || "").trim();
}

function mhPerInstallUnit(item, mh) {
  if (mh == null) return null;
  if (item?.unit === "100 LF") return Number(mh) / 100;
  if (item?.unit === "1000 LF") return Number(mh) / 1000;
  return Number(mh);
}

function referenceRange(unit, item) {
  const values = ["normal", "difficult", "very_difficult"]
    .map((condition) => mhPerInstallUnit(item, conditionMh(unit, condition)))
    .filter((value) => value != null && Number.isFinite(value));
  if (!values.length) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const average = mhPerInstallUnit(item, conditionMh(unit, "normal")) ?? values[0];
  return {
    averageMhPerUnit: round(average),
    lowMhPerUnit: round(low),
    highMhPerUnit: round(high),
  };
}

function flagVersus(value, low, high) {
  if (value == null || low == null || high == null) return "none";
  if (value > high) return "high";
  if (value < low) return "low";
  return "in_line";
}

export function laborSourcePresentation(line, laborItem) {
  const selection = line?.laborSelection;
  const sourceType = selection?.selectedSource
    || laborItem?.labor_units?.[0]?.source_type
    || (line?.laborItemId ? "experimental" : "");
  const verificationStatus = selection?.verificationStatus
    || laborItem?.labor_units?.[0]?.verification_status
    || "";
  const badges = sourceType ? sourceBadges({ sourceType, verificationStatus }) : [];
  if (!sourceType && line?.laborMatchStatus === "unmatched") {
    badges.push("UNVERIFIED");
  }
  return {
    sourceType,
    sourceName: selection?.sourceName || line?.laborSource || "",
    edition: selection?.sourceYear || "",
    verificationStatus,
    badges,
    label: SOURCE_LABELS[sourceType] || selection?.sourceName || line?.laborSource || "",
  };
}

export function compareLineToMarket(line, laborItem, { licensedNeca = isLicensedNeca() } = {}) {
  const source = laborSourcePresentation(line, laborItem);
  const hours = estimateLineHours(line, laborItem);
  const labor = estimateLineLaborCost(line, laborItem);
  const rate = Number(line?.laborRate) || 0;
  const references = findVerifiedMarketReferences(laborItem, { licensedNeca });
  const reference = references[0] || null;

  if (!reference) {
    return {
      source,
      estimateHours: hours,
      estimateLabor: labor,
      hasReference: false,
      message: NO_VERIFIED_MARKET_REFERENCE,
      why: MARKET_COMPARE_WHY,
      reference: null,
      references: [],
      flag: "none",
      laborFlag: "none",
    };
  }

  const range = referenceRange(reference, laborItem);
  const installQty = laborInstallQuantity(line, laborItem);
  const refHoursLow = round(installQty * range.lowMhPerUnit);
  const refHoursHigh = round(installQty * range.highMhPerUnit);
  const refHours = round(installQty * range.averageMhPerUnit);
  const refLaborLow = roundMoney(refHoursLow * rate);
  const refLaborHigh = roundMoney(refHoursHigh * rate);
  const refLabor = roundMoney(refHours * rate);
  const flag = flagVersus(hours, refHoursLow, refHoursHigh);
  const laborFlag = flagVersus(labor, refLaborLow, refLaborHigh);

  return {
    source,
    estimateHours: hours,
    estimateLabor: labor,
    hasReference: true,
    message: `${referenceSourceName(reference)} ${referenceEdition(reference)}`,
    why: MARKET_COMPARE_WHY,
    reference: {
      id: reference.id,
      sourceType: reference.source_type,
      sourceName: referenceSourceName(reference),
      edition: referenceEdition(reference),
      sourceReference: text(reference.source_reference),
      verificationStatus: reference.verification_status,
      badge: "REFERENCE",
      allowedFamily: ALLOWED_REFERENCE_FAMILIES.includes(referenceSourceName(reference)) ? referenceSourceName(reference) : "Other",
      mhPerUnit: range.averageMhPerUnit,
      lowMhPerUnit: range.lowMhPerUnit,
      highMhPerUnit: range.highMhPerUnit,
      hours: refHours,
      hoursLow: refHoursLow,
      hoursHigh: refHoursHigh,
      labor: refLabor,
      laborLow: refLaborLow,
      laborHigh: refLaborHigh,
    },
    references: references.map((unit) => {
      const next = referenceRange(unit, laborItem);
      return {
        id: unit.id,
        sourceName: referenceSourceName(unit),
        edition: referenceEdition(unit),
        sourceReference: text(unit.source_reference),
        mhPerUnit: next.averageMhPerUnit,
        hours: round(installQty * next.averageMhPerUnit),
        labor: roundMoney(installQty * next.averageMhPerUnit * rate),
      };
    }),
    flag,
    laborFlag,
  };
}

export function compareEstimateToMarket(estimate, items = [], options) {
  const lines = includedLines(estimate);
  const compared = [];
  let estimateHours = 0;
  let estimateLabor = 0;
  let comparableHours = 0;
  let comparableLabor = 0;
  let refHours = 0;
  let refHoursLow = 0;
  let refHoursHigh = 0;
  let refLabor = 0;
  let refLaborLow = 0;
  let refLaborHigh = 0;
  let referenced = 0;

  for (const line of lines) {
    const item = findLibraryItem(items, line);
    const comparison = compareLineToMarket(line, item, options);
    estimateHours += comparison.estimateHours;
    estimateLabor += comparison.estimateLabor;
    compared.push({
      id: line.id,
      description: line.description,
      ...comparison,
    });
    if (comparison.hasReference) {
      referenced += 1;
      comparableHours += comparison.estimateHours;
      comparableLabor += comparison.estimateLabor;
      refHours += comparison.reference.hours;
      refHoursLow += comparison.reference.hoursLow;
      refHoursHigh += comparison.reference.hoursHigh;
      refLabor += comparison.reference.labor;
      refLaborLow += comparison.reference.laborLow;
      refLaborHigh += comparison.reference.laborHigh;
    }
  }

  const hasReference = referenced > 0;
  return {
    lineCount: lines.length,
    referencedLineCount: referenced,
    unmatchedLineCount: lines.filter((line) => line.laborMatchStatus === "unmatched").length,
    emptyLineCount: lines.filter((line) => !line.laborItemId).length,
    estimateHours: round(estimateHours),
    estimateLabor: roundMoney(estimateLabor),
    comparableHours: round(comparableHours),
    comparableLabor: roundMoney(comparableLabor),
    hasReference,
    message: hasReference
      ? `${referenced} of ${lines.length} included line${lines.length === 1 ? "" : "s"} ${referenced === 1 ? "has" : "have"} a verified market reference. High/low uses only those lines.`
      : NO_VERIFIED_MARKET_REFERENCE,
    why: MARKET_COMPARE_WHY,
    reference: hasReference
      ? {
          hours: round(refHours),
          hoursLow: round(refHoursLow),
          hoursHigh: round(refHoursHigh),
          labor: roundMoney(refLabor),
          laborLow: roundMoney(refLaborLow),
          laborHigh: roundMoney(refLaborHigh),
        }
      : null,
    flag: hasReference ? flagVersus(round(comparableHours), round(refHoursLow), round(refHoursHigh)) : "none",
    laborFlag: hasReference ? flagVersus(roundMoney(comparableLabor), roundMoney(refLaborLow), roundMoney(refLaborHigh)) : "none",
    lines: compared,
  };
}

export function flagLabel(flag) {
  if (flag === "high") return "High vs reference";
  if (flag === "low") return "Low vs reference";
  if (flag === "in_line") return "In line with reference";
  return "";
}

export { EXPERIMENTAL_LABOR_SOURCE };
