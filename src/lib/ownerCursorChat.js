import {
  BACKUP_ADMIN_EMAIL,
  PLATFORM_OWNER_EMAIL,
  canUseOwnerCursorChat,
  normalizeEmail,
} from "./platformIdentity.js";

export const ESTIM8R_GITHUB_REPO = "https://github.com/frey2535/estim8r";
export const ESTIM8R_STARTING_REF = "main";
export const CURSOR_AGENTS_API = "https://api.cursor.com/v1";
export const CURSOR_AGENTS_PROXY = "/api/cursor-agents";
export const CURSOR_DASHBOARD_API_KEYS = "https://cursor.com/dashboard?tab=integrations";
export const LOCAL_EMAIL_QUERY = "localEmail";
export const LOCAL_EMAIL_STORAGE_KEY = "estim8r.localEmail";
export const CURSOR_API_KEY_STORAGE = "estim8r.cursor.apiKey";
export const CURSOR_CHAT_STORAGE = "estim8r.cursor.chat";

export { canUseOwnerCursorChat };

export function readLocalEmailOverride(search = "", storage) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.has(LOCAL_EMAIL_QUERY)) {
    const email = normalizeEmail(params.get(LOCAL_EMAIL_QUERY));
    if (storage && email) storage.setItem(LOCAL_EMAIL_STORAGE_KEY, email);
    return email;
  }
  if (storage) return normalizeEmail(storage.getItem(LOCAL_EMAIL_STORAGE_KEY) || "");
  return "";
}

export function localFallbackIdentity(email) {
  const normalized = normalizeEmail(email) || "local@localhost";
  const staff = canUseOwnerCursorChat(normalized);
  return {
    email: normalized,
    full_name: staff ? "Current Flow" : "Local estimator",
    org_name: staff ? "Currentflow Consulting" : "Local",
    org_role: "owner",
    access_type: "trial",
    access_status: "trial",
  };
}

export function screenLabel(pathname = "/") {
  if (pathname.startsWith("/takeoff")) return "Takeoff";
  if (pathname.startsWith("/markup")) return "Markup pages";
  if (pathname.startsWith("/estimates/new")) return "Estimate builder";
  if (pathname.startsWith("/admin")) return "Estim8r access";
  if (pathname.startsWith("/labor")) return "Labor library";
  if (pathname.startsWith("/production")) return "Production";
  if (pathname.startsWith("/settings") || pathname.startsWith("/profile")) return "Settings";
  return "Estimates";
}

export function buildOwnerPrompt(text, pathname = "/") {
  const trimmed = String(text || "").trim();
  const screen = screenLabel(pathname);
  return [
    trimmed,
    "",
    `[Estim8r owner overlay — stay on this conversation. Current screen: ${screen} (${pathname || "/"}). Repo: ${ESTIM8R_GITHUB_REPO}.]`,
  ].join("\n");
}

export function describeCursorConnection(status) {
  if (status?.state === "ready" && status.via === "proxy") {
    return status.hasEnvKey
      ? "Connected through the Estim8r Vite proxy with CURSOR_API_KEY."
      : "Connected through the Estim8r Vite proxy. The key in this tab is forwarded to Cursor.";
  }
  if (status?.state === "ready" && status.via === "direct") {
    return "Connected straight to api.cursor.com with the key stored in this browser tab.";
  }
  if (status?.state === "needs_key") {
    return "Cursor chat cannot be iframed (cursor.com sends X-Frame-Options: SAMEORIGIN). This panel uses the official Cloud Agents API. Paste a user or service-account key from Cursor Dashboard → API Keys, or set CURSOR_API_KEY for npm run dev.";
  }
  if (status?.state === "error") {
    return status.message || "Could not reach the Cursor Cloud Agents API.";
  }
  return "Checking the Cursor Cloud Agents connection…";
}

export function cursorApiErrorMessage(error, fallback = "Cursor did not accept that request.") {
  const message = String(error?.message || fallback);
  const code = String(error?.code || error?.status || "");
  if (Number(code) === 401 || /invalid user api key/i.test(message)) {
    return "Cursor rejected the API key. Create a new user or service-account key in the Cursor Dashboard and paste it here, or update CURSOR_API_KEY.";
  }
  if (code === "missing_api_key" || /api key/i.test(message)) {
    return "Cursor rejected the request because no valid API key is available. Generate one at Cursor Dashboard → API Keys. Locally, set CURSOR_API_KEY for the Vite proxy.";
  }
  if (Number(code) === 409 || /agent_busy/i.test(message)) {
    return "That Cursor agent is still working. Wait for it to finish, or cancel the run, then send another message.";
  }
  if (Number(code) === 404) {
    return "The Cursor Cloud Agents proxy is not on this host. GitHub Pages is static, so the live site cannot hold CURSOR_API_KEY. Use npm run dev with the key, or put a same-origin reverse proxy at /api/cursor-agents.";
  }
  return message;
}

export function allowedLocalEmails() {
  return {
    owner: PLATFORM_OWNER_EMAIL,
    backup: BACKUP_ADMIN_EMAIL,
  };
}
