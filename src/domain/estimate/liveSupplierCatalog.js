import { appendMaterialPriceHistory } from "./materialPricing.js";

export const LIVE_CATALOG_SOURCE_TYPE = "Supplier catalog";
export const AUTO_APPLY_MIN_SCORE = 90;

export const LIVE_CATALOG_ADAPTERS = [
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

function clean(value) {
  return String(value ?? "").trim();
}

function key(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function money(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!/[0-9]/.test(raw)) return null;
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function catalogQueryForLine(line = {}) {
  return [line.model, line.modelNumber, line.catalogNumber, line.description, line.category]
    .map(clean)
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((other) => key(other) === key(part)) === index)
    .join(" ");
}

function adapterConfigured(adapter, env = {}) {
  if (adapter.gateway) return Boolean(clean(env.SUPPLIER_GATEWAY_URL) && clean(env.SUPPLIER_GATEWAY_TOKEN));
  if (adapter.anyEnv) return adapter.anyEnv.some((group) => group.every((name) => clean(env[name])));
  return (adapter.env || []).every((name) => clean(env[name]));
}

export function configuredLiveCatalogAdapters(env = {}) {
  return LIVE_CATALOG_ADAPTERS.filter((adapter) => adapterConfigured(adapter, env));
}

export function liveCatalogDiagnostics(env = {}) {
  return LIVE_CATALOG_ADAPTERS.map((adapter) => {
    const configured = adapterConfigured(adapter, env);
    let reason = "";
    if (!configured) {
      if (adapter.gateway) reason = "Needs SUPPLIER_GATEWAY_URL and SUPPLIER_GATEWAY_TOKEN for authorized account pricing.";
      else if (adapter.id === "lowes") reason = "Needs Lowe's partner API credentials/access token.";
      else reason = `Missing ${(adapter.env || []).join(", ")}.`;
    }
    return { id: adapter.id, supplier: adapter.supplier, mode: adapter.mode, configured, reason };
  });
}

export function pickUnitPrice(breaks = [], quantity = 1) {
  const qty = Math.max(1, Number(quantity) || 1);
  const priced = (Array.isArray(breaks) ? breaks : [])
    .map((row) => ({
      quantity: Math.max(1, Number(row.quantity) || 1),
      unitCost: money(row.unitCost ?? row.price),
      currency: clean(row.currency) || "USD",
    }))
    .filter((row) => row.unitCost != null)
    .sort((a, b) => a.quantity - b.quantity);
  if (!priced.length) return null;
  let chosen = priced[0];
  for (const row of priced) {
    if (row.quantity <= qty) chosen = row;
  }
  return chosen;
}

export function normalizeLiveOffer(input = {}) {
  const unitCost = money(input.unitCost);
  const supplier = clean(input.supplier);
  const sku = clean(input.sku);
  const mpn = clean(input.mpn);
  const description = clean(input.description);
  if (unitCost == null || !supplier || !(sku || mpn || description)) return null;
  return {
    id: clean(input.id) || [supplier, sku || mpn, description].filter(Boolean).join(":"),
    adapter: clean(input.adapter),
    supplier,
    sku,
    mpn,
    description,
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

export function scoreLiveOffer(line, offer) {
  const model = key(line?.model || line?.modelNumber || line?.catalogNumber);
  const description = key(line?.description);
  const offerModel = key(offer?.mpn || offer?.sku);
  const offerDescription = key(offer?.description);
  if (model && offerModel && model === offerModel) return 100;
  if (model && offerModel && (model.includes(offerModel) || offerModel.includes(model))) return 92;
  if (description && offerDescription && description === offerDescription) return 80;
  if (description && offerDescription) {
    const words = new Set(description.split(" ").filter((word) => word.length > 2));
    const other = new Set(offerDescription.split(" ").filter((word) => word.length > 2));
    const overlap = [...words].filter((word) => other.has(word)).length;
    return Math.round(70 * overlap / Math.max(words.size, other.size, 1));
  }
  return 0;
}

export function rankLiveOffers(line, offers = []) {
  return offers
    .map((offer) => ({ ...offer, matchScore: scoreLiveOffer(line, offer) }))
    .sort((a, b) => b.matchScore - a.matchScore || a.unitCost - b.unitCost);
}

export function pickAutoApplyOffer(line, offers = []) {
  const ranked = rankLiveOffers(line, offers);
  const exact = ranked.find((offer) => offer.matchScore >= AUTO_APPLY_MIN_SCORE);
  return exact || null;
}

export function applySupplierOfferToLine(line, offer, {
  sourceType = LIVE_CATALOG_SOURCE_TYPE,
  now = new Date(),
} = {}) {
  const unitCost = money(offer?.unitCost);
  if (!line || unitCost == null) return line;
  const capturedAt = now.toISOString();
  const effectiveDate = clean(offer?.effectiveDate) || capturedAt.slice(0, 10);
  const next = {
    ...line,
    materialUnitCost: unitCost,
    materialCostEdited: true,
    model: clean(line.model) || clean(offer?.mpn) || clean(offer?.sku) || clean(line.model),
    materialPriceMeta: {
      sourceType,
      supplier: clean(offer?.supplier),
      reference: clean(offer?.reference) || clean(offer?.sku) || clean(offer?.url),
      effectiveDate,
      capturedAt,
      notes: [clean(offer?.description), clean(offer?.url)].filter(Boolean).join(" · "),
    },
  };
  next.materialPriceHistory = appendMaterialPriceHistory(line.materialPriceHistory || [], next, capturedAt);
  return next;
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeMouserResponse(payload, { fetchedAt, quantity = 1 } = {}) {
  const parts = payload?.SearchResults?.Parts || payload?.Parts || [];
  return parts.map((part, index) => {
    const picked = pickUnitPrice(
      (part.PriceBreaks || []).map((row) => ({
        quantity: row.Quantity,
        unitCost: row.Price,
        currency: row.Currency,
      })),
      quantity,
    );
    return normalizeLiveOffer({
      id: `mouser:${part.MouserPartNumber || index}`,
      adapter: "mouser",
      supplier: "Mouser",
      sku: part.MouserPartNumber,
      mpn: part.ManufacturerPartNumber,
      description: part.Description || [part.Manufacturer, part.ManufacturerPartNumber].filter(Boolean).join(" "),
      unitCost: picked?.unitCost,
      currency: picked?.currency,
      quantityBreak: picked?.quantity,
      availability: part.Availability,
      url: part.ProductDetailUrl,
      fetchedAt,
    });
  }).filter(Boolean);
}

export function normalizeDigikeyResponse(payload, { fetchedAt, quantity = 1 } = {}) {
  const products = payload?.Products || payload?.ExactMatches || [];
  return products.map((product, index) => {
    const variation = first(product.ProductVariations) || {};
    const pricing = variation.StandardPricing || product.StandardPricing || [];
    const picked = pickUnitPrice(
      pricing.map((row) => ({
        quantity: row.BreakQuantity ?? row.Quantity,
        unitCost: row.UnitPrice ?? row.Price,
        currency: row.Currency || "USD",
      })),
      quantity,
    );
    const description = clean(product.Description?.ProductDescription)
      || clean(product.Description)
      || clean(product.DetailedDescription);
    return normalizeLiveOffer({
      id: `digikey:${variation.DigiKeyProductNumber || product.ManufacturerProductNumber || index}`,
      adapter: "digikey",
      supplier: "Digi-Key",
      sku: variation.DigiKeyProductNumber || product.DigiKeyProductNumber,
      mpn: product.ManufacturerProductNumber || product.ManufacturerPartNumber,
      description,
      unitCost: picked?.unitCost ?? money(product.UnitPrice),
      currency: picked?.currency || "USD",
      quantityBreak: picked?.quantity,
      availability: product.QuantityAvailable != null ? String(product.QuantityAvailable) : "",
      url: product.ProductUrl,
      fetchedAt,
    });
  }).filter(Boolean);
}

export function normalizeNexarResponse(payload, { fetchedAt, quantity = 1 } = {}) {
  const results = payload?.data?.supSearch?.results
    || payload?.data?.supSearchMpn?.results
    || [];
  const offers = [];
  for (const result of results) {
    const part = result.part || result;
    for (const seller of part.sellers || []) {
      if (seller.isAuthorized === false) continue;
      const supplier = clean(seller.company?.name) || "Nexar distributor";
      for (const offer of seller.offers || []) {
        const picked = pickUnitPrice(
          (offer.prices || []).map((row) => ({
            quantity: row.quantity,
            unitCost: row.convertedPrice ?? row.price,
            currency: row.convertedCurrency || row.currency,
          })),
          quantity,
        );
        const normalized = normalizeLiveOffer({
          id: `nexar:${supplier}:${offer.sku || part.mpn}:${offers.length}`,
          adapter: "nexar",
          supplier,
          sku: offer.sku,
          mpn: part.mpn,
          description: part.shortDescription || part.name || [part.manufacturer?.name, part.mpn].filter(Boolean).join(" "),
          unitCost: picked?.unitCost,
          currency: picked?.currency,
          quantityBreak: picked?.quantity,
          availability: offer.inventoryLevel != null ? String(offer.inventoryLevel) : "",
          url: offer.clickUrl,
          fetchedAt: offer.updated || fetchedAt,
        });
        if (normalized) offers.push(normalized);
      }
    }
  }
  return offers;
}

export function normalizeElement14Response(payload, { fetchedAt, quantity = 1 } = {}) {
  const block = payload?.keywordSearchReturn
    || payload?.manufacturerPartNumberSearchReturn
    || payload?.products
    || payload;
  const products = block?.products || block?.Products || [];
  return products.map((product, index) => {
    const picked = pickUnitPrice(
      (product.prices || []).map((row) => ({
        quantity: row.from ?? row.Quantity,
        unitCost: row.cost ?? row.Price,
        currency: row.currency || "USD",
      })),
      quantity,
    );
    return normalizeLiveOffer({
      id: `element14:${product.sku || index}`,
      adapter: "element14",
      supplier: "Newark / element14",
      sku: product.sku,
      mpn: product.translatedManufacturerPartNumber || product.manufacturerPartNumber,
      description: product.displayName || product.summaryDescription,
      unit: product.unitOfMeasure,
      unitCost: picked?.unitCost,
      currency: picked?.currency,
      quantityBreak: picked?.quantity,
      availability: product.productStatus,
      url: product.productURL || product.datasheets?.[0]?.url,
      fetchedAt,
    });
  }).filter(Boolean);
}
