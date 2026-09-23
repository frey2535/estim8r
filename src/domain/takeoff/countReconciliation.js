import { parseScheduleRows, scheduleQuantityFromTokens } from "./drawing-docs.js";
import { pageMatchesTrade } from "./sheetDiscipline.js";
import { isPersistedPlanDetection, normalizeTypeMark, taggedEquipmentCode } from "./symbolDetection.js";

export { scheduleQuantityFromTokens };

export function typeKey(value) {
  const tagged = taggedEquipmentCode(value);
  if (tagged) return tagged;
  const text = normalizeTypeMark(value).toUpperCase();
  if (text === "GFIWP" || text === "WPGFI" || text === "GFI/WP") return "GFI/WP";
  return text;
}

function tokenRows(tokens = []) {
  const sorted = [...tokens].sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0) || (Number(a.x) || 0) - (Number(b.x) || 0));
  const rows = [];
  for (const token of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs((Number(token.y) || 0) - last.y) <= 1.2) last.tokens.push(token);
    else rows.push({ y: Number(token.y) || 0, tokens: [token] });
  }
  return rows.map((row) => {
    const cells = row.tokens.map((token) => String(token.text || "").trim()).filter(Boolean);
    return { y: row.y, tokens: cells, text: cells.join(" ") };
  }).filter((row) => row.text);
}

export function scheduleItemsFromPages(pages, trade) {
  const items = [];
  for (const page of pages || []) {
    const kind = String(page.kind || "");
    if (!kind.includes("schedule") && kind !== "legend") continue;
    if (trade && !pageMatchesTrade(page, trade)) continue;
    const rows = tokenRows(page.tokens || []);
    const hasQtyColumn = rows.some((row) => /\bqty\b|\bquantity\b/i.test(row.text));
    items.push(...parseScheduleRows(rows, kind || "legend", { hasQtyColumn, kind }));
  }
  return items;
}

export function reconcilePlanToSchedule({ marks, scheduleItems = [], pages = [], pageKinds = {}, trade } = {}) {
  const planCounts = new Map();
  for (const mark of marks || []) {
    if (!isPersistedPlanDetection(mark, pageKinds)) continue;
    const key = typeKey(mark.typeCode || mark.abbr);
    if (!key) continue;
    planCounts.set(key, (planCounts.get(key) || 0) + 1);
  }

  const fromPages = pages.length ? scheduleItemsFromPages(pages, trade) : [];
  const schedule = new Map();
  for (const item of [...fromPages, ...scheduleItems]) {
    const key = typeKey(item.type || item.abbr);
    const qty = item.scheduleQty;
    if (!key || qty == null) continue;
    const previous = schedule.get(key);
    if (previous == null || qty > previous) schedule.set(key, qty);
  }

  const keys = [...new Set([...planCounts.keys(), ...schedule.keys()])].sort();
  const rows = keys.map((type) => {
    const planCount = planCounts.get(type) || 0;
    const scheduleQty = schedule.has(type) ? schedule.get(type) : null;
    let status = "plan-only";
    if (scheduleQty != null) {
      if (planCount === scheduleQty) status = "match";
      else if (planCount < scheduleQty) status = "short";
      else status = "over";
    }
    return {
      type,
      planCount,
      scheduleQty,
      persistedCount: planCount,
      status,
    };
  });

  return {
    rows,
    persistedCount: [...planCounts.values()].reduce((sum, value) => sum + value, 0),
    discrepancyCount: rows.filter((row) => row.status === "short" || row.status === "over").length,
  };
}

export function describeReconciliation(result) {
  if (!result?.rows?.length) return "No schedule quantities were printed next to legend types. Plan counts stay as the takeoff.";
  if (!result.discrepancyCount) {
    return `Plan counts match the printed schedule quantities for ${result.rows.length} type${result.rows.length === 1 ? "" : "s"}. Takeoff still uses the plan detections.`;
  }
  return `${result.discrepancyCount} type${result.discrepancyCount === 1 ? "" : "s"} differ from the printed schedule quantity. The takeoff keeps the plan count, not the legend total.`;
}
