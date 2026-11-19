import { describe, it, expect } from "vitest";

import { decideCloudRefresh as reconcile } from "./estimateCloudRepository";

describe("company snapshot reconciliation safety", () => {
  const old = { id: "estimate-1", fileName: "drawing.pdf", lines: [1] };
  const next = { ...old, lines: [1, 2] };
  it("imports missing estimates", () => expect(reconcile(null, null, next)).toBe("import"));
  it("refreshes unchanged cached copies", () => expect(reconcile(old, old, next)).toBe("refresh"));
  it("preserves locally modified copies", () => expect(reconcile({ ...old, lines: [3] }, old, next)).toBe("conflict"));
  it("does not overwrite unknown existing drafts", () => expect(reconcile(old, null, next)).toBe("conflict"));
  it("does not conflate estimates with different ids", () => expect(reconcile({ ...old, id: "other" }, old, next)).toBe("conflict"));
});
