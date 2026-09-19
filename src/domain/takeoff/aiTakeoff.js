import { ANCHOR_SYMBOL_IDS, DEFAULT_MAX_HOMERUNS } from "./trades.js";

const STOP = new Set(["the", "and", "for", "with", "from", "this", "that", "sheet", "note", "see", "typ", "all", "new", "nic", "nts", "rev"]);
const TYPE_CODE = /^[A-Z]{1,3}\d{0,2}[A-Z]?$/i;
const SECTION_WORD = /^(section|sections|conduit|run|detail|det)$/i;
const SECTION_PHRASE = /(?:conduit\s*)?(?:section|run)s?\s*([a-z])\b|\b([a-z])\s*(?:conduit|section)s?\b/i;
export const DEFAULT_CLUSTER_RADIUS = 22;

const SYNONYMS = [
  { test: /padmount|padmounted|padtx/, id: "pad-tx" },
  { test: /transformer|xfmr/, id: "transformer" },
  { test: /groundrod|groundingelectrode|groundgrid|grounding/, id: "ground-rod" },
  { test: /sitelight|arealight|polelight/, id: "site-pole" },
];

export function normalizeTakeoffText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[′’'`"]/g, "")
    .replace(/[×✕✖]/g, "x")
    .replace(/[^a-z0-9x]+/g, "");
}

