import assert from "node:assert/strict";
import {
  applySupplierOfferToLine,
  catalogQueryForLine,
  configuredLiveCatalogAdapters,
  money,
  normalizeDigikeyResponse,
  normalizeElement14Response,
  normalizeMouserResponse,
  normalizeNexarResponse,
  pickAutoApplyOffer,
  pickUnitPrice,
} from "../src/domain/estimate/liveSupplierCatalog.js";
import { searchLiveSupplierCatalogs } from "../src/domain/estimate/liveSupplierCatalogSearch.js";
import {
  isStaticHostCatalogRejection,
  shouldUseLiveCatalogDevProxy,
} from "../src/api/liveSupplierCatalogHost.js";

assert.equal(money(null), null);
assert.equal(money("n/a"), null);
assert.equal(money("$12.50"), 12.5);
assert.equal(catalogQueryForLine({ model: "ABC123", description: "3/4 EMT" }), "ABC123 3/4 EMT");
assert.equal(catalogQueryForLine({}).length, 0);
assert.equal(configuredLiveCatalogAdapters({}).length, 0);
assert.deepEqual(configuredLiveCatalogAdapters({ MOUSER_API_KEY: "k" }).map((row) => row.id), ["mouser"]);
assert.deepEqual(pickUnitPrice([{ quantity: 1, unitCost: 10 }, { quantity: 10, unitCost: 8 }, { quantity: 100, unitCost: 6 }], 25), {
  quantity: 10,
  unitCost: 8,
  currency: "USD",
});

const mouser = normalizeMouserResponse({
  SearchResults: {
    Parts: [
      { MouserPartNumber: "M1", ManufacturerPartNumber: "ABC123", Description: "3/4 EMT", PriceBreaks: [{ Quantity: 1, Price: "$12.50", Currency: "USD" }], ProductDetailUrl: "https://www.mouser.com/m1" },
      { MouserPartNumber: "M2", Description: "No price" },
    ],
  },
});
assert.equal(mouser.length, 1);
assert.equal(mouser[0].unitCost, 12.5);

const empty = await searchLiveSupplierCatalogs("EMT conduit", { env: {} });
assert.equal(empty.results.length, 0);
assert.equal(empty.configured.length, 0);
assert.match(empty.message, /will not invent prices/);

const next = applySupplierOfferToLine(
  { id: "1", description: "Timer", materialUnitCost: 0, materialPriceHistory: [] },
  { supplier: "Digi-Key", mpn: "LM555", sku: "LM555-ND", unitCost: 0.52, url: "https://www.digikey.com/p", description: "Timer IC" },
  { now: new Date("2026-09-30T12:00:00.000Z") },
);
assert.equal(next.materialUnitCost, 0.52);
assert.equal(next.materialPriceMeta.sourceType, "Supplier catalog");
assert.equal(pickAutoApplyOffer({ description: "box" }, [{ mpn: "ZZZ", description: "3/4 EMT", unitCost: 8, supplier: "Digi-Key" }]), null);

assert.equal(normalizeDigikeyResponse({
  Products: [{
    ManufacturerProductNumber: "LM555",
    Description: { ProductDescription: "Timer IC" },
    ProductVariations: [{ DigiKeyProductNumber: "LM555-ND", StandardPricing: [{ BreakQuantity: 1, UnitPrice: 0.52 }] }],
  }],
})[0].unitCost, 0.52);

assert.equal(normalizeNexarResponse({
  data: {
    supSearch: {
      results: [{
        part: {
          mpn: "X1",
          shortDescription: "Relay",
          sellers: [
            { isAuthorized: false, company: { name: "Gray" }, offers: [{ sku: "g", prices: [{ quantity: 1, price: 1 }] }] },
            { isAuthorized: true, company: { name: "Arrow" }, offers: [{ sku: "a1", prices: [{ quantity: 1, price: 4.2, currency: "USD" }] }] },
          ],
        },
      }],
    },
  },
}).length, 1);

assert.equal(normalizeElement14Response({
  keywordSearchReturn: { products: [{ sku: "11X123", translatedManufacturerPartNumber: "WH20-14", displayName: "THHN 14 AWG", prices: [{ from: 1, cost: 0.18 }] }] },
})[0].unitCost, 0.18);

assert.equal(shouldUseLiveCatalogDevProxy({ isDev: false, hostname: "estim8r.currentflowconsulting.org" }), false);
assert.equal(isStaticHostCatalogRejection({ status: 405 }, "<html><head><title>405 Not Allowed</title></head></html>"), true);

console.log("live catalog tests passed");
