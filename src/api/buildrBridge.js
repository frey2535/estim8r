export const DEFAULT_BUILDR_PRODUCTION_URL = "https://buildrpm.com";

function trimUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

export function resolveBuildrAppUrl(appUrl, { isProd = false } = {}) {
  return trimUrl(appUrl || (isProd ? DEFAULT_BUILDR_PRODUCTION_URL : ""));
}

export function resolveBuildrApiUrl(apiUrl, appUrl, { isProd = false } = {}) {
  return trimUrl(apiUrl || resolveBuildrAppUrl(appUrl, { isProd }));
}

export function buildrAppUrl() {
  return resolveBuildrAppUrl(import.meta.env.VITE_BUILDR_URL, { isProd: import.meta.env.PROD });
}

export function buildrApiUrl() {
  return resolveBuildrApiUrl(
    import.meta.env.VITE_BUILDR_API_URL,
    import.meta.env.VITE_BUILDR_URL,
    { isProd: import.meta.env.PROD },
  );
}

export function isBuildrConfigured() {
  return Boolean(buildrApiUrl());
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function fetchBuildrAccountStatus(email, companyId) {
  const api = buildrApiUrl();
  if (!api || !email) {
    return { configured: Boolean(api), hasAccount: false, canUseBuildr: false, projects: [] };
  }
  try {
    const response = await fetch(`${api}/estim8r/account-status`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, companyId: companyId || undefined }),
    });
    const data = await readJson(response);
    if (!response.ok) {
      return { configured: true, hasAccount: false, canUseBuildr: false, projects: [], error: data.message || data.error };
    }
    return {
      configured: true,
      hasAccount: Boolean(data.hasAccount),
      canUseBuildr: Boolean(data.canUseBuildr ?? data.hasAccount),
      projects: Array.isArray(data.projects) ? data.projects : [],
      companyId: data.companyId || null,
      companyName: data.companyName || null,
    };
  } catch (error) {
    return {
      configured: true,
      hasAccount: false,
      canUseBuildr: false,
      projects: [],
      error: error?.message || "Buildr is unavailable.",
    };
  }
}

export async function saveBuildrProjectDocuments({
  email,
  companyId,
  projectName,
  projectAddress,
  createProject,
  estimate,
  drawingFile,
  markupPages,
  estim8rEstimateId,
  buildrProjectId,
  buildrInvoiceId,
}) {
  const api = buildrApiUrl();
  if (!api) throw new Error("Buildr is not configured.");
  const form = new FormData();
  form.append("email", email || "");
  if (companyId) form.append("companyId", companyId);
  form.append("projectName", projectName || "");
  form.append("projectAddress", projectAddress || "");
  form.append("createProject", createProject ? "true" : "false");
  if (estim8rEstimateId) form.append("estim8rEstimateId", estim8rEstimateId);
  if (buildrProjectId) form.append("buildrProjectId", buildrProjectId);
  if (buildrInvoiceId) form.append("buildrInvoiceId", buildrInvoiceId);
  form.append(
    "estimate",
    new Blob([JSON.stringify(estimate || {}, null, 2)], { type: "application/json" }),
    `${projectName || "estimate"}-estimate.json`,
  );
  if (markupPages) {
    form.append(
      "markup",
      new Blob([JSON.stringify(markupPages, null, 2)], { type: "application/json" }),
      `${projectName || "estimate"}-markup-pages.json`,
    );
  }
  if (drawingFile) {
    form.append("drawing", drawingFile, drawingFile.name || `${projectName || "drawing"}.pdf`);
  }
  const response = await fetch(`${api}/estim8r/save-project-docs`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data.message || data.error || "Buildr could not save the project documents.");
  }
  return data;
}
