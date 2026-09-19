import { ANCHOR_SYMBOL_IDS, DEFAULT_MAX_HOMERUNS } from "./trades.js";

const STOP = new Set(["the", "and", "for", "with", "from", "this", "that", "sheet", "note", "see", "typ", "all", "new", "nic", "nts", "rev"]);
const TYPE_CODE = /^[A-Z]{1,3}\d{0,2}[A-Z]?$/i;

export function normalizeTakeoffText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[′’'`"]/g, "")
    .replace(/[×✕✖]/g, "x")
    .replace(/[^a-z0-9x]+/g, "");
}

function findFixtureBySize(symbols, key) {
  const lighting = (symbols || []).filter((item) => item.category === "Lighting");
  return lighting.find((item) => item.id === key)
    || lighting.find((item) => normalizeTakeoffText(item.abbr) === key)
    || null;
}

function fixtureSizeKey(text) {
  const compact = normalizeTakeoffText(text);
  const size = compact.match(/(\d{1,2})x(\d{1,2})/);
  if (!size) return "";
  return `${Number(size[1])}x${Number(size[2])}`;
}

function findFixtureInText(symbols, text) {
  const compact = normalizeTakeoffText(text);
  let best = null;
  let bestScore = -1;
  for (let index = 0; index < compact.length; index += 1) {
    const size = compact.slice(index).match(/^(\d{1,2})x(\d{1,2})/);
    if (!size) continue;
    const key = `${Number(size[1])}x${Number(size[2])}`;
    const symbol = findFixtureBySize(symbols, key);
    if (!symbol) continue;
    const before = index === 0 ? "" : compact[index - 1];
    const boundary = index === 0 || !/\d/.test(before);
    const score = (boundary ? 2 : 0) + (symbol.id === key ? 1 : 0);
    if (score > bestScore) {
      best = symbol;
      bestScore = score;
    }
  }
  if (best) return best;
  const stripped = compact.replace(/^[a-z]{1,3}\d{0,2}(?=\d)/, "");
  if (stripped !== compact) return findFixtureBySize(symbols, fixtureSizeKey(stripped));
  return null;
}

export function fixtureAliasesFromSchedules(pages, symbols) {
  const aliases = [];
  const seen = new Set();
  for (const page of pages || []) {
    const kind = String(page.kind || "");
    if (!kind.includes("schedule") && kind !== "legend") continue;
    const rows = [];
    const sorted = [...(page.tokens || [])].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const token of sorted) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.y - token.y) <= 1.2) last.tokens.push(token);
      else rows.push({ y: token.y, tokens: [token] });
    }
    for (const row of rows) {
      const blob = row.tokens.map((token) => token.text).join(" ");
      const symbol = findFixtureInText(symbols, blob);
      const key = symbol?.id || "";
      if (!symbol) continue;
      const taken = new Set((symbols || []).map((item) => normalizeTakeoffText(item.abbr)).filter((abbr) => abbr.length >= 2));
      for (const token of row.tokens) {
        const code = String(token.text || "").trim().replace(/[.:]+$/g, "");
        if (!TYPE_CODE.test(code) || fixtureSizeKey(code) === key) continue;
        if (/^[A-Za-z]+$/.test(code) && code.length > 1) continue;
        if (taken.has(normalizeTakeoffText(code))) continue;
        const id = code.toUpperCase();
        if (seen.has(id)) continue;
        seen.add(id);
        aliases.push({ code: id, symbol });
      }
    }
  }
  return aliases;
}

function phrasesFromTokens(tokens) {
  const sorted = [...(tokens || [])].sort((a, b) => a.y - b.y || a.x - b.x);
  const phrases = [];
  for (const token of sorted) {
    const last = phrases[phrases.length - 1];
    const close = last && Math.abs(last.y - token.y) < 0.9 && (token.x - last.xEnd) < 2.2;
    if (close) {
      last.text += token.text;
      last.xEnd = token.x + 0.8;
    } else {
      phrases.push({ text: token.text, x: token.x, y: token.y, xEnd: token.x + 0.8 });
    }
  }
  return phrases;
}

function shouldScan(page) {
  if (!page) return false;
  if (page.kind === "spec" || String(page.kind).endsWith("schedule")) return false;
  if (page.kind === "legend" && (page.tokens?.length || 0) < 80) return false;
  return true;
}

