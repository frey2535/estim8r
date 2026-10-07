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
    const status = Number(error?.context?.status) || 0;
    if (status === 404) throw new Error("Supplier pricing function is not deployed. Deploy search-supplier-catalog to the configured Supabase project.");
    if (status === 401 || status === 403) throw new Error("Supplier pricing authorization failed. Sign in again and verify the Edge Function accepts this project session.");
    if (status >= 500) throw new Error(`Supplier pricing service failed (${status}). Check Edge Function logs and supplier credentials.`);
    throw new Error(error.message || "Live supplier pricing request failed.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("Supplier pricing function returned no usable response.");
  }
  return data;
}
