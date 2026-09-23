import { calculateEffectiveMhPerUnit, calculateEstimatedHours } from "./laborEngine.js";
import { conditionMh, findVerifiedMarketReference, isExperimentalSource, isProductionSafeLabor, SOURCE_LABELS } from "./sources.js";
import { productivitySummary } from "./productivity.js";

export function emptyPublishedReference() {
  return {
    sourceType: "published_reference",
    label: SOURCE_LABELS.published_reference,
    available: false,
    mh: null,
    sampleSize: null,
    confidenceLevel: null,
    verificationStatus: "unverified",
    productionAllowed: false,
    sourceName: "",
    sourceYear: "",
    badges: ["UNVERIFIED"],
    warning: "No verified market reference. NECA values are not populated.",
  };
}

export function buildLaborSourceOptions({
  laborItem,
  companyUnit = null,
  customUnit = null,
  condition = "normal",
} = {}) {
  const experimentalUnit = (laborItem?.labor_units || []).find((unit) => (
    isExperimentalSource(unit.source_type) && unit.normal_mh != null
  )) || (laborItem?.labor_units || []).find((unit) => isExperimentalSource(unit.source_type)) || null;

  const publishedUnit = findVerifiedMarketReference(laborItem);
  const published = publishedUnit
    ? {
        sourceType: "published_reference",
        label: SOURCE_LABELS.published_reference,
        available: conditionMh(publishedUnit, condition) != null,
        mh: conditionMh(publishedUnit, condition),
        sampleSize: null,
        confidenceLevel: null,
        verificationStatus: "verified",
        productionAllowed: true,
        sourceRecordId: publishedUnit.id,
        sourceName: publishedUnit.source_name,
        sourceYear: publishedUnit.source_year || "",
        badges: ["REFERENCE"],
        warning: `${publishedUnit.source_name} ${publishedUnit.source_year || ""}`.trim(),
        unit: publishedUnit,
      }
    : emptyPublishedReference();

  const company = companyUnit
    ? {
        sourceType: "company_history",
        label: SOURCE_LABELS.company_history,
        available: conditionMh(companyUnit, condition) != null,
        mh: conditionMh(companyUnit, condition),
        sampleSize: companyUnit.sample_size ?? companyUnit.sampleSize ?? 0,
        confidenceLevel: companyUnit.confidence_level ?? companyUnit.confidenceLevel ?? 0,
        verificationStatus: companyUnit.approved_at || companyUnit.approvedAt ? "verified" : "unverified",
        productionAllowed: Boolean(companyUnit.approved_at || companyUnit.approvedAt),
        sourceRecordId: companyUnit.id,
        sourceName: "Company historical labor",
        sourceYear: "",
        badges: companyUnit.approved_at || companyUnit.approvedAt ? ["COMPANY"] : ["COMPANY", "UNVERIFIED"],
        warning: null,
      }
    : {
        sourceType: "company_history",
        label: SOURCE_LABELS.company_history,
        available: false,
        mh: null,
        sampleSize: 0,
        confidenceLevel: 0,
        verificationStatus: "unverified",
        productionAllowed: false,
        badges: ["COMPANY", "UNVERIFIED"],
        warning: "No company historical labor for this item yet.",
      };

  const experimental = experimentalUnit
    ? {
        sourceType: "experimental",
        label: SOURCE_LABELS.experimental,
        available: conditionMh(experimentalUnit, condition) != null,
        mh: conditionMh(experimentalUnit, condition),
        sampleSize: null,
        confidenceLevel: null,
        verificationStatus: "unverified",
        productionAllowed: false,
        sourceRecordId: experimentalUnit.id,
        sourceName: experimentalUnit.source_name,
        sourceYear: experimentalUnit.source_year || "",
        badges: ["ESTIM8R", "UNVERIFIED"],
        warning: "Experimental / unverified. Requires acknowledgement before treating as bid labor.",
        unit: experimentalUnit,
      }
    : {
        sourceType: "experimental",
        label: SOURCE_LABELS.experimental,
        available: false,
        mh: null,
        badges: ["ESTIM8R", "UNVERIFIED"],
        warning: "No experimental imported labor for this item.",
      };

  const custom = customUnit
    ? {
        sourceType: "custom",
        label: SOURCE_LABELS.custom,
        available: conditionMh(customUnit, condition) != null,
        mh: conditionMh(customUnit, condition),
        sampleSize: null,
        confidenceLevel: null,
        verificationStatus: "unverified",
        productionAllowed: false,
        sourceRecordId: customUnit.id,
        sourceName: "Custom labor",
        sourceYear: "",
        badges: ["CUSTOM", "UNVERIFIED"],
        warning: "Estimator-entered custom labor.",
      }
    : {
        sourceType: "custom",
        label: SOURCE_LABELS.custom,
        available: false,
        mh: null,
        badges: ["CUSTOM", "UNVERIFIED"],
        warning: "No custom labor saved for this item. Enter hours to create one.",
      };

  return [published, company, experimental, custom];
}

