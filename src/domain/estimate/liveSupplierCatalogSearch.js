import {
  configuredLiveCatalogAdapters,
  normalizeDigikeyResponse,
  normalizeElement14Response,
  normalizeMouserResponse,
  normalizeNexarResponse,
} from "./liveSupplierCatalog.js";

const NEXAR_SEARCH = `
query Search($q: String!, $limit: Int!) {
  supSearch(q: $q, limit: $limit) {
    results {
      part {
        mpn
        name
        shortDescription
        manufacturer { name }
        sellers {
          isAuthorized
          company { name }
          offers {
            sku
            inventoryLevel
            clickUrl
            updated
            prices { quantity price currency convertedPrice convertedCurrency }
          }
        }
      }
    }
  }
}
`;

function clean(value) {
  return String(value ?? "").trim();
}

function form(body) {
  return new URLSearchParams(body).toString();
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Supplier catalog returned non-JSON (${response.status}).`);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await readJson(response);
  if (!response.ok) {
    const message = payload?.ErrorMessage
      || payload?.message
      || payload?.title
      || payload?.error_description
      || payload?.Errors?.[0]?.Message
      || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

const tokenCache = new Map();

async function clientCredentialsToken(cacheKey, url, body) {
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const payload = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form(body),
  });
  const token = clean(payload.access_token);
  if (!token) throw new Error("Catalog token response had no access_token.");
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 600) * 1000,
  });
  return token;
}

async function searchMouser(query, { env, quantity, limit }) {
  const payload = await fetchJson(`https://api.mouser.com/api/v1/search/keyword?apiKey=${encodeURIComponent(env.MOUSER_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      SearchByKeywordRequest: {
        keyword: query,
        records: limit,
        startingRecord: 0,
      },
    }),
  });
  if (payload?.Errors?.length) {
    throw new Error(payload.Errors.map((row) => row.Message || row.message).filter(Boolean).join("; ") || "Mouser search failed.");
  }
  return normalizeMouserResponse(payload, { quantity, fetchedAt: new Date().toISOString() });
}

async function searchDigikey(query, { env, quantity, limit }) {
  const sandbox = /^(1|true|yes)$/i.test(clean(env.DIGIKEY_SANDBOX));
  const host = sandbox ? "https://sandbox-api.digikey.com" : "https://api.digikey.com";
  const token = await clientCredentialsToken(
    `digikey:${sandbox}:${env.DIGIKEY_CLIENT_ID}`,
    `${host}/v1/oauth2/token`,
    {
      client_id: env.DIGIKEY_CLIENT_ID,
      client_secret: env.DIGIKEY_CLIENT_SECRET,
      grant_type: "client_credentials",
    },
  );
  const payload = await fetchJson(`${host}/products/v4/search/keyword`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-DIGIKEY-Client-Id": env.DIGIKEY_CLIENT_ID,
      "X-DIGIKEY-Locale-Site": "US",
      "X-DIGIKEY-Locale-Language": "en",
      "X-DIGIKEY-Locale-Currency": "USD",
      "X-DIGIKEY-Locale-ShipToCountry": "US",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Keywords: query,
      RecordCount: limit,
      RecordStartPosition: 0,
    }),
  });
  return normalizeDigikeyResponse(payload, { quantity, fetchedAt: new Date().toISOString() });
}

async function searchNexar(query, { env, quantity, limit }) {
  const token = await clientCredentialsToken(
    `nexar:${env.NEXAR_CLIENT_ID}`,
    "https://identity.nexar.com/connect/token",
    {
      client_id: env.NEXAR_CLIENT_ID,
      client_secret: env.NEXAR_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: "supply.domain",
    },
  );
  const payload = await fetchJson("https://api.nexar.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: NEXAR_SEARCH, variables: { q: query, limit } }),
  });
  if (payload?.errors?.length) {
    throw new Error(payload.errors.map((row) => row.message).filter(Boolean).join("; ") || "Nexar search failed.");
  }
  return normalizeNexarResponse(payload, { quantity, fetchedAt: new Date().toISOString() });
}

async function searchElement14(query, { env, quantity, limit }) {
  const store = clean(env.ELEMENT14_STORE_ID) || "us";
  const url = new URL("https://api.element14.com/catalog/products");
  url.searchParams.set("term", `any:${query}`);
  url.searchParams.set("storeInfo.id", store);
  url.searchParams.set("resultsSettings.offset", "0");
  url.searchParams.set("resultsSettings.numberOfResults", String(limit));
  url.searchParams.set("resultsSettings.responseGroup", "medium");
  url.searchParams.set("callInfo.apiKey", env.ELEMENT14_API_KEY);
  url.searchParams.set("callInfo.responseDataFormat", "JSON");
  const payload = await fetchJson(url);
  return normalizeElement14Response(payload, { quantity, fetchedAt: new Date().toISOString() });
}

const SEARCHERS = {
  mouser: searchMouser,
  digikey: searchDigikey,
  nexar: searchNexar,
  element14: searchElement14,
};

export async function searchLiveSupplierCatalogs(query, {
  env = {},
  quantity = 1,
  limit = 8,
} = {}) {
  const q = clean(query);
  const configured = configuredLiveCatalogAdapters(env);
  if (!q) {
    return { query: q, configured: configured.map((row) => row.id), results: [], errors: [], message: "Enter a model, SKU, or description to search live catalogs." };
  }
  if (!configured.length) {
    return {
      query: q,
      configured: [],
      results: [],
      errors: [],
      message: "No live catalog credentials are configured. Set supplier API secrets and deploy search-supplier-catalog. Estim8r will not invent prices.",
    };
  }
  const settled = await Promise.allSettled(configured.map(async (adapter) => {
    const offers = await SEARCHERS[adapter.id](q, { env, quantity, limit });
    return { adapter: adapter.id, offers };
  }));
  const results = [];
  const errors = [];
  for (const item of settled) {
    if (item.status === "fulfilled") results.push(...item.value.offers);
    else errors.push({ message: item.reason?.message || String(item.reason) });
  }
  results.sort((a, b) => a.unitCost - b.unitCost);
  return {
    query: q,
    configured: configured.map((row) => row.id),
    results,
    errors,
    fetchedAt: new Date().toISOString(),
    message: results.length
      ? `Found ${results.length} live catalog ${results.length === 1 ? "price" : "prices"}.`
      : errors.length
        ? "Configured catalogs returned no priced matches."
        : "No live catalog prices matched that search.",
  };
}

export function catalogEnvFromProcess(source) {
  const envSource = source || (typeof process !== "undefined" ? process.env : {});
  const names = [
    "MOUSER_API_KEY",
    "DIGIKEY_CLIENT_ID",
    "DIGIKEY_CLIENT_SECRET",
    "DIGIKEY_SANDBOX",
    "NEXAR_CLIENT_ID",
    "NEXAR_CLIENT_SECRET",
    "ELEMENT14_API_KEY",
    "ELEMENT14_STORE_ID",
  ];
  const env = {};
  for (const name of names) env[name] = clean(envSource[name]);
  return env;
}
