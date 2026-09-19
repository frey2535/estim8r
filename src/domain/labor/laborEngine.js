import {
  EstimateLaborSelectionSchema,
  LaborCondition,
  LaborUnitSchema,
  ProductionHistorySchema,
} from './types.js';

const conditionField = {
  normal: 'normalMh',
  difficult: 'difficultMh',
  very_difficult: 'veryDifficultMh',
};

export function assertProductionSafeLaborUnit(input) {
  const laborUnit = LaborUnitSchema.parse(input);

  if (laborUnit.verificationStatus !== 'verified' || !laborUnit.productionAllowed) {
    const error = new Error(
      `Labor unit ${laborUnit.id} is not approved for production estimating.`
    );
    error.code = 'LABOR_UNIT_NOT_PRODUCTION_READY';
    error.laborUnit = laborUnit;
    throw error;
  }

  return laborUnit;
}

export function getConditionMh(laborUnitInput, conditionInput = 'normal') {
  const laborUnit = LaborUnitSchema.parse(laborUnitInput);
  const condition = LaborCondition.parse(conditionInput);
  const value = laborUnit[conditionField[condition]];

  if (value === null || value === undefined) {
    const error = new Error(`No ${condition} labor value exists for labor unit ${laborUnit.id}.`);
    error.code = 'LABOR_CONDITION_VALUE_MISSING';
    throw error;
  }

  return value;
}

export function combineProductivityFactors(factors = []) {
  return factors.reduce((combined, factor) => combined * factor.multiplier, 1);
}

export function calculateEffectiveMhPerUnit(selectionInput) {
  const selection = EstimateLaborSelectionSchema.parse(selectionInput);
  const factorMultiplier = combineProductivityFactors(selection.factors);
  const calculated = selection.baseMhPerUnit * factorMultiplier;
  const effective = selection.estimatorOverrideMhPerUnit ?? calculated;

  return {
    baseMhPerUnit: selection.baseMhPerUnit,
    factorMultiplier,
    calculatedMhPerUnit: round(calculated, 4),
    effectiveMhPerUnit: round(effective, 4),
    isOverride: selection.estimatorOverrideMhPerUnit !== null,
  };
}

export function calculateEstimatedHours({ quantity, quantityPerLaborUnit = 1, selection }) {
  if (quantity < 0) throw new Error('Quantity cannot be negative.');
  if (quantityPerLaborUnit <= 0) throw new Error('quantityPerLaborUnit must be greater than zero.');

  const labor = calculateEffectiveMhPerUnit(selection);
  const units = quantity / quantityPerLaborUnit;

  return {
    ...labor,
    quantity,
    quantityPerLaborUnit,
    laborUnits: round(units, 4),
    estimatedHours: round(units * labor.effectiveMhPerUnit, 4),
  };
}

export function calculateActualMhPerUnit(historyInput, quantityPerLaborUnit = 1) {
  const history = ProductionHistorySchema.parse(historyInput);
  if (quantityPerLaborUnit <= 0) throw new Error('quantityPerLaborUnit must be greater than zero.');

  const normalizedUnits = history.installedQuantity / quantityPerLaborUnit;
  return round(history.actualLaborHours / normalizedUnits, 4);
}

export function summarizeProductionHistory(records, quantityPerLaborUnit = 1) {
  const approved = records
    .map((record) => ProductionHistorySchema.parse(record))
    .filter((record) => record.approved);

  const values = approved
    .map((record) => calculateActualMhPerUnit(record, quantityPerLaborUnit))
    .sort((a, b) => a - b);

  if (!values.length) {
    return {
      sampleSize: 0,
      averageMhPerUnit: null,
      medianMhPerUnit: null,
      lowerQuartileMhPerUnit: null,
      upperQuartileMhPerUnit: null,
      confidenceLevel: 0,
    };
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const median = percentile(values, 0.5);
  const lowerQuartile = percentile(values, 0.25);
  const upperQuartile = percentile(values, 0.75);

  return {
    sampleSize: values.length,
    averageMhPerUnit: round(average, 4),
    medianMhPerUnit: round(median, 4),
    lowerQuartileMhPerUnit: round(lowerQuartile, 4),
    upperQuartileMhPerUnit: round(upperQuartile, 4),
    confidenceLevel: productionConfidence(values.length),
  };
}

function productionConfidence(sampleSize) {
  if (sampleSize >= 30) return 1;
  if (sampleSize >= 20) return 0.9;
  if (sampleSize >= 10) return 0.75;
  if (sampleSize >= 5) return 0.5;
  if (sampleSize >= 3) return 0.3;
  return 0.1;
}

function percentile(sorted, p) {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
