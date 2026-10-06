import { normalizeEmail } from "./platformIdentity.js";

export const BUILDR_FAMILY_ACCESS_KEY = "estim8r.buildrFamilyAccess.v1";
const SESSION_MS = 12 * 60 * 60 * 1000;

function storage() {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch {
    /* private mode */
  }
  return null;
}

export function buildrFamilyAccessCopy(errorCode) {
  const code = String(errorCode || "").trim().toLowerCase();
  if (code === "access_denied") {
    return {
      title: "Estim8r is not granted to this account",
      body: "Only employees your company has already granted Estim8r in Buildr Access Control can enter. Ask your admin to grant Estim8r. Do not download or install Estim8r yourself.",
    };
  }
  if (code === "not_purchased") {
    return {
      title: "Estim8r is not on this company",
      body: "The purchaser is the company or individual who bought Buildr and Estim8r. Everyone else opens that company app from the Buildr sidebar after they are granted access. Do not download or install Estim8r on each employee.",
    };
  }
  if (code === "expired") {
    return {
      title: "This Buildr handoff expired",
      body: "Open Estim8r again from the Buildr sidebar. Stay on the company app — do not download a separate copy.",
    };
  }
  if (code === "email_mismatch") {
    return {
      title: "Signed in as a different account",
      body: "Estim8r was opened from Buildr for a different email. Sign out and sign in as that company user.",
    };
  }
  return {
    title: "Unable to open the company Estim8r",
    body: "Open Estim8r from the Buildr sidebar after your company has purchased it and your admin has granted access. This is not a download or install page.",
  };
}

export function readBuildrFamilyAccess(store = storage()) {
  if (!store) return null;
  try {
    const raw = store.getItem(BUILDR_FAMILY_ACCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const email = normalizeEmail(parsed?.email);
    const companyId = String(parsed?.companyId || "").trim();
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!email || !companyId) return null;
    return { email, companyId, expiresAt };
  } catch {
    return null;
  }
}

export function writeBuildrFamilyAccess({ email, companyId }, store = storage(), now = Date.now()) {
  const next = {
    email: normalizeEmail(email),
    companyId: String(companyId || "").trim(),
    expiresAt: now + SESSION_MS,
  };
  if (!next.email || !next.companyId) return null;
  try {
    store?.setItem(BUILDR_FAMILY_ACCESS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

export function clearBuildrFamilyAccess(store = storage()) {
  try {
    store?.removeItem(BUILDR_FAMILY_ACCESS_KEY);
  } catch {
    /* ignore */
  }
}

export function hasBuildrCompanyGrant(user, store = storage(), now = Date.now()) {
  const access = readBuildrFamilyAccess(store);
  if (!access) return false;
  if (access.expiresAt && access.expiresAt <= now) {
    clearBuildrFamilyAccess(store);
    return false;
  }
  return access.email === normalizeEmail(user?.email);
}

export function readBuildrHandoffParams(search = "", hash = "") {
  const query = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const fragment = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  const first = (...keys) => {
    for (const source of [query, fragment]) {
      for (const key of keys) {
        const value = String(source.get(key) || "").trim();
        if (value) return value;
      }
    }
    return "";
  };
  return {
    token: first("sso_token", "token"),
    companyId: first("company_id", "app_tenant_binding_company_id"),
    email: normalizeEmail(first("email")),
    returnApp: first("returnApp"),
  };
}

export function canEnterCompanyEstim8r({
  isAuthenticated,
  hasProductAccess,
  hasPlatformAccess = false,
  user,
  store = storage(),
  now = Date.now(),
} = {}) {
  if (!isAuthenticated || !user?.email) return false;
  return Boolean(hasProductAccess || hasPlatformAccess || hasBuildrCompanyGrant(user, store, now));
}
