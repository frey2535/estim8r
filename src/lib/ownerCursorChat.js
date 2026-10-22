import {
  BACKUP_ADMIN_EMAIL,
  PLATFORM_OWNER_EMAIL,
  canUseOwnerCursorChat,
  normalizeEmail,
} from "./platformIdentity.js";

export const LOCAL_EMAIL_QUERY = "localEmail";
export const LOCAL_EMAIL_STORAGE_KEY = "estim8r.localEmail";
export const CURSOR_CHAT_STORAGE = "estim8r.cursor.chat";
export const CURSOR_SESSION_PROXY = "/api/cursor-session";

export { canUseOwnerCursorChat };

/**
 * @param {any} search
 * @param {any} storage
 */
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

/**
 * @param {any} email
 */
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

/**
 * @param {any} pathname
 */
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

/**
 * @param {any} status
 */
export function describeCursorSession(status) {
  if (status?.state === "loading") return "Connecting to the Buildr in-app agent…";
  if (status?.state === "ready") return "Connected. I will apply the fix from this chat.";
  if (status?.state === "detached") {
    return status?.message || "Runtime unreachable. I can still run AI Assist on this tab.";
  }
  return status?.message || "Runtime unreachable.";
}

export function allowedLocalEmails() {
  return {
    owner: PLATFORM_OWNER_EMAIL,
    backup: BACKUP_ADMIN_EMAIL,
  };
}
