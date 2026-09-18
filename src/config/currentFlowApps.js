const env = import.meta.env;

export const CURRENT_FLOW_APPS = [
  {
    id: "estim8r",
    name: "Estim8r",
    label: "Electrical Estimating",
    url: env.VITE_ESTIM8R_URL || "https://estim8r.currentflowconsulting.org",
    active: true,
  },
  {
    id: "necalcul8r",
    name: "NECalcul8r",
    label: "NEC Calculators",
    url: env.VITE_NECALCUL8R_URL || "https://necalcul8r.currentflowconsulting.org",
    active: true,
  },
  {
    id: "buildr",
    name: "Buildr",
    label: "Project Management",
    url: env.VITE_BUILDR_URL || "",
    active: Boolean(env.VITE_BUILDR_URL),
  },
  {
    id: "stockr",
    name: "Stockr",
    label: "Inventory & Materials",
    url: env.VITE_STOCKR_URL || "",
    active: Boolean(env.VITE_STOCKR_URL),
  },
  {
    id: "bendr",
    name: "Bendr",
    label: "Conduit Bending",
    url: env.VITE_BENDR_URL || "",
    active: Boolean(env.VITE_BENDR_URL),
  },
  {
    id: "simul8r",
    name: "Electrical Simul8r",
    label: "Training & Simulation",
    url: env.VITE_SIMUL8R_URL || "",
    active: Boolean(env.VITE_SIMUL8R_URL),
  },
  {
    id: "sketchr",
    name: "Sketchr",
    label: "Electrical Sketching",
    url: env.VITE_SKETCHR_URL || "",
    active: Boolean(env.VITE_SKETCHR_URL),
  },
];

export const CURRENT_APP_ID = "estim8r";
