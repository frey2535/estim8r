import { supabaseAuth } from './supabaseAuth';
import { listLaborLibrary, listLaborCategories, listCompanyLaborUnits, listProductionHistory, saveEstimateLaborSnapshot } from './laborRepository';

export const base44 = {
  auth: supabaseAuth,
  entities: {
    LaborItem: {
      list: async () => listLaborLibrary(),
      search: async (options) => listLaborLibrary(options),
      categories: async () => listLaborCategories(),
    },
    CompanyLaborUnit: {
      list: async () => listCompanyLaborUnits(),
    },
    LaborProductionHistory: {
      list: async (laborItemId) => listProductionHistory(laborItemId),
    },
    EstimateLaborSnapshot: {
      create: async (snapshot) => saveEstimateLaborSnapshot(snapshot),
    },
  },
  functions: {
    invoke: async (name) => {
      throw new Error(`Supabase function ${name} is not configured yet.`);
    },
  },
  asServiceRole: {
    entities: {},
    functions: {},
  },
};

export default base44;
