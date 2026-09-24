import { describe, expect, it } from "vitest";
import { assemblyToEstimateLines, validateAssembly } from "./assemblies.js";

describe("assemblies", () => {
  it("requires a name and components", () => {
    expect(validateAssembly({}).valid).toBe(false);
  });

  it("expands component quantities into independent estimate lines", () => {
    const assembly = {
      id: "branch",
      name: "Branch circuit",
      components: [
        { id: "raceway", description: "EMT", quantity: 100, unit: "LF", laborMhPerUnit: 0.02 },
        { id: "boxes", description: "Boxes", quantity: 4, unit: "EA", laborMhPerUnit: 0.25 },
      ],
    };
    const lines = assemblyToEstimateLines(assembly, 2, 60);
    expect(lines.map((line) => line.quantity)).toEqual([200, 8]);
    expect(lines[0].assemblyId).toBe("branch");
    expect(lines[0].laborRate).toBe(60);
  });
});
