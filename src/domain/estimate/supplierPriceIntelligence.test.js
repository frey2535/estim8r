import { describe, expect, it } from "vitest";
import { matchSupplierPrices, parseSupplierPriceCsv, supplierComparison } from "./supplierPriceIntelligence.js";
describe("supplier price intelligence", () => {
  it("imports common supplier CSV columns", () => {
    const rows = parseSupplierPriceCsv("SKU,Description,Unit Price,UOM\nABC123,3/4 EMT,12.50,EA", { supplier: "Supplier A", effectiveDate: "2026-09-24" });
    expect(rows[0]).toMatchObject({ model: "ABC123", description: "3/4 EMT", unitCost: 12.5, supplier: "Supplier A" });
  });
  it("prioritizes exact model matches", () => {
    const rows = [{ id: "1", model: "ABC123", description: "Other", unitCost: 10 }, { id: "2", description: "3/4 EMT", unitCost: 9 }];
    expect(matchSupplierPrices({ model: "ABC123", description: "3/4 EMT" }, rows)[0].id).toBe("1");
  });
  it("compares multiple supplier books", () => {
    const result = supplierComparison({ model: "X1" }, [{ supplier: "A", rows: [{ id: "a", model: "X1", unitCost: 8 }] }, { supplier: "B", rows: [{ id: "b", model: "X1", unitCost: 7 }] }]);
    expect(result).toHaveLength(2);
  });
});
