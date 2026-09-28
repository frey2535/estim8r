import { describe, expect, it } from "vitest";
import { DEFAULT_ASSEMBLIES, assemblyToEstimateLines, validateAssembly } from "./assemblies.js";

describe("assemblies", () => {
  it("requires a name and components", () => {
    expect(validateAssembly({}).valid).toBe(false);
  

  it("ships a component-built whole-home generator template that requires labor review", () => {
    const generator = DEFAULT_ASSEMBLIES.find((row) => row.id === "system-whole-home-standby-generator");
    expect(generator).toBeTruthy();
    expect(generator.components.map((row) => row.description)).toEqual(expect.arrayContaining([
      "Install standby generator set",
      "Install automatic transfer switch",
      "Generator feeder raceway",
      "Generator feeder conductors",
      "Generator control / start wiring",
      "Generator / ATS grounding and bonding",
      "Generator startup, testing, and commissioning",
    ]));

    const lines = assemblyToEstimateLines(generator, 1, 95);
    expect(lines.length).toBe(generator.components.length);
    expect(lines.every((line) => line.laborReviewRequired)).toBe(true);
    expect(lines.every((line) => line.laborMatchStatus === "review")).toBe(true);
    expect(lines.every((line) => line.laborRate === 95)).toBe(true);
  });
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
