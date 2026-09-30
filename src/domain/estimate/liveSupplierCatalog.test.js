import { describe, expect, it } from "vitest";
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
} from "./liveSupplierCatalog.js";

describe("live supplier catalog", () => {
  it("does not invent a unit price from empty or junk values", () => {
    expect(money(null)).toBeNull();
    expect(money("n/a")).toBeNull();
    expect(money("$12.50")).toBe(12.5);
  });

  it("builds a catalog query from the estimate line without filler", () => {
    expect(catalogQueryForLine({ model: "ABC123", description: "3/4 EMT" })).toBe("ABC123 3/4 EMT");
    expect(catalogQueryForLine({})).toBe("");
  });

  it("lists only adapters whose secrets are present", () => {
    expect(configuredLiveCatalogAdapters({})).toEqual([]);
    expect(configuredLiveCatalogAdapters({ MOUSER_API_KEY: "k" }).map((row) => row.id)).toEqual(["mouser"]);
  });

  it("picks the quantity break that applies", () => {
    const picked = pickUnitPrice([
      { quantity: 1, unitCost: 10 },
      { quantity: 10, unitCost: 8 },
      { quantity: 100, unitCost: 6 },
    ], 25);
    expect(picked).toMatchObject({ quantity: 10, unitCost: 8 });
  });

  it("keeps Mouser rows that have a live price and drops those that do not", () => {
    const offers = normalizeMouserResponse({
      SearchResults: {
        Parts: [
          { MouserPartNumber: "M1", ManufacturerPartNumber: "ABC123", Description: "3/4 EMT", PriceBreaks: [{ Quantity: 1, Price: "$12.50", Currency: "USD" }], ProductDetailUrl: "https://www.mouser.com/m1" },
          { MouserPartNumber: "M2", Description: "No price" },
        ],
      },
    });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ supplier: "Mouser", mpn: "ABC123", unitCost: 12.5, live: true });
  });

  it("reads Digi-Key list prices from standard breaks", () => {
    const offers = normalizeDigikeyResponse({
      Products: [{
        ManufacturerProductNumber: "LM555",
        Description: { ProductDescription: "Timer IC" },
        ProductUrl: "https://www.digikey.com/p",
        ProductVariations: [{ DigiKeyProductNumber: "LM555-ND", StandardPricing: [{ BreakQuantity: 1, UnitPrice: 0.52 }] }],
      }],
    });
    expect(offers[0]).toMatchObject({ supplier: "Digi-Key", sku: "LM555-ND", unitCost: 0.52 });
  });

  it("reads authorized Nexar distributor offers only", () => {
    const offers = normalizeNexarResponse({
      data: {
        supSearch: {
          results: [{
            part: {
              mpn: "X1",
              shortDescription: "Relay",
              sellers: [
                { isAuthorized: false, company: { name: "Gray" }, offers: [{ sku: "g", prices: [{ quantity: 1, price: 1 }] }] },
                { isAuthorized: true, company: { name: "Arrow" }, offers: [{ sku: "a1", clickUrl: "https://arrow.example/a1", prices: [{ quantity: 1, price: 4.2, currency: "USD" }] }] },
              ],
            },
          }],
        },
      },
    });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ supplier: "Arrow", sku: "a1", unitCost: 4.2 });
  });

  it("reads Newark / element14 priced products", () => {
    const offers = normalizeElement14Response({
      keywordSearchReturn: {
        products: [{
          sku: "11X123",
          translatedManufacturerPartNumber: "WH20-14",
          displayName: "THHN 14 AWG",
          prices: [{ from: 1, cost: 0.18 }],
        }],
      },
    });
    expect(offers[0]).toMatchObject({ supplier: "Newark / element14", mpn: "WH20-14", unitCost: 0.18 });
  });

  it("auto-applies only a strong model/SKU match", () => {
    const line = { model: "ABC123", description: "3/4 EMT" };
    const offers = [
      { mpn: "ABC123", description: "3/4 EMT coupling", unitCost: 9, supplier: "Mouser" },
      { mpn: "ZZZ", description: "3/4 EMT", unitCost: 8, supplier: "Digi-Key" },
    ];
    expect(pickAutoApplyOffer(line, offers).mpn).toBe("ABC123");
    expect(pickAutoApplyOffer({ description: "box" }, offers)).toBeNull();
  });

  it("writes a live catalog price onto the estimate line", () => {
    const next = applySupplierOfferToLine(
      { id: "1", description: "Timer", materialUnitCost: 0, materialPriceHistory: [] },
      { supplier: "Digi-Key", mpn: "LM555", sku: "LM555-ND", unitCost: 0.52, url: "https://www.digikey.com/p", description: "Timer IC" },
      { now: new Date("2026-09-30T12:00:00.000Z") },
    );
    expect(next.materialUnitCost).toBe(0.52);
    expect(next.model).toBe("LM555");
    expect(next.materialPriceMeta).toMatchObject({
      sourceType: "Supplier catalog",
      supplier: "Digi-Key",
      reference: "LM555-ND",
      effectiveDate: "2026-09-30",
    });
    expect(next.materialPriceHistory[0].unitCost).toBe(0.52);
  });
});
