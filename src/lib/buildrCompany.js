import { normalizeEmail } from "./platformIdentity.js";

export const BUILDR_COMPANY_STORAGE_KEY = "estim8r.buildrCompanyId.v1";

export function normalizeCompanyId(value) {
  return String(value || "").trim();
}

function storageKey(email) {
  const normalized = normalizeEmail(email);
  return normalized ? `${BUILDR_COMPANY_STORAGE_KEY}:${normalized}` : BUILDR_COMPANY_STORAGE_KEY;
}

function memoryStore() {
  if (typeof globalThis === "undefined") return null;
  if (!globalThis.__estim8rBuildrCompanyMemory) {
    globalThis.__estim8rBuildrCompanyMemory = new Map();
  }
  return globalThis.__estim8rBuildrCompanyMemory;
}

function readLocal(email) {
  const key = storageKey(email);
  try {
    if (typeof localStorage !== "undefined") {
      const scoped = normalizeCompanyId(localStorage.getItem(key));
      if (scoped) return scoped;
      const legacy = normalizeCompanyId(localStorage.getItem(BUILDR_COMPANY_STORAGE_KEY));
      if (legacy) return legacy;
    }
  } catch {
    /* ignore quota / private mode */
  }
  return normalizeCompanyId(memoryStore()?.get(key));
}

function writeLocal(companyId, email) {
  const key = storageKey(email);
  const value = normalizeCompanyId(companyId);
  try {
    if (typeof localStorage !== "undefined") {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    }
  } catch {
    /* ignore quota / private mode */
  }
  const memory = memoryStore();
  if (memory) {
    if (value) memory.set(key, value);
    else memory.delete(key);
  }
  return value;
}

export function readLinkedBuildrCompanyId(user) {
  const fromProfile = normalizeCompanyId(user?.buildr_company_id);
  if (fromProfile) return fromProfile;
  return readLocal(user?.email);
}

export async function persistBuildrCompanyId(companyId, user) {
  const value = writeLocal(companyId, user?.email);
  try {
    const { isSupabaseConfigured, requireSupabase } = await import("@/api/supabaseClient");
    if (!isSupabaseConfigured) return { ok: true, companyId: value || null, stored: "local" };
    const client = requireSupabase();
    const { data: { user: authUser } } = await client.auth.getUser();
    if (!authUser) return { ok: true, companyId: value || null, stored: "local" };
    const { error } = await client
      .from("profiles")
      .update({
        buildr_company_id: value || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authUser.id);
    if (error) return { ok: true, companyId: value || null, stored: "local", warning: error.message };
    return { ok: true, companyId: value || null, stored: "profile" };
  } catch (error) {
    return { ok: true, companyId: value || null, stored: "local", warning: error?.message };
  }
}
