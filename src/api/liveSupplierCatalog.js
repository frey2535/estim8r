import { requireSupabase, supabase } from "./supabaseClient";

export const LIVE_CATALOG_DEV_PROXY = "/api/live-supplier-catalog";

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || "Live catalog returned a non-JSON response.");
  }
}

export async function searchLiveSupplierCatalog({ query, quantity = 1, limit = 8 } = {}) {
  const body = { query, quantity, limit };
  try {
    const response = await fetch(LIVE_CATALOG_DEV_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return readJson(response);
    if (response.status !== 404) {
      const payload = await readJson(response);
      if (payload?.configured || Array.isArray(payload?.results)) return payload;
      throw new Error(payload?.message || `Live catalog search failed (${response.status}).`);
    }
  } catch (error) {
    if (error?.message && !/fetch|Failed|Network|404/i.test(error.message) && !error.message.includes("non-JSON")) {
      throw error;
    }
  }

  if (!supabase) {
    return {
      query,
      configured: [],
      results: [],
      errors: [],
      message: "Live catalog search needs the local proxy (`npm run dev`) or a deployed search-supplier-catalog function. No prices were invented.",
    };
  }

  const { data, error } = await requireSupabase().functions.invoke("search-supplier-catalog", { body });
  if (error) {
    throw new Error(error.message || "Live catalog search failed.");
  }
  return data;
}