function findById(symbols, id) {
  return (symbols || []).find((item) => item.id === id) || null;
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

function findLabelMatch(symbols, text) {
  const compact = normalizeTakeoffText(text);
  if (!compact) return null;
  let best = null;
  let bestLen = 0;
  for (const item of symbols || []) {
    if (item.category === "Raceway") continue;
    const label = normalizeTakeoffText(item.label);
    if (label.length < 6 || !compact.includes(label)) continue;
    if (label.length > bestLen) {
      best = item;
      bestLen = label.length;
    }
  }
  return best;
}

function findSynonym(symbols, text) {
  const compact = normalizeTakeoffText(text);
  if (!compact) return null;
  for (const row of SYNONYMS) {
    if (!row.test.test(compact)) continue;
    const hit = findById(symbols, row.id);
    if (hit) return hit;
  }
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
      const symbol = findFixtureInText(symbols, blob) || findLabelMatch(symbols, blob) || findSynonym(symbols, blob);
      if (!symbol) continue;
      const taken = new Set((symbols || []).map((item) => normalizeTakeoffText(item.abbr)).filter((abbr) => abbr.length >= 2));
      for (const token of row.tokens) {
        const code = String(token.text || "").trim().replace(/[.:]+$/g, "").replace(/^type\s+/i, "");
        if (!TYPE_CODE.test(code) || fixtureSizeKey(code) === symbol.id) continue;
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

export function aliasesFromDrawingSymbols(drawingSymbols, catalogSymbols) {
  const aliases = [];
  const seen = new Set();
  for (const item of drawingSymbols || []) {
    const code = String(item.abbr || item.type || "").trim().replace(/^type\s+/i, "");
    if (!code || !TYPE_CODE.test(code)) continue;
    const id = code.toUpperCase();
    if (seen.has(id)) continue;
    const resolved = findFixtureInText(catalogSymbols, item.label || "")
      || findLabelMatch(catalogSymbols, item.label || "")
      || findSynonym(catalogSymbols, item.label || "")
      || item;
    seen.add(id);
    aliases.push({
      code: id,
      symbol: {
        ...resolved,
        category: resolved.takeoffCategory || (resolved.category === "From drawing" ? item.takeoffCategory || item.category : resolved.category),
        takeoffCategory: resolved.takeoffCategory || item.takeoffCategory || resolved.category,
      },
    });
  }
  return aliases;
}

function mergeAliases(...lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const alias of list || []) {
      const id = String(alias.code || "").toUpperCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(alias);
    }
  }
  return merged;
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
      last.parts.push(token);
    } else {
      phrases.push({ text: token.text, x: token.x, y: token.y, xEnd: token.x + 0.8, parts: [token] });
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

function isSectionContext(token, tokens) {
  const compact = normalizeTakeoffText(token.text);
  if (compact.length > 2) return false;
  return (tokens || []).some((other) => (
    other !== token
    && Math.abs((other.y || 0) - (token.y || 0)) <= 1.6
    && Math.abs((other.x || 0) - (token.x || 0)) <= 10
    && SECTION_WORD.test(String(other.text || "").trim())
  ));
}

function addSection(sections, seen, page, x, y, label) {
  const id = String(label || "").toUpperCase();
  if (!id) return;
  const key = `${page}|${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  sections.push({
    id: `section-${page}-${id}`,
    sheet: page,
    x,
    y,
    label: id,
    section: true,
  });
}

export function findConduitSections(pages) {
  const sections = [];
  const seen = new Set();
  for (const page of pages || []) {
    if (!shouldScan(page)) continue;
    const tokens = page.tokens || [];
    for (const token of tokens) {
      const letter = String(token.text || "").trim().toUpperCase();
      if (!/^[A-Z]$/.test(letter) || !isSectionContext(token, tokens)) continue;
      addSection(sections, seen, page.page, token.x, token.y, letter);
    }
    for (const phrase of phrasesFromTokens(tokens)) {
      const match = String(phrase.text || "").match(SECTION_PHRASE);
      if (!match) continue;
      addSection(sections, seen, page.page, phrase.x, phrase.y, match[1] || match[2]);
    }
  }
  return sections;
}

export function matchTradeSymbol(text, symbols, aliases = [], options = {}) {
  const raw = String(text || "").trim().replace(/[.,;:()]+$/g, "").replace(/^[()]+/, "");
  const token = raw.replace(/^type\s+/i, "");
  const lower = token.toLowerCase();
  const compact = normalizeTakeoffText(token);
  if (!compact || STOP.has(lower)) return null;
  const fixture = findFixtureInText(symbols, token);
  if (fixture) return fixture;
  const synonym = findSynonym(symbols, token);
  if (synonym) return synonym;
  const label = findLabelMatch(symbols, token);
  if (label) return label;
  if (options.sectionContext && /^[a-z]{1,2}$/.test(compact)) return null;
  const alias = (aliases || []).find((item) => normalizeTakeoffText(item.code) === compact);
  if (alias?.symbol) return alias.symbol;
  if (compact.length > 18) return null;
  const hits = (symbols || []).filter((item) => (
    item.abbr
    && normalizeTakeoffText(item.abbr) === compact
    && item.abbr.length >= 2
    && item.category !== "Raceway"
  ));
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

function pickSeed(remaining, anchors) {
  const usable = (anchors || []).filter((anchor) => remaining.some((device) => device.sheet === anchor.sheet) && !anchor.section);
  if (!usable.length) {
    return [...remaining].sort((a, b) => a.x - b.x || a.y - b.y)[0];
  }
  let best = remaining[0];
  let bestDist = Infinity;
  for (const device of remaining) {
    for (const anchor of usable.filter((item) => item.sheet === device.sheet)) {
      const dist = distance(device, anchor);
      if (dist < bestDist) {
        best = device;
        bestDist = dist;
      }
    }
  }
  return best;
}

function clusterClosest(devices, anchors, cap, radius) {
  const groups = [];
  const remaining = [...devices];
  while (remaining.length) {
    const seed = pickSeed(remaining, anchors);
    const group = [seed];
    remaining.splice(remaining.indexOf(seed), 1);
    while (group.length < cap && remaining.length) {
      let best = null;
      let bestDist = Infinity;
      for (const item of remaining) {
        const dist = Math.min(...group.map((member) => distance(item, member)));
        if (dist < bestDist) {
          best = item;
          bestDist = dist;
        }
      }
      if (bestDist > radius) break;
      group.push(best);
      remaining.splice(remaining.indexOf(best), 1);
    }
    const sheetAnchors = (anchors || []).filter((anchor) => anchor.sheet === group[0].sheet && !anchor.section);
    const centroid = {
      x: group.reduce((sum, item) => sum + item.x, 0) / group.length,
      y: group.reduce((sum, item) => sum + item.y, 0) / group.length,
    };
    const anchor = [...sheetAnchors].sort((a, b) => distance(centroid, a) - distance(centroid, b))[0] || null;
    groups.push({ anchor, devices: group });
  }
  return groups;
}

export function nearestNeighborOrder(items, start = null) {
  const leftover = [...items];
  const path = [];
  let current = start;
  if (!current || !leftover.includes(current)) {
    leftover.sort((a, b) => (current ? distance(a, current) - distance(b, current) : a.x - b.x || a.y - b.y));
    current = leftover[0];
  }
  while (leftover.length) {
    const index = leftover.indexOf(current);
    path.push(leftover.splice(index === -1 ? 0 : index, 1)[0]);
    if (!leftover.length) break;
    const last = path[path.length - 1];
    current = leftover.reduce((best, item) => (distance(item, last) < distance(best, last) ? item : best));
  }
  return path;
}

export function conduitRoutePoints(devices, anchor) {
  const ordered = nearestNeighborOrder(devices, anchor);
  const points = ordered.map((item) => ({ x: item.x, y: item.y }));
  if (anchor) points.push({ x: anchor.x, y: anchor.y });
  return points;
}

export function groupHomeruns(devices, anchors, maxPerConduit = DEFAULT_MAX_HOMERUNS, options = {}) {
  const cap = Math.max(1, Number(maxPerConduit) || DEFAULT_MAX_HOMERUNS);
  const radius = Number(options.clusterRadius) > 0 ? Number(options.clusterRadius) : DEFAULT_CLUSTER_RADIUS;
  const sections = options.sections || [];
  const buckets = new Map();
  for (const device of devices || []) {
    const section = sections
      .filter((item) => item.sheet === device.sheet)
      .sort((a, b) => distance(device, a) - distance(device, b))[0];
    const key = `${device.sheet}|${section?.label || "_"}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(device);
  }
  const groups = [];
  for (const bucket of buckets.values()) {
    groups.push(...clusterClosest(bucket, anchors, cap, radius));
  }
  return groups;
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `ai-${Math.random().toString(36).slice(2)}`;
}

function collectMatchCandidates(page) {
  const tokens = page.tokens || [];
  const phrases = phrasesFromTokens(tokens);
  const candidates = phrases.map((phrase) => ({
    text: phrase.text,
    x: phrase.x,
    y: phrase.y,
    sectionContext: phrase.parts.some((part) => isSectionContext(part, tokens)) || SECTION_PHRASE.test(phrase.text),
  }));
  for (const token of tokens) {
    candidates.push({
      text: token.text,
      x: token.x,
      y: token.y,
      sectionContext: isSectionContext(token, tokens),
    });
  }
  return candidates;
}

export function buildAiMarks({
  pages,
  trade,
  symbols,
  drawingSymbols = [],
  maxHomeruns = DEFAULT_MAX_HOMERUNS,
  conduit,
  color = "#2563eb",
}) {
  const anchorIds = new Set(ANCHOR_SYMBOL_IDS[trade] || []);
  const aliases = mergeAliases(
    fixtureAliasesFromSchedules(pages, symbols),
    aliasesFromDrawingSymbols(drawingSymbols, symbols),
  );
  const matchSymbols = [...(symbols || []), ...(drawingSymbols || [])];
  const counts = [];
  const seen = [];
  for (const page of pages || []) {
    if (!shouldScan(page)) continue;
    for (const token of collectMatchCandidates(page)) {
      const symbol = matchTradeSymbol(token.text, matchSymbols, aliases, { sectionContext: token.sectionContext });
      if (!symbol) continue;
      const near = seen.some((item) => item.sheet === page.page && item.symbol === symbol.id && distance(item, token) < 1.2);
      if (near) continue;
      const compact = normalizeTakeoffText(String(token.text || "").replace(/^type\s+/i, ""));
      const fromSchedule = aliases.some((alias) => normalizeTakeoffText(alias.code) === compact && alias.symbol?.id === symbol.id);
      const mark = {
        id: newId(),
        source: "ai",
        trade,
        type: "count",
        sheet: page.page,
        x: token.x,
        y: token.y,
        category: symbol.takeoffCategory || symbol.category,
        symbol: symbol.id,
        symbolLabel: symbol.label,
        abbr: symbol.abbr,
        color,
        matchedFrom: fromSchedule ? "schedule" : "drawing",
        anchor: anchorIds.has(symbol.id),
      };
      counts.push(mark);
      seen.push(mark);
    }
  }
  const anchors = counts.filter((mark) => mark.anchor);
  const devices = counts.filter((mark) => !mark.anchor);
  const sections = findConduitSections(pages);
  const groups = groupHomeruns(devices, anchors, maxHomeruns, { sections });
  const conduits = groups.map((group, index) => {
    const points = conduitRoutePoints(group.devices, group.anchor);
    if (points.length < 2) return null;
    return {
      id: newId(),
      source: "ai",
      trade,
      type: "route",
      tool: "conduit",
      sheet: (group.anchor || group.devices[0]).sheet,
      points,
      runNumber: index + 1,
      category: "Raceway",
      symbol: conduit?.id || "emt-3-4",
      symbolLabel: conduit?.label || '3/4" EMT',
      abbr: conduit?.size || '3/4"',
      conduitSize: conduit?.size || '3/4"',
      conduitMaterial: conduit?.material || "EMT",
      color,
      homerunCount: group.devices.length,
    };
  }).filter(Boolean);
  const cap = Math.max(1, Number(maxHomeruns) || DEFAULT_MAX_HOMERUNS);
  const scheduleHits = counts.filter((mark) => mark.matchedFrom === "schedule").length;
  return {
    marks: [...counts.map(({ anchor, matchedFrom, ...mark }) => mark), ...conduits],
    summary: counts.length
      ? `AI ${trade} takeoff: ${counts.length} devices${scheduleHits ? ` (${scheduleHits} from schedule types)` : ""}, ${conduits.length} conduit runs grouping closest circuits, max ${cap} homeruns per conduit.`
      : `No ${trade} symbols were found on the PDF text layer. Counts stay empty until that trade is labeled on the sheets.`,
    deviceCount: counts.length,
    conduitCount: conduits.length,
  };
}