export function makeLaborSelection({
  laborItemId = "",
  option,
  condition = "normal",
  factors = [],
  estimatorOverrideMhPerUnit = null,
  overrideReason = "",
  acknowledgedUnverified = false,
} = {}) {
  const baseMhPerUnit = option?.mh == null ? 0 : Number(option.mh);
  const selection = {
    laborItemId,
    selectedSource: option?.sourceType || "experimental",
    condition,
    baseMhPerUnit,
    factors,
    estimatorOverrideMhPerUnit,
    sourceLaborUnitId: option?.sourceType === "experimental" ? (option.sourceRecordId || "") : "",
    sourceCompanyLaborUnitId: option?.sourceType === "company_history" ? (option.sourceRecordId || "") : "",
    sourceRecordId: option?.sourceRecordId || "",
    overrideReason,
    sourceName: option?.sourceName || SOURCE_LABELS[option?.sourceType] || "",
    sourceYear: option?.sourceYear || "",
    verificationStatus: option?.verificationStatus || "unverified",
    acknowledgedUnverified,
    notes: option?.warning || "",
  };
  const computed = calculateEffectiveMhPerUnit(selection);
  return {
    ...selection,
    factorMultiplier: computed.factorMultiplier,
    calculatedMhPerUnit: computed.calculatedMhPerUnit,
    effectiveMhPerUnit: computed.effectiveMhPerUnit,
    isOverride: computed.isOverride,
    productionSafe: isProductionSafeLabor({
      verificationStatus: selection.verificationStatus,
      productionAllowed: option?.productionAllowed,
      sourceType: selection.selectedSource,
    }),
  };
}

export function applySelectionToLine(line, selection, { rate } = {}) {
  const quantity = Number(line.quantity) || 0;
  const hours = calculateEstimatedHours({
    quantity,
    quantityPerLaborUnit: 1,
    selection,
  });
  const laborRate = line.laborRateEdited ? line.laborRate : (rate ?? line.laborRate);
  return {
    ...line,
    laborSelection: selection,
    laborItemId: selection.laborItemId || line.laborItemId || "",
    laborSource: selection.sourceName || line.laborSource || "",
    laborMhPerUnit: hours.effectiveMhPerUnit,
    laborRate,
    notes: selection.notes || line.notes,
    laborMhEdited: selection.estimatorOverrideMhPerUnit != null,
  };
}

export function lineLaborHours(line, factors) {
  const qty = Number(line.quantity) || 0;
  const selection = line.laborSelection;
  if (selection) {
    const next = factors ? { ...selection, factors } : selection;
    return calculateEstimatedHours({
      quantity: qty,
      quantityPerLaborUnit: 1,
      selection: next,
    });
  }
  const mh = Number(line.laborMhPerUnit) || 0;
  const summary = productivitySummary(factors || []);
  const calculated = mh * (selection ? summary.multiplier : 1);
  return {
    quantity: qty,
    laborUnits: qty,
    baseMhPerUnit: mh,
    factorMultiplier: 1,
    calculatedMhPerUnit: mh,
    effectiveMhPerUnit: mh,
    estimatedHours: Math.round((qty * calculated + Number.EPSILON) * 10000) / 10000,
    isOverride: Boolean(line.laborMhEdited),
  };
}
