import { isPrintedFixtureType, looksLikeElectricalPlan, parseScheduleRows, scheduleQuantityFromTokens } from "./drawing-docs.js";
import { pageMatchesTrade } from "./sheetDiscipline.js";
import { isNonPlanSheetKind, normalizeTypeMark, taggedEquipmentCode } from "./symbolDetection.js";

export { scheduleQuantityFromTokens };

export function typeKey(value) {
  const tagged = taggedEquipmentCode(value);
  if (tagged) return tagged;
  const text = normalizeTypeMark(value).toUpperCase();
  if (text === "GFIWP" || text === "WPGFI" || text === "GFI/WP") return "GFI/WP";
  return text;
}

export function markTypeKey(mark) {
  const typed = typeKey(mark?.typeCode || mark?.abbr);
  if (typed && typed !== "?" && typed !== "UNKNOWN") return typed;
  const symbol = normalizeTypeMark(mark?.symbol).toUpperCase();
  const category = String(mark?.category || "");
  const label = String(mark?.symbolLabel || "");
  const receptacle = /recept|duplex|gfi/i.test(`${symbol} ${category} ${label}`);
  if (receptacle) {
    if (/gfi/i.test(`${symbol} ${label} ${typed}`)) return "GFI";
    if (/\bWP\b/.test(symbol) || /^WP$/i.test(typed)) return "WP";
    if (/\bSP\b/.test(symbol) || /^SP$/i.test(typed)) return "SP";
    return "R";
  }
  if (symbol && symbol !== "UNKNOWN" && symbol !== "?" && isPrintedFixtureType(symbol)) return typeKey(symbol);
  if (/switch/i.test(category)) return typed || "SW";
  return "";
}

export function sheetAllowsPlanCount(mark, pageKinds = {}, pages = []) {
  const page = (pages || []).find((item) => Number(item.page) === Number(mark?.sheet));
  if (page) return looksLikeElectricalPlan(page);
  const kind = pageKinds?.[mark?.sheet];
  if (kind === "drawing") return true;
  if (isNonPlanSheetKind(kind)) return false;
  return true;
}

export function isPlanCountMark(mark, pageKinds = {}, pages = []) {
  if (!mark) return false;
  if (mark.type !== "count" && mark.type !== "drop") return false;
  if (mark.source === "legend") return false;
  if (!sheetAllowsPlanCount(mark, pageKinds, pages)) return false;
  return Boolean(markTypeKey(mark));
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
    const parsed = parseScheduleRows(rows, kind || "legend", { kind });
    items.push(...parsed.filter((item) => isPrintedFixtureType(item.type || item.abbr, item.label)));
  }
  return items;
}

export function reconcilePlanToSchedule({ marks, scheduleItems = [], pages = [], pageKinds = {}, trade } = {}) {
  const planCounts = new Map();
  for (const mark of marks || []) {
    if (!isPlanCountMark(mark, pageKinds, pages)) continue;
    const key = markTypeKey(mark);
    if (!key) continue;
    planCounts.set(key, (planCounts.get(key) || 0) + 1);
  }

  const fromPages = pages.length ? scheduleItemsFromPages(pages, trade) : [];
  const schedule = new Map();
  for (const item of [...fromPages, ...scheduleItems]) {
    const raw = item.type || item.abbr;
    const key = typeKey(raw);
    const qty = item.scheduleQty;
    if (!key || qty == null) continue;
    if (!isPrintedFixtureType(raw, item.label)) continue;
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
