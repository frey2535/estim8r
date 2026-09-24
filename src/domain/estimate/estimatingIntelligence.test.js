import { describe, expect, it } from "vitest";
import {
  auditEstimateCompleteness,
  defaultCompletenessChecklist,
  expandAssembly,
  installedCost,
  rollupByDrawing,
} from "./estimatingIntelligence.js";

describe("estimating intelligence", () => {
  it("does not mark a bid ready until required estimate costs are addressed", () => {
    const checklist = defaultCompletenessChecklist();
    expect(auditEstimateCompleteness(checklist).bidReady).toBe(false);
    const complete = checklist.map((row) => ({ ...row, addressed: row.required }));
    expect(auditEstimateCompleteness(complete).bidReady).toBe(true);
  });

  it("separates material labor equipment and installed cost", () => {
    expect(installedCost({ quantity: 10, materialUnitCost: 5, laborMhPerUnit: 0.5, laborRate: 50, equipmentUnitCost: 2 }))
      .toEqual({ quantity: 10, material: 50, laborHours: 5, labor: 250, equipment: 20, installed: 320 });
  });

  it("expands reusable assemblies without mutating the source", () => {
    const assembly = { id: "a1", name: "Branch circuit", components: [{ item: "raceway", quantity: 100 }, { item: "box", quantity: 4 }] };
    expect(expandAssembly(assembly, 2).map((x) => x.quantity)).toEqual([200, 8]);
    expect(assembly.components[0].quantity).toBe(100);
  });

  it("keeps drawing-sheet traceability in rollups", () => {
    const rows = rollupByDrawing([
      { drawingSheet: "E1", quantity: 100, laborMhPerUnit: 0.01, laborRate: 50 },
      { drawingSheet: "E2", quantity: 50, laborMhPerUnit: 0.02, laborRate: 50 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((x) => x.sheet === "E1").laborHours).toBe(1);
  });
});
