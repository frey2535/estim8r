// Deployed copy of the live catalog search used by search-supplier-catalog.
// Keep in sync with src/domain/estimate/liveSupplierCatalog.js and liveSupplierCatalogSearch.js.

const ADAPTERS = [
  { id: "mouser", supplier: "Mouser", env: ["MOUSER_API_KEY"], mode: "official-api" },
  { id: "digikey", supplier: "Digi-Key", env: ["DIGIKEY_CLIENT_ID", "DIGIKEY_CLIENT_SECRET"], mode: "official-api" },
  { id: "nexar", supplier: "Nexar Supply", env: ["NEXAR_CLIENT_ID", "NEXAR_CLIENT_SECRET"], mode: "official-api" },
  { id: "element14", supplier: "Newark / element14", env: ["ELEMENT14_API_KEY"], mode: "official-api" },
  { id: "lowes", supplier: "Lowe's", gateway: true, mode: "authorized-gateway" },
  { id: "homedepot", supplier: "Home Depot", gateway: true, mode: "authorized-gateway" },
  { id: "cityelectric", supplier: "City Electric Supply", gateway: true, mode: "authorized-gateway" },
  { id: "inlineelectric", supplier: "Inline Electric Supply", gateway: true, mode: "authorized-gateway" },
  { id: "wesco", supplier: "Wesco / Anixter", gateway: true, mode: "authorized-gateway" },
  { id: "graybar", supplier: "Graybar", gateway: true, mode: "authorized-gateway" },
  { id: "grainger", supplier: "Grainger", gateway: true, mode: "authorized-gateway" },
  { id: "msc", supplier: "MSC Industrial", gateway: true, mode: "authorized-gateway" },
];

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

function money(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!/[0-9]/.test(raw)) return null;
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function pickUnitPrice(breaks, quantity) {
  const qty = Math.max(1, Number(quantity) || 1);
  const priced = (breaks || [])
    .map((row) => ({
      quantity: Math.max(1, Number(row.quantity) || 1),
      unitCost: money(row.unitCost ?? row.price),
      currency: clean(row.currency) || "USD",
    }))
    .filter((row) => row.unitCost != null)
    .sort((a, b) => a.quantity - b.quantity);
  if (!priced.length) return null;
  let chosen = priced[0];
  for (const row of priced) if (row.quantity <= qty) chosen = row;
  return chosen;
}

