import { describe, expect, it } from "vitest";
import { formatMoney } from "./formatMoney.js";

describe("USD formatting", () => {
  it("adds thousands separators and cents", () => {
    expect(formatMoney(100000)).toBe("$100,000.00");
    expect(formatMoney(1234567.89)).toBe("$1,234,567.89");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(-1250.5)).toBe("-$1,250.50");
  });
});
