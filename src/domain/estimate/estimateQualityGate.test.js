import { describe, expect, it } from "vitest";
import { defaultCompletenessChecklist } from "./estimatingIntelligence.js";
import { estimateQualityGate } from "./estimateQualityGate.js";
const complete = () => defaultCompletenessChecklist().map((row) => ({ ...row, addressed: row.required }));
describe("estimate quality gate", () => {
  it("passes a documented estimate with no blockers", () => {
    const result = estimateQualityGate({ checklist: complete(), lines: [{ quantity: 1, laborItemId: "x", materialUnitCost: 10, materialPriceMeta: { sourceType: "Supplier quote", effectiveDate: new Date().toISOString().slice(0,10) } }] });
    expect(result.ready).toBe(true);
  });
  it("blocks unresolved labor and AI review", () => {
    const result = estimateQualityGate({ checklist: complete(), lines: [{ quantity: 2, laborMhPerUnit: 0, sourceAudit: { unresolvedAi: 1 } }] });
    expect(result.ready).toBe(false);
    expect(result.blockers.length).toBe(2);
  });
});