function offer(input) {
  const unitCost = money(input.unitCost);
  const supplier = clean(input.supplier);
  if (unitCost == null || !supplier || !(clean(input.sku) || clean(input.mpn) || clean(input.description))) return null;
  return {
    id: clean(input.id) || [supplier, input.sku || input.mpn, input.description].filter(Boolean).join(":"),
    adapter: clean(input.adapter),
    supplier,
    sku: clean(input.sku),
    mpn: clean(input.mpn),
    description: clean(input.description),
    unit: clean(input.unit) || "EA",
    unitCost,
    currency: clean(input.currency) || "USD",
    quantityBreak: Number(input.quantityBreak) || 1,
    availability: clean(input.availability),
    url: clean(input.url),
    fetchedAt: clean(input.fetchedAt) || new Date().toISOString(),
    live: true,
  };
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function catalogEnvFromProcess(source) {
  const envSource = source || {};
  const names = [
    "MOUSER_API_KEY",
    "DIGIKEY_CLIENT_ID",
    "DIGIKEY_CLIENT_SECRET",
    "DIGIKEY_SANDBOX",
    "NEXAR_CLIENT_ID",
    "NEXAR_CLIENT_SECRET",
    "ELEMENT14_API_KEY",
    "ELEMENT14_STORE_ID",
    "SUPPLIER_GATEWAY_URL",
    "SUPPLIER_GATEWAY_TOKEN",
  ];
  const env = {};
  for (const name of names) env[name] = clean(envSource[name]);
  return env;
}

function adapterConfigured(adapter, env) {
  if (adapter.gateway) return Boolean(clean(env.SUPPLIER_GATEWAY_URL) && clean(env.SUPPLIER_GATEWAY_TOKEN));
  return (adapter.env || []).every((name) => clean(env[name]));
}

export function configuredIds(env) {
  return ADAPTERS.filter((adapter) => adapterConfigured(adapter, env)).map((row) => row.id);
}

export function liveCatalogDiagnostics(env) {
  return ADAPTERS.map((adapter) => ({
    id: adapter.id,
    supplier: adapter.supplier,
    mode: adapter.mode,
    configured: adapterConfigured(adapter, env),
    reason: adapterConfigured(adapter, env)
      ? ""
      : adapter.gateway
        ? "Needs authorized supplier gateway configuration."
        : `Missing ${(adapter.env || []).join(", ")}.`,
  }));
}

function normalizeMouser(payload, quantity, fetchedAt) {
  return (payload?.SearchResults?.Parts || []).map((part, index) => {
    const picked = pickUnitPrice((part.PriceBreaks || []).map((row) => ({ quantity: row.Quantity, unitCost: row.Price, currency: row.Currency })), quantity);
    return offer({
      id: `mouser:${part.MouserPartNumber || index}`,
      adapter: "mouser",
      supplier: "Mouser",
      sku: part.MouserPartNumber,
      mpn: part.ManufacturerPartNumber,
      description: part.Description,
      unitCost: picked?.unitCost,
      currency: picked?.currency,
      quantityBreak: picked?.quantity,
      availability: part.Availability,
      url: part.ProductDetailUrl,
      fetchedAt,
    });
  }).filter(Boolean);
}

function normalizeDigikey(payload, quantity, fetchedAt) {
  return (payload?.Products || []).map((product, index) => {
    const variation = first(product.ProductVariations) || {};
    const picked = pickUnitPrice((variation.StandardPricing || []).map((row) => ({ quantity: row.BreakQuantity, unitCost: row.UnitPrice })), quantity);
    return offer({
      id: `digikey:${variation.DigiKeyProductNumber || product.ManufacturerProductNumber || index}`,
      adapter: "digikey",
      supplier: "Digi-Key",
      sku: variation.DigiKeyProductNumber,
      mpn: product.ManufacturerProductNumber,
      description: product.Description?.ProductDescription || product.Description,
      unitCost: picked?.unitCost ?? money(product.UnitPrice),
      currency: "USD",
      quantityBreak: picked?.quantity,
      availability: product.QuantityAvailable != null ? String(product.QuantityAvailable) : "",
      url: product.ProductUrl,
      fetchedAt,
    });
  }).filter(Boolean);
}

function normalizeNexar(payload, quantity, fetchedAt) {
  const offers = [];
  for (const result of payload?.data?.supSearch?.results || []) {
    const part = result.part || result;
    for (const seller of part.sellers || []) {
      if (seller.isAuthorized === false) continue;
      const supplier = clean(seller.company?.name) || "Nexar distributor";
      for (const row of seller.offers || []) {
        const picked = pickUnitPrice((row.prices || []).map((price) => ({
          quantity: price.quantity,
          unitCost: price.convertedPrice ?? price.price,
          currency: price.convertedCurrency || price.currency,
        })), quantity);
        const normalized = offer({
          id: `nexar:${supplier}:${row.sku || part.mpn}:${offers.length}`,
          adapter: "nexar",
          supplier,
          sku: row.sku,
          mpn: part.mpn,
          description: part.shortDescription || part.name,
          unitCost: picked?.unitCost,
          currency: picked?.currency,
          quantityBreak: picked?.quantity,
          availability: row.inventoryLevel != null ? String(row.inventoryLevel) : "",
          url: row.clickUrl,
          fetchedAt: row.updated || fetchedAt,
        });
        if (normalized) offers.push(normalized);
      }
    }
  }
  return offers;
}

function normalizeElement14(payload, quantity, fetchedAt) {
  const products = payload?.keywordSearchReturn?.products || payload?.manufacturerPartNumberSearchReturn?.products || [];
  return products.map((product, index) => {
    const picked = pickUnitPrice((product.prices || []).map((row) => ({ quantity: row.from, unitCost: row.cost })), quantity);
    return offer({
      id: `element14:${product.sku || index}`,
      adapter: "element14",
      supplier: "Newark / element14",
      sku: product.sku,
      mpn: product.translatedManufacturerPartNumber,
      description: product.displayName,
      unit: product.unitOfMeasure,
      unitCost: picked?.unitCost,
      currency: picked?.currency,
      quantityBreak: picked?.quantity,
      availability: product.productStatus,
      url: product.productURL,
      fetchedAt,
    });
  }).filter(Boolean);
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
    throw new Error(payload?.message || payload?.error_description || payload?.title || `HTTP ${response.status}`);
  }
  return payload;
}

const tokenCache = new Map();

async function token(cacheKey, url, body) {
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const payload = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body).toString(),
  });
  if (!payload.access_token) throw new Error("Catalog token response had no access_token.");
  tokenCache.set(cacheKey, {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 600) * 1000,
  });
  return payload.access_token;
}

