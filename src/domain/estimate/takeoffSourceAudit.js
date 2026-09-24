function sourceKey(category, symbol) {
  return String(category || "").toLowerCase() + "|" + String(symbol || "").toLowerCase();
}

export function buildTakeoffSourceIndex(marks = [], runs = []) {
  const byKey = new Map();
  for (const mark of marks || []) {
    const key = sourceKey(mark.category, mark.symbolLabel || mark.symbol);
    const list = byKey.get(key) || [];
    list.push({
      id: mark.id,
      kind: mark.tool === "conduit" ? "conduit" : "mark",
      sheet: mark.sheet || 1,
      tool: mark.tool || "",
      source: mark.source || "manual",
      reviewStatus: mark.reviewStatus || "",
      runNumber: mark.runNumber || null,
    });
    byKey.set(key, list);
  }
  const runById = new Map((runs || []).map((run) => [run.id, run]));
  for (const list of byKey.values()) {
    for (const item of list) {
      const run = runById.get(item.id);
      if (run) {
        item.kind = "conduit";
        item.runNumber = run.runNumber || item.runNumber;
        item.lengthLf = Number(run.lf) || 0;
        item.calibrated = Boolean(run.calibrated);
      }
    }
  }
  return byKey;
}

export function sourcesForRollupRow(row, marks = [], runs = []) {
  const index = buildTakeoffSourceIndex(marks, runs);
  return index.get(sourceKey(row?.category, row?.symbol)) || [];
}

export function summarizeLineSources(sources = []) {
  const sheets = [...new Set((sources || []).map((row) => row.sheet).filter(Boolean))].sort((a, b) => a - b);
  const runNumbers = [...new Set((sources || []).map((row) => row.runNumber).filter(Boolean))].sort((a, b) => a - b);
  const aiCount = (sources || []).filter((row) => row.source === "ai").length;
  const unresolvedAi = (sources || []).filter((row) => row.source === "ai" && row.reviewStatus !== "accepted").length;
  return { count: sources.length, sheets, runNumbers, aiCount, unresolvedAi };
}
