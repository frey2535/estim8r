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
    persistReturnedBuildrToken(email, data);
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
  estimatePdf,
  estimatePdfFileName,
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
  if (estimatePdf) {
    form.append(
      "estimatePdf",
      estimatePdf,
      estimatePdfFileName || `${projectName || "estimate"}-customer-estimate.pdf`,
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
