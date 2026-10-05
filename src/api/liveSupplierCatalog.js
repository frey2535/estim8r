import { requireSupabase, supabase } from "./supabaseClient";
import {
  LIVE_CATALOG_DEV_PROXY,
  LIVE_CATALOG_FUNCTION,
  isStaticHostCatalogRejection,
  shouldUseLiveCatalogDevProxy,
} from "./liveSupplierCatalogHost";

export { LIVE_CATALOG_DEV_PROXY, LIVE_CATALOG_FUNCTION };

function currentHostname() {
  if (typeof window === "undefined") return "";
  return window.location.hostname || "";
}

async function parseCatalogResponse(response) {
  const text = await response.text();
  try {
    return { json: true, payload: text ? JSON.parse(text) : {}, text };
  } catch {
    return { json: false, payload: null, text };
  }
}

async function searchViaDevProxy(body) {
  const response = await fetch(LIVE_CATALOG_DEV_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseCatalogResponse(response);
  if (isStaticHostCatalogRejection(response, parsed.text)) {
    return null;
  }
  if (parsed.json && (response.ok || parsed.payload?.configured || Array.isArray(parsed.payload?.results))) {
    return parsed.payload;
  }
  if (parsed.json) {
    throw new Error(parsed.payload?.message || `Live catalog search failed (${response.status}).`);
  }
  throw new Error("Live catalog returned a non-JSON response.");
}

export async function searchLiveSupplierCatalog({ query, quantity = 1, limit = 8 } = {}) {
  const body = { query, quantity, limit };
  const useProxy = shouldUseLiveCatalogDevProxy({
    isDev: Boolean(import.meta.env?.DEV),
    hostname: currentHostname(),
  });

  if (useProxy) {
    try {
      const proxied = await searchViaDevProxy(body);
      if (proxied) return proxied;
    } catch (error) {
      if (error?.message && !/fetch|Failed|Network|404|405|non-JSON/i.test(error.message)) {
        throw error;
      }
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

  const { data, error } = await requireSupabase().functions.invoke(LIVE_CATALOG_FUNCTION, { body });
  if (error) {
    throw new Error(error.message || "Live catalog search failed.");
  }
  return data;
}
