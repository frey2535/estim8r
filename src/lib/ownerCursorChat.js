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

export function describeCursorSession(status) {
  if (status?.state === "loading") return "Looking for this Cursor Project session…";
  if (status?.state === "ready") {
    const who = status.session?.ownerEmail ? ` (${status.session.ownerEmail})` : "";
    return `Attached to this Cursor Project session${who}. No API key and no Cloud Agents billing. I only report what this tab shows, and corrections go through this session.`;
  }
  if (status?.state === "detached") {
    return "This tab can inspect the current screen from console errors, failed requests, and validation. A Cursor Project session is not attached, so I cannot edit Estim8r from here. Open the project in Cursor — do not paste an API key.";
  }
  return status?.message || "Could not reach a Cursor Project session.";
}

export function allowedLocalEmails() {
  return {
    owner: PLATFORM_OWNER_EMAIL,
    backup: BACKUP_ADMIN_EMAIL,
  };
}
