import { z } from 'zod';

export const LaborSourceType = z.enum([
  'published_reference',
  'company_history',
  'estim8r_standard',
  'custom',
  'manufacturer',
  'government',
  'experimental',
]);

export const LaborVerificationStatus = z.enum([
  'unverified',
  'researching',
  'verified',
  'needs_correction',
  'deprecated',
]);

export const LaborCondition = z.enum(['normal', 'difficult', 'very_difficult']);

export const LaborItemSchema = z.object({
  id: z.string(),
  trade: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().optional().default(''),
  itemName: z.string().min(1),
  description: z.string().optional().default(''),
  materialType: z.string().optional().default(''),
  size: z.string().optional().default(''),
  unit: z.string().min(1),
  defaultCrew: z.string().optional().default(''),
  active: z.boolean().default(true),
});

export const LaborUnitSchema = z.object({
  id: z.string(),
  laborItemId: z.string(),
  sourceType: LaborSourceType,
  sourceName: z.string().min(1),
  sourceYear: z.string().optional().default(''),
  sourceReference: z.string().optional().default(''),
  normalMh: z.number().nonnegative().nullable().default(null),
  difficultMh: z.number().nonnegative().nullable().default(null),
  veryDifficultMh: z.number().nonnegative().nullable().default(null),
  verificationStatus: LaborVerificationStatus.default('unverified'),
  productionAllowed: z.boolean().default(false),
  verifiedBy: z.string().optional().default(''),
  verifiedDate: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export const CompanyLaborUnitSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  laborItemId: z.string(),
  normalMh: z.number().nonnegative().nullable().default(null),
  difficultMh: z.number().nonnegative().nullable().default(null),
  veryDifficultMh: z.number().nonnegative().nullable().default(null),
  source: z.string().default('company_history'),
  sampleSize: z.number().int().nonnegative().default(0),
  confidenceLevel: z.number().min(0).max(1).default(0),
  approvedBy: z.string().optional().default(''),
  approvedAt: z.string().optional().default(''),
  active: z.boolean().default(true),
});

export const ProductivityFactorSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  label: z.string().min(1),
  multiplier: z.number().positive(),
  category: z.enum([
    'height',
    'congestion',
    'occupied_space',
    'material_handling',
    'shift',
    'weather',
    'access',
    'repetition',
    'prefab',
    'equipment',
    'underground',
    'custom',
  ]),
  notes: z.string().optional().default(''),
});

export const ProductionHistorySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  projectId: z.string(),
  laborItemId: z.string(),
  installedQuantity: z.number().positive(),
  unit: z.string().min(1),
  actualLaborHours: z.number().nonnegative(),
  crewSize: z.number().positive().optional(),
  crewType: z.string().optional().default(''),
  workDate: z.string(),
  factors: z.array(ProductivityFactorSchema).default([]),
  notes: z.string().optional().default(''),
  approved: z.boolean().default(false),
  approvedBy: z.string().optional().default(''),
});

export const EstimateLaborSelectionSchema = z.object({
  laborItemId: z.string(),
  selectedSource: LaborSourceType,
  condition: LaborCondition.default('normal'),
  baseMhPerUnit: z.number().nonnegative(),
  factors: z.array(ProductivityFactorSchema).default([]),
  estimatorOverrideMhPerUnit: z.number().nonnegative().nullable().default(null),
  sourceLaborUnitId: z.string().optional().default(''),
  sourceCompanyLaborUnitId: z.string().optional().default(''),
  sourceRecordId: z.string().optional().default(''),
  overrideReason: z.string().optional().default(''),
  sourceName: z.string().optional().default(''),
  verificationStatus: LaborVerificationStatus.optional().default('unverified'),
  acknowledgedUnverified: z.boolean().optional().default(false),
  notes: z.string().optional().default(''),
});