export function matchTradeSymbol(text, symbols, aliases = []) {
  const token = String(text || "").trim().replace(/[.,;:()]+$/g, "").replace(/^[()]+/, "");
  const lower = token.toLowerCase();
  const compact = normalizeTakeoffText(token);
  if (!compact || compact.length > 24 || STOP.has(lower)) return null;
  const alias = (aliases || []).find((item) => normalizeTakeoffText(item.code) === compact);
  if (alias?.symbol) return alias.symbol;
  const fixture = findFixtureInText(symbols, token);
  if (fixture) return fixture;
  if (lower.length > 18 || STOP.has(lower)) return null;
  const hits = (symbols || []).filter((item) => item.abbr && normalizeTakeoffText(item.abbr) === compact && item.abbr.length >= 2 && item.category !== "Raceway");
  if (!hits.length) return null;
  hits.sort((a, b) => {
    const rank = (item) => (item.category === "Panels / MCC" || item.id === "facp" || item.id === "ahu" ? 1 : 0);
    return rank(b) - rank(a) || b.abbr.length - a.abbr.length;
  });
  return hits[0];
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function groupHomeruns(devices, anchors, maxPerConduit = DEFAULT_MAX_HOMERUNS) {
  const cap = Math.max(1, Number(maxPerConduit) || DEFAULT_MAX_HOMERUNS);
  const groups = [];
  const buckets = new Map();
  for (const device of devices) {
    const sameSheet = anchors.filter((anchor) => anchor.sheet === device.sheet);
    const anchor = sameSheet.sort((a, b) => distance(device, a) - distance(device, b))[0];
    if (!anchor) continue;
    const key = `${device.sheet}|${anchor.id}`;
    if (!buckets.has(key)) buckets.set(key, { anchor, devices: [] });
    buckets.get(key).devices.push(device);
  }
  for (const bucket of buckets.values()) {
    const sorted = [...bucket.devices].sort((a, b) => distance(a, bucket.anchor) - distance(b, bucket.anchor));
    for (let index = 0; index < sorted.length; index += cap) {
      groups.push({ anchor: bucket.anchor, devices: sorted.slice(index, index + cap) });
    }
  }
  return groups;
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `ai-${Math.random().toString(36).slice(2)}`;
}

export function buildAiMarks({
  pages,
  trade,
  symbols,
  maxHomeruns = DEFAULT_MAX_HOMERUNS,
  conduit,
  color = "#2563eb",
}) {
  const anchorIds = new Set(ANCHOR_SYMBOL_IDS[trade] || []);
  const aliases = fixtureAliasesFromSchedules(pages, symbols);
  const counts = [];
  const seen = [];
  for (const page of pages || []) {
    if (!shouldScan(page)) continue;
    for (const token of phrasesFromTokens(page.tokens)) {
      const symbol = matchTradeSymbol(token.text, symbols, aliases);
      if (!symbol) continue;
      const near = seen.some((item) => item.sheet === page.page && item.symbol === symbol.id && distance(item, token) < 1.2);
      if (near) continue;
      const mark = {
        id: newId(),
        source: "ai",
        trade,
        type: "count",
        sheet: page.page,
        x: token.x,
        y: token.y,
        category: symbol.category,
        symbol: symbol.id,
        symbolLabel: symbol.label,
        abbr: symbol.abbr,
        color,
        anchor: anchorIds.has(symbol.id),
      };
      counts.push(mark);
      seen.push(mark);
    }
  }
  const anchors = counts.filter((mark) => mark.anchor);
  const devices = counts.filter((mark) => !mark.anchor);
  const groups = groupHomeruns(devices, anchors, maxHomeruns);
  const conduits = groups.map((group, index) => ({
    id: newId(),
    source: "ai",
    trade,
    type: "route",
    tool: "conduit",
    sheet: group.anchor.sheet,
    points: [...group.devices.map((device) => ({ x: device.x, y: device.y })), { x: group.anchor.x, y: group.anchor.y }],
    runNumber: index + 1,
    category: "Raceway",
    symbol: conduit?.id || "emt-3-4",
    symbolLabel: conduit?.label || '3/4" EMT',
    abbr: conduit?.size || '3/4"',
    conduitSize: conduit?.size || '3/4"',
    conduitMaterial: conduit?.material || "EMT",
    color,
    homerunCount: group.devices.length,
  }));
  const cap = Math.max(1, Number(maxHomeruns) || DEFAULT_MAX_HOMERUNS);
  return {
    marks: [...counts.map(({ anchor, ...mark }) => mark), ...conduits],
    summary: counts.length
      ? `AI ${trade} takeoff: ${counts.length} devices, ${conduits.length} conduit runs, max ${cap} homeruns per conduit.`
      : `No ${trade} symbols were found on the PDF text layer. Counts stay empty until that trade is labeled on the sheets.`,
    deviceCount: counts.length,
    conduitCount: conduits.length,
  };
}
