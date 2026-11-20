import { describe, expect, it } from "vitest";
import { applySupplierOfferToLine, LIVE_CATALOG_SOURCE_TYPE } from "../src/domain/estimate/liveSupplierCatalog.js";

const line = () => ({ id: "line-1", model: "ABC123", quantity: 10, materialUnitCost: 0, materialPriceHistory: [] });
const catalog = { unitCost: 2.25, supplier: "Catalog Supplier", mpn: "ABC123", url: "https://supplier.example/products/ABC123", unit: "EA" };
const quote = { unitCost: 1.78, supplier: "Account Supplier", reference: "Q-123" };

describe("dual supplier prices", () => {
  it("retains online catalog source and direct product URL", () => {
    const priced = applySupplierOfferToLine(line(), catalog);
    expect(priced.onlineCatalogPrice).toBe(2.25);
    expect(priced.onlineCatalogOffer.url).toBe(catalog.url);
    expect(priced.materialUnitCost).toBe(2.25);
  });
  it("uses a supplier quote without discarding catalog verification", () => {
    const priced = applySupplierOfferToLine(applySupplierOfferToLine(line(), catalog), quote, { sourceType: "Supplier quote" });
    expect(priced.supplierQuotedPrice).toBe(1.78);
    expect(priced.onlineCatalogPrice).toBe(2.25);
    expect(priced.materialUnitCost).toBe(1.78);
  });
  it("does not overwrite an accepted quote when catalog price changes", () => {
    const quoted = applySupplierOfferToLine(applySupplierOfferToLine(line(), catalog), quote, { sourceType: "Supplier quote" });
    const updated = applySupplierOfferToLine(quoted, { ...catalog, unitCost: 3.15 }, { sourceType: LIVE_CATALOG_SOURCE_TYPE });
    expect(updated.onlineCatalogPrice).toBe(3.15);
    expect(updated.materialUnitCost).toBe(1.78);
    expect(updated.materialPriceMeta.sourceType).toBe("Supplier quote");
  });
  it("does not replace a manually selected working price", () => {
    const manual = { ...line(), materialUnitCost: 1.45, materialPriceMeta: { sourceType: "Manual" } };
    const updated = applySupplierOfferToLine(manual, catalog);
    expect(updated.materialUnitCost).toBe(1.45);
    expect(updated.onlineCatalogPrice).toBe(2.25);
  });
  it("ignores invalid supplier prices", () => {
    expect(applySupplierOfferToLine(line(), { ...catalog, unitCost: "unavailable" })).toEqual(line());
  });
});
