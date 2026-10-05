export const LIVE_CATALOG_DEV_PROXY = "/api/live-supplier-catalog";
export const LIVE_CATALOG_FUNCTION = "search-supplier-catalog";

export function shouldUseLiveCatalogDevProxy({ isDev = false, hostname = "" } = {}) {
  if (isDev) return true;
  const host = String(hostname || "").toLowerCase();
  return host === "localhost"
    || host === "127.0.0.1"
    || host === "::1"
    || host.endsWith(".localhost");
}

export function isStaticHostCatalogRejection(response, bodyText = "") {
  const status = Number(response?.status) || 0;
  if (status === 404 || status === 405 || status === 501) return true;
  const contentType = typeof response?.headers?.get === "function"
    ? String(response.headers.get("content-type") || "")
    : String(response?.headers?.["content-type"] || "");
  if (contentType.includes("text/html")) return true;
  const text = String(bodyText || "");
  return /405 Not Allowed/i.test(text)
    || /<!doctype html/i.test(text)
    || /<html[\s>]/i.test(text);
}
