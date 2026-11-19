import { describe, it, expect } from "vitest";

/** Model the safety decision for a remote snapshot refresh. */
function reconcile(local, baseline, remote) {
  if (!local) return "import";
  if (local.id !== remote.id) return "conflict";
  if (JSON.stringify(local) === JSON.stringify(remote)) return "unchanged";
  if (!baseline || JSON.stringify(local) !== JSON.stringify(baseline)) return "conflict";
  return "refresh";
}

describe("company snapshot reconciliation safety", () => {
  const old = { id: "estimate-1", fileName: "drawing.pdf", lines: [1] };
  const next = { ...old, lines: [1, 2] };
  it("imports missing estimates", () => expect(reconcile(null, null, next)).toBe("import"));
  it("refreshes unchanged cached copies", () => expect(reconcile(old, old, next)).toBe("refresh"));
  it("preserves locally modified copies", () => expect(reconcile({ ...old, lines: [3] }, old, next)).toBe("conflict"));
  it("does not overwrite unknown existing drafts", () => expect(reconcile(old, null, next)).toBe("conflict"));
  it("does not conflate estimates with different ids", () => expect(reconcile({ ...old, id: "other" }, old, next)).toBe("conflict"));
});
