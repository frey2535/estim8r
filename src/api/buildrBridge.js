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

export const BUILDR_SESSION_STORAGE_KEY = "estim8r.buildrSession.v1";

export function buildrSessionStorageKey(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized ? `${BUILDR_SESSION_STORAGE_KEY}:${normalized}` : BUILDR_SESSION_STORAGE_KEY;
}

export function buildrAuthHeaders(token) {
  const value = String(token || "").trim();
  return value ? { Authorization: `Bearer ${value}` } : {};
}

function jwtExpiryMs(token) {
  try {
    const payload = String(token || "").split(".")[1] || "";
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return Number(json?.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

function sessionStore() {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* private mode */
  }
  return null;
}

export function readBuildrSessionToken(email, store = sessionStore(), now = Date.now()) {
  if (!store) return "";
  try {
    const raw = store.getItem(buildrSessionStorageKey(email));
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    const token = String(parsed?.token || "").trim();
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!token) return "";
    if (expiresAt && expiresAt <= now) {
      store.removeItem(buildrSessionStorageKey(email));
      return "";
    }
    return token;
  } catch {
    return "";
  }
}

export function writeBuildrSessionToken(email, token, store = sessionStore()) {
  const value = String(token || "").trim();
  if (!store || !email || !value) return "";
  try {
    store.setItem(buildrSessionStorageKey(email), JSON.stringify({
      token: value,
      expiresAt: jwtExpiryMs(value) || Date.now() + 7 * 24 * 60 * 60 * 1000,
    }));
  } catch {
    /* ignore quota / private mode */
  }
  return value;
}

function persistReturnedBuildrToken(email, data, store = sessionStore()) {
  const token = String(data?.buildr_token || data?.token || "").trim();
  if (email && token) writeBuildrSessionToken(email, token, store);
  return token;
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
  if (verified?.valid) {
    persistReturnedBuildrToken(verified.email, verified);
    return verified;
  }
  const production = DEFAULT_BUILDR_PRODUCTION_URL;
  if (
    import.meta.env.PROD &&
    api !== production &&
    (verified?.error === "buildr_unavailable" || isLoopbackBuildrUrl(api))
  ) {
    const fallback = await postFamilyAppSsoVerify(production, token, audience);
    if (fallback?.valid) persistReturnedBuildrToken(fallback.email, fallback);
    return fallback;
  }
  return verified;
}

/**
 * @param {string} email
 * @param {string} [companyId]
 * @param {{ ssoToken?: string }} [options]
 */
export async function fetchBuildrAccountStatus(email, companyId, { ssoToken } = {}) {
  const api = buildrApiUrl();
  if (!api || !email) {
    return { configured: Boolean(api), hasAccount: false, canUseBuildr: false, projects: [] };
  }
  try {
    const response = await fetch(`${api}/estim8r/account-status`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...buildrAuthHeaders(readBuildrSessionToken(email)),
      },
      body: JSON.stringify({
        email,
        companyId: companyId || undefined,
        ssoToken: ssoToken || undefined,
      }),
    });
    const data = await readJson(response);
    const token = persistReturnedBuildrToken(email, data);
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
      token: token || null,
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

/**
 * @param {string} api
 * @param {{ companyId?: string, projectId?: string }} [query]
 */
export function buildBuildrEstimatesUrl(api, { companyId, projectId } = {}) {
  const base = trimUrl(api);
  if (!base) return "";
  const url = new URL(`${base}/estim8r/estimates`);
  const company = String(companyId || "").trim();
  const project = String(projectId || "").trim();
  if (company) url.searchParams.set("companyId", company);
  if (project) url.searchParams.set("projectId", project);
  return url.toString();
}

/**
 * @param {any} row
 */
export function normalizeBuildrEstimateRow(row) {
  if (!row || typeof row !== "object") return null;
  const documents = Array.isArray(row.documents)
    ? row.documents.map((doc) => ({
      id: doc?.id || null,
      doc_type: String(doc?.doc_type || doc?.docType || ""),
      title: String(doc?.title || ""),
      file_url: doc?.file_url || doc?.fileUrl || null,
    }))
    : [];
  return {
    id: String(row.id || row.invoice_id || "").trim() || null,
    invoice_id: row.invoice_id || row.invoiceId || null,
    source: String(row.source || "buildr"),
    estim8r_estimate_id: row.estim8r_estimate_id || row.estim8rEstimateId || null,
    project_id: row.project_id || row.projectId || null,
    project_name: String(row.project_name || row.projectName || "Estimate").trim() || "Estimate",
    project_address: String(row.project_address || row.projectAddress || "").trim(),
    invoice_number: row.invoice_number || row.invoiceNumber || null,
    client_name: row.client_name || row.clientName || null,
    issue_date: row.issue_date || row.issueDate || null,
    total: Number(row.total) || 0,
    status: String(row.status || "draft"),
    has_drawings: Boolean(row.has_drawings ?? row.hasDrawings),
    documents,
  };
}

/**
 * List company estimates from Buildr for an Access Control–granted session.
 * Requires a stored Buildr JWT — never lists projects from email alone.
 * @param {{
 *   email?: string,
 *   companyId?: string,
 *   projectId?: string,
 *   apiUrl?: string,
 *   token?: string,
 *   fetchImpl?: typeof fetch,
 * }} [options]
 */
export async function fetchBuildrEstimates({
  email,
  companyId,
  projectId,
  apiUrl,
  token,
  fetchImpl = fetch,
} = {}) {
  const api = trimUrl(apiUrl) || buildrApiUrl();
  if (!api) {
    return { ok: false, estimates: [], error: "buildr_not_configured" };
  }
  if (!email) {
    return { ok: false, estimates: [], error: "email_required" };
  }
  const session = String(token || readBuildrSessionToken(email) || "").trim();
  if (!session) {
    return { ok: false, estimates: [], error: "auth_required" };
  }
  try {
    const response = await fetchImpl(buildBuildrEstimatesUrl(api, { companyId, projectId }), {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...buildrAuthHeaders(session),
      },
    });
    const data = await readJson(response);
    persistReturnedBuildrToken(email, data);
    if (!response.ok) {
      return {
        ok: false,
        estimates: [],
        companyId: data.companyId || companyId || null,
        error: data.message || data.error || "Could not load company estimates.",
      };
    }
    const estimates = (Array.isArray(data.estimates) ? data.estimates : [])
      .map(normalizeBuildrEstimateRow)
      .filter(Boolean);
    return {
      ok: Boolean(data.ok ?? true),
      companyId: data.companyId || companyId || null,
      estimates,
      error: data.ok === false ? (data.message || data.error || "no_buildr_account") : null,
    };
  } catch (error) {
    return {
      ok: false,
      estimates: [],
      companyId: companyId || null,
      error: error?.message || "Buildr is unavailable.",
    };
  }
}

/**
 * @param {{
 *   email?: any,
 *   companyId?: any,
 *   projectName?: any,
 *   projectAddress?: any,
 *   createProject?: any,
 *   estimate?: any,
 *   drawingFile?: any,
 *   markupPages?: any,
 *   estim8rEstimateId?: any,
 *   buildrProjectId?: any,
 *   buildrInvoiceId?: any,
 *   customerCompany?: any,
 *   customerName?: any,
 *   customerEmail?: any,
 *   customerPhone?: any,
 *   ssoToken?: any,
 * }} args
 */
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
  customerCompany,
  customerName,
  customerEmail,
  customerPhone,
  ssoToken,
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
  if (customerCompany) form.append("customerCompany", customerCompany);
  if (customerName) form.append("customerName", customerName);
  if (customerEmail) form.append("customerEmail", customerEmail);
  if (customerPhone) form.append("customerPhone", customerPhone);
  if (ssoToken) form.append("ssoToken", ssoToken);
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
    headers: buildrAuthHeaders(readBuildrSessionToken(email)),
    body: form,
  });
  const data = await readJson(response);
  persistReturnedBuildrToken(email, data);
  if (!response.ok) {
    throw new Error(data.message || data.error || "Buildr could not save the project documents.");
  }
  return data;
}
