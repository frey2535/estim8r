import { describe, expect, it } from "vitest";
import { applyInstallationConditions, defaultInstallationConditions, installationConditionSummary } from "./installationConditions.js";

describe("installation conditions", () => {
  it("defaults every condition to neutral", () => {
    expect(installationConditionSummary(defaultInstallationConditions()).multiplier).toBe(1);
  });

  it("applies only enabled estimator-entered multipliers", () => {
    const conditions = defaultInstallationConditions().map((row) =>
      row.code === "congested" ? { ...row, enabled: true, multiplier: 1.2 } : row
    );
    expect(applyInstallationConditions(0.5, conditions).adjustedMhPerUnit).toBe(0.6);
  });

  it("compounds explicit active conditions", () => {
    const conditions = defaultInstallationConditions().map((row) => {
      if (row.code === "elevated") return { ...row, enabled: true, multiplier: 1.1 };
      if (row.code === "occupied") return { ...row, enabled: true, multiplier: 1.15 };
      return row;
    });
    expect(installationConditionSummary(conditions).multiplier).toBe(1.265);
  });
});
