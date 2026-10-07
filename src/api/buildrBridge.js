export const DEFAULT_BUILDR_PRODUCTION_URL = "https://buildrpm.com";

function trimUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

export function isLoopbackBuildrUrl(value) {
  const trimmed = trimUrl(value);
  if (!trimmed) return false;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
  } catch {
    return false;
  }
}

function usableBuildrUrl(value, isProd) {
  const trimmed = trimUrl(value);
  if (!trimmed) return "";
  if (isProd && isLoopbackBuildrUrl(trimmed)) return "";
  return trimmed;
}

export function resolveBuildrAppUrl(appUrl, { isProd = false } = {}) {
  return usableBuildrUrl(appUrl, isProd) || (isProd ? DEFAULT_BUILDR_PRODUCTION_URL : "");
}

export function resolveBuildrApiUrl(apiUrl, appUrl, { isProd = false } = {}) {
  return usableBuildrUrl(apiUrl, isProd) || resolveBuildrAppUrl(appUrl, { isProd });
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

async function postFamilyAppSsoVerify(api, token, audience) {
  try {
    const response = await fetch(`${api}/functions/verifyFamilyAppSSOToken`, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, audience }),
    });
    const data = await readJson(response);
    if (!response.ok) {
      return { valid: false, error: data.error || "verify_failed", ...data };
    }
    return data;
  } catch (error) {
    return { valid: false, error: "buildr_unavailable", message: error?.message };
  }
}

export async function verifyBuildrFamilyAppSso(token, audience = "estim8r") {
  const api = buildrApiUrl();
  if (!api) {
    return { valid: false, error: "buildr_not_configured" };
  }
  if (!token) {
    return { valid: false, error: "token_required" };
  }
  const verified = await postFamilyAppSsoVerify(api, token, audience);
  if (verified?.valid) return verified;
  const production = DEFAULT_BUILDR_PRODUCTION_URL;
  if (
    import.meta.env.PROD &&
    api !== production &&
    (verified?.error === "buildr_unavailable" || isLoopbackBuildrUrl(api))
  ) {
    return postFamilyAppSsoVerify(production, token, audience);
  }
  return verified;
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