async function searchMouser(query, env, quantity, limit) {
  const payload = await fetchJson(`https://api.mouser.com/api/v1/search/keyword?apiKey=${encodeURIComponent(env.MOUSER_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ SearchByKeywordRequest: { keyword: query, records: limit, startingRecord: 0 } }),
  });
  if (payload?.Errors?.length) throw new Error(payload.Errors.map((row) => row.Message || row.message).filter(Boolean).join("; ") || "Mouser search failed.");
  return normalizeMouser(payload, quantity, new Date().toISOString());
}

async function searchDigikey(query, env, quantity, limit) {
  const sandbox = /^(1|true|yes)$/i.test(clean(env.DIGIKEY_SANDBOX));
  const host = sandbox ? "https://sandbox-api.digikey.com" : "https://api.digikey.com";
  const access = await token(`digikey:${sandbox}:${env.DIGIKEY_CLIENT_ID}`, `${host}/v1/oauth2/token`, {
    client_id: env.DIGIKEY_CLIENT_ID,
    client_secret: env.DIGIKEY_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  const payload = await fetchJson(`${host}/products/v4/search/keyword`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "X-DIGIKEY-Client-Id": env.DIGIKEY_CLIENT_ID,
      "X-DIGIKEY-Locale-Site": "US",
      "X-DIGIKEY-Locale-Language": "en",
      "X-DIGIKEY-Locale-Currency": "USD",
      "X-DIGIKEY-Locale-ShipToCountry": "US",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ Keywords: query, RecordCount: limit, RecordStartPosition: 0 }),
  });
  return normalizeDigikey(payload, quantity, new Date().toISOString());
}

async function searchNexar(query, env, quantity, limit) {
  const access = await token(`nexar:${env.NEXAR_CLIENT_ID}`, "https://identity.nexar.com/connect/token", {
    client_id: env.NEXAR_CLIENT_ID,
    client_secret: env.NEXAR_CLIENT_SECRET,
    grant_type: "client_credentials",
    scope: "supply.domain",
  });
  const payload = await fetchJson("https://api.nexar.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: NEXAR_SEARCH, variables: { q: query, limit } }),
  });
  if (payload?.errors?.length) throw new Error(payload.errors.map((row) => row.message).filter(Boolean).join("; ") || "Nexar search failed.");
  return normalizeNexar(payload, quantity, new Date().toISOString());
}

async function searchElement14(query, env, quantity, limit) {
  const url = new URL("https://api.element14.com/catalog/products");
  url.searchParams.set("term", `any:${query}`);
  url.searchParams.set("storeInfo.id", clean(env.ELEMENT14_STORE_ID) || "us");
  url.searchParams.set("resultsSettings.offset", "0");
  url.searchParams.set("resultsSettings.numberOfResults", String(limit));
  url.searchParams.set("resultsSettings.responseGroup", "medium");
  url.searchParams.set("callInfo.apiKey", env.ELEMENT14_API_KEY);
  url.searchParams.set("callInfo.responseDataFormat", "JSON");
  return normalizeElement14(await fetchJson(url), quantity, new Date().toISOString());
}

async function searchGateway(adapter, query, env, quantity, limit) {
  const base = clean(env.SUPPLIER_GATEWAY_URL).replace(/\/+$/, "");
  const payload = await fetchJson(`${base}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clean(env.SUPPLIER_GATEWAY_TOKEN)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ supplier: adapter.id, supplierName: adapter.supplier, query, quantity, limit }),
  });
  const rows = Array.isArray(payload) ? payload : (payload.results || payload.offers || []);
  return rows.map((row, index) => offer({
    id: row.id || `${adapter.id}:${row.sku || row.mpn || index}`,
    adapter: adapter.id,
    supplier: row.supplier || adapter.supplier,
    sku: row.sku || row.itemNumber || row.catalogNumber,
    mpn: row.mpn || row.manufacturerPartNumber,
    description: row.description || row.name,
    unit: row.unit || row.uom || "EA",
    unitCost: row.unitCost ?? row.price ?? row.unitPrice,
    currency: row.currency || "USD",
    quantityBreak: row.quantityBreak || row.minQty || 1,
    availability: row.availability || row.stock || row.inventory,
    url: row.url || row.productUrl,
    fetchedAt: row.fetchedAt || new Date().toISOString(),
  })).filter(Boolean);
}

const SEARCHERS = { mouser: searchMouser, digikey: searchDigikey, nexar: searchNexar, element14: searchElement14 };

export async function searchLiveSupplierCatalogs(query, { env = {}, quantity = 1, limit = 8 } = {}) {
  const q = clean(query);
  const configured = configuredIds(env);
  const diagnostics = liveCatalogDiagnostics(env);
  if (!q) {
    return { query: q, configured, diagnostics, results: [], errors: [], message: "Enter a model, SKU, or description to search live catalogs." };
  }
  if (!configured.length) {
    return {
      query: q,
      configured: [],
      diagnostics,
      results: [],
      errors: [],
      message: "No live supplier connections are configured. Add supplier credentials or the authorized supplier gateway. Estim8r will not invent prices.",
    };
  }
  const settled = await Promise.allSettled(configured.map(async (id) => {
    const adapter = ADAPTERS.find((row) => row.id === id);
    return adapter.gateway
      ? searchGateway(adapter, q, env, quantity, limit)
      : SEARCHERS[id](q, env, quantity, limit);
  }));
  const results = [];
  const errors = [];
  for (const item of settled) {
    if (item.status === "fulfilled") results.push(...item.value);
    else errors.push({ message: item.reason?.message || String(item.reason) });
  }
  results.sort((a, b) => a.unitCost - b.unitCost);
  return {
    query: q,
    configured,
    diagnostics,
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
