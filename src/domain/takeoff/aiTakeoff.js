import { applyDeviceTypeColors } from "./deviceStyles.js";
import { isSheetChrome, pageDiscipline, pageMatchesTrade } from "./sheetDiscipline.js";
import {
  fixtureSizeFromWholeToken,
  isCanDeviceText,
  isNonPlanSheetKind,
  isQuotedTypeMark,
  isReferenceCallout,
  isTitleBlockLetter,
  normalizeTypeMark,
  persistedPlanDeviceCount,
  resolveCanSymbol,
  shouldAcceptPlanToken,
  taggedEquipmentCode,
} from "./symbolDetection.js";
import { DETECT_SOURCE_ORIGINAL_PDF } from "./accuracyReview.js";
import { describeReconciliation, reconcilePlanToSchedule } from "./countReconciliation.js";
import { extractSheetNotes, notesToMarks } from "./sheetNotes.js";
import { associateGeometry, assignExclusiveGeometry, placeOnSymbolGeometry, shapeHintFromLabel } from "./vectorSymbols.js";
import { ANCHOR_SYMBOL_IDS, DEFAULT_MAX_HOMERUNS } from "./trades.js";

const STOP = new Set(["the", "and", "for", "with", "from", "this", "that", "sheet", "note", "see", "typ", "all", "new", "nic", "nts", "rev"]);
const TYPE_CODE = /^(?:[A-Z]{1,3}\d{0,2}[A-Z]?|\d{1,2}[A-Z]?)$/i;
const SECTION_WORD = /^(section|sections|conduit|run|detail|det)$/i;
const SECTION_PHRASE = /(?:conduit\s*)?(?:section|run)s?\s*([a-z])\b|\b([a-z])\s*(?:conduit|section)s?\b/i;
export const DEFAULT_CLUSTER_RADIUS = 22;

const SYNONYMS = [
  { test: /padmount|padmounted|padtx/, id: "pad-tx" },
  { test: /transformer|xfmr/, id: "transformer" },
  { test: /groundrod|groundingelectrode|groundgrid|grounding/, id: "ground-rod" },
  { test: /sitelight|arealight|polelight/, id: "site-pole" },
  { test: /ventfan/, id: "vf" },
  { test: /exhaustfan/, id: "ef" },
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

function findFixtureInText(symbols, text, options = {}) {
  if (isReferenceCallout(text)) return null;
  if (isCanDeviceText(text)) return resolveCanSymbol(symbols);
  const whole = fixtureSizeFromWholeToken(text);
  if (whole) return findFixtureBySize(symbols, whole);
  if (!options.allowEmbedded) return null;
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

export function fixtureAliasesFromSchedules(pages, symbols, trade) {
  const aliases = [];
  const seen = new Set();
  for (const page of pages || []) {
    const kind = String(page.kind || "");
    if (!kind.includes("schedule") && kind !== "legend") continue;
    if (trade && !pageMatchesTrade(page, trade)) continue;
    const rows = [];
    const sorted = [...(page.tokens || [])].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const token of sorted) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.y - token.y) <= 1.2) last.tokens.push(token);
      else rows.push({ y: token.y, tokens: [token] });
    }
    for (const row of rows) {
      const blob = row.tokens.map((token) => token.text).join(" ");
      const symbol = (isCanDeviceText(blob) && resolveCanSymbol(symbols))
        || findFixtureInText(symbols, blob, { allowEmbedded: true })
        || findLabelMatch(symbols, blob)
        || findSynonym(symbols, blob);
      if (!symbol) continue;
      const taken = new Set((symbols || []).map((item) => normalizeTakeoffText(item.abbr)).filter((abbr) => abbr.length >= 2));
      for (const token of row.tokens) {
        const typeAnchor = row.tokens.findIndex((item) => /^type$/i.test(String(item.text || "").trim()));
        const codeToken = typeAnchor >= 0 ? row.tokens[typeAnchor + 1] : row.tokens[0];
        if (!codeToken || token !== codeToken) continue;
        const code = normalizeTypeMark(token.text);
        if (!TYPE_CODE.test(code) || fixtureSizeKey(code) === symbol.id) continue;
        if (/^\d+W$/i.test(code)) continue;
        if (isLegendQuantityCode(code, row.tokens)) continue;
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
    const code = normalizeTypeMark(item.abbr || item.type || "");
    if (!code || !TYPE_CODE.test(code)) continue;
    const id = code.toUpperCase();
    if (seen.has(id)) continue;
    const resolved = (isCanDeviceText(item.label) && resolveCanSymbol(catalogSymbols))
      || findFixtureInText(catalogSymbols, item.label || "", { allowEmbedded: true })
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

function isLegendQuantityCode(code, rowTokens = []) {
  if (!/^\d{2,3}$/.test(code)) return false;
  return (rowTokens || []).some((token) => {
    const text = String(token.text || "").trim().replace(/^type\s+/i, "");
    return TYPE_CODE.test(text) && !/^\d+$/.test(text);
  });
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

function usableDrawingSymbols(drawingSymbols, pages, trade) {
  return (drawingSymbols || []).filter((item) => {
    if (!item.page) return true;
    const source = (pages || []).find((page) => page.page === item.page);
    return !source || pageMatchesTrade(source, trade);
  });
}

export function legendDictionaryFromPages(pages, drawingSymbols, catalogSymbols, trade) {
  const usableDrawing = usableDrawingSymbols(drawingSymbols, pages, trade);
  const aliases = mergeAliases(
    fixtureAliasesFromSchedules(pages, catalogSymbols, trade),
    aliasesFromDrawingSymbols(usableDrawing, catalogSymbols),
  );
  const entries = aliases.map((alias) => ({
    code: alias.code,
    symbol: alias.symbol,
    shapeHint: shapeHintFromLabel(`${alias.symbol?.label || ""} ${alias.symbol?.id || ""} ${alias.code || ""}`),
  }));
  for (const page of pages || []) {
    if (!isNonPlanSheetKind(page.kind)) continue;
    if (trade && !pageMatchesTrade(page, trade)) continue;
    for (const token of page.tokens || []) {
      const code = normalizeTypeMark(token.text).toUpperCase();
      const entry = entries.find((item) => item.code === code);
      if (!entry || entry.shapeHint) continue;
      const geometry = associateGeometry(token, page.paths || [], { radius: 4.2 });
      if (geometry?.kind) entry.shapeHint = geometry.kind;
    }
  }
  return {
    aliases,
    entries,
    hasLegend: entries.length > 0,
    usableDrawing,
  };
}

function shapeHintForToken(text, dictionary) {
  const compact = normalizeTakeoffText(normalizeTypeMark(text));
  if (!compact) return null;
  if (/^(gfi|gfiwp|os|vs)(?:\d+)?$/.test(compact)) return "circle";
  if (/^(vf|ef)\d*$/.test(compact)) return "rect";
  const entry = (dictionary?.entries || []).find((item) => normalizeTakeoffText(item.code) === compact);
  if (entry?.shapeHint) return entry.shapeHint;
  return shapeHintFromLabel(`${entry?.symbol?.label || ""} ${text}`);
}

function placementAllowed(point) {
  if (!point) return false;
  return !isSheetChrome(point) && !isTitleBlockLetter(point);
}

function phrasesFromTokens(tokens) {
  const sorted = [...(tokens || [])].sort((a, b) => a.y - b.y || a.x - b.x);
  const phrases = [];
  for (const token of sorted) {
    const last = phrases[phrases.length - 1];
    const atomic = (text) => isQuotedTypeMark(text) || /^(GFI(?:\/WP)?|OS|VS|VF-?\d*|EF-?\d*)$/i.test(normalizeTypeMark(text));
    const close = last && Math.abs(last.y - token.y) < 0.9 && token.x >= last.xEnd - 0.2 && (token.x - last.xEnd) < 2.2
      && !atomic(last.text) && !atomic(token.text);
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

export function shouldScan(page, trade) {
  if (!page) return false;
  if (isNonPlanSheetKind(page.kind) || page.kind === "spec") return false;
  if (trade && !pageMatchesTrade(page, trade)) return false;
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

export function findConduitSections(pages, trade) {
  const sections = [];
  const seen = new Set();
  for (const page of pages || []) {
    if (!shouldScan(page, trade)) continue;
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
  const token = normalizeTypeMark(raw);
  const lower = token.toLowerCase();
  const compact = normalizeTakeoffText(token);
  if (!compact || STOP.has(lower) || isReferenceCallout(raw) || isReferenceCallout(token)) return null;
  if (/^e\/m$/i.test(token) || (compact === "em" && /e\/m/i.test(raw))) return null;
  if (!isQuotedTypeMark(raw) && (/^\d+['′](?:\s*-\s*\d+['′]?)?$/.test(raw) || /['"′]-/.test(raw) || /^-['"]/.test(raw))) return null;
  if (options.reject && options.reject({ text: raw })) return null;
  const tagged = taggedEquipmentCode(token);
  if (tagged) {
    const equipment = (symbols || []).find((item) => item.id === tagged.toLowerCase() || normalizeTakeoffText(item.abbr) === tagged.toLowerCase());
    if (equipment) return equipment;
  }
  if (/^gfi(?:\/?wp)?$/i.test(token) || compact === "gfiwp" || compact === "wpgfi") {
    const gfi = (compact.includes("wp") && (symbols || []).find((item) => item.id === "wp-gfci"))
      || (symbols || []).find((item) => item.id === "gfci");
    if (gfi) return gfi;
  }
  if (isCanDeviceText(token) || isCanDeviceText(options.nearbyText)) {
    const can = resolveCanSymbol(symbols);
    if (can) return can;
  }
  const fixture = findFixtureInText(symbols, token, { allowEmbedded: options.allowEmbedded });
  if (fixture) return fixture;
  if (options.sectionContext && /^[a-z]{1,2}$/.test(compact)) return null;
  const words = token.split(/\s+/).filter(Boolean);
  if (words.length < 5) {
    const synonym = findSynonym(symbols, token);
    if (synonym) return synonym;
    const label = findLabelMatch(symbols, token);
    if (label) return label;
  }
  const alias = (aliases || []).find((item) => normalizeTakeoffText(item.code) === compact);
  if (alias?.symbol) {
    if (options.sitePlan && isIndoorLightingAlias(alias) && /^[0-9A-Z]{1,3}$/i.test(token)) return null;
    return alias.symbol;
  }
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

const CALLOUT_PATTERNS = [
  /\((\d{1,2})\)\s*(\d+(?:-\d+\/\d+|\/\d+)?)\s*["”]?\s*(emt|pvc|grc|rmc|rsc|imc|c)\b/i,
  /(\d{1,2})\s*(?:runs?|conduits?)\s+(?:of\s+)?(\d+(?:-\d+\/\d+|\/\d+)?)\s*["”]?\s*(emt|pvc|grc|rmc|rsc|imc)?/i,
  /(\d{1,2})\s*[-x×]\s*(\d+(?:-\d+\/\d+|\/\d+)?)\s*["”]?\s*(emt|pvc|grc|rmc|rsc|imc|c)\b/i,
];

const MATERIAL_NAME = {
  emt: "EMT",
  pvc: "PVC",
  grc: "GRC",
  rmc: "RMC",
  rsc: "RSC",
  imc: "IMC",
  c: "Conduit",
};

export function parseConduitCallout(text) {
  const raw = String(text || "");
  for (const pattern of CALLOUT_PATTERNS) {
    const match = raw.match(pattern);
    if (!match) continue;
    const parallelRuns = Number(match[1]);
    if (!parallelRuns || parallelRuns > 12) continue;
    const sizeRaw = String(match[2] || "").replace(/\s+/g, "");
    const material = MATERIAL_NAME[String(match[3] || "").toLowerCase()] || "";
    return {
      parallelRuns,
      size: sizeRaw ? `${sizeRaw}"` : "",
      material,
    };
  }
  return null;
}

export function conduitRunLabel(mark) {
  const runs = Number(mark?.parallelRuns) || 1;
  const hrs = Number(mark?.homerunCount) || 0;
  const bits = [`R${mark?.runNumber || ""}`];
  if (runs > 1) bits.push(`${runs} runs`);
  else if (hrs) bits.push(`${hrs} HR`);
  if (mark?.conduitSize) bits.push(mark.conduitSize);
  if (runs > 1 && mark?.conduitMaterial) bits.push(mark.conduitMaterial);
  return bits.join(" · ");
}

function attachCalloutToPath(conduits, callout) {
  let best = null;
  let bestDist = Infinity;
  for (const mark of conduits) {
    if (mark.sheet !== callout.sheet) continue;
    const dist = Math.min(...(mark.points || []).map((point) => distance(point, callout)));
    if (dist < bestDist) {
      best = mark;
      bestDist = dist;
    }
  }
  if (best && bestDist <= 10) {
    best.parallelRuns = Math.max(Number(best.parallelRuns) || 1, callout.parallelRuns);
    if (callout.size) best.conduitSize = callout.size;
    if (callout.material) best.conduitMaterial = callout.material;
    best.symbolLabel = callout.size && callout.material
      ? `${callout.parallelRuns}× ${callout.size} ${callout.material}`
      : best.symbolLabel;
    best.runLabel = conduitRunLabel(best);
    return true;
  }
  return false;
}

export function findConduitRunCallouts(pages, trade) {
  const callouts = [];
  for (const page of pages || []) {
    if (!shouldScan(page, trade)) continue;
    for (const phrase of phrasesFromTokens(page.tokens || [])) {
      const parsed = parseConduitCallout(phrase.text);
      if (!parsed) continue;
      callouts.push({
        ...parsed,
        sheet: page.page,
        x: phrase.x,
        y: phrase.y,
      });
    }
  }
  return callouts;
}

function applyConduitCallouts(conduits, callouts, anchors, startNumber, trade, color) {
  const extra = [];
  let runNumber = startNumber;
  for (const callout of callouts) {
    if (attachCalloutToPath(conduits, callout) || attachCalloutToPath(extra, callout)) continue;
    const sheetAnchors = (anchors || []).filter((anchor) => anchor.sheet === callout.sheet);
    const ordered = [...sheetAnchors].sort((a, b) => distance(a, callout) - distance(b, callout));
    const a = ordered[0];
    const b = ordered[1];
    const points = a && b
      ? [{ x: a.x, y: a.y }, { x: callout.x, y: callout.y }, { x: b.x, y: b.y }]
      : a
        ? [{ x: callout.x, y: callout.y }, { x: a.x, y: a.y }]
        : [];
    if (points.length < 2) continue;
    const mark = {
      id: newId(),
      source: "ai",
      trade,
      type: "route",
      tool: "conduit",
      sheet: callout.sheet,
      points,
      runNumber: runNumber + 1,
      category: "Raceway",
      parallelRuns: callout.parallelRuns,
      conduitSize: callout.size || '3/4"',
      conduitMaterial: callout.material || "EMT",
      symbol: "emt-3-4",
      symbolLabel: callout.size && callout.material
        ? `${callout.parallelRuns}× ${callout.size} ${callout.material}`
        : `${callout.parallelRuns} conduit runs`,
      abbr: callout.size || '3/4"',
      color,
      homerunCount: 0,
    };
    mark.runLabel = conduitRunLabel(mark);
    extra.push(mark);
    runNumber += 1;
  }
  return extra;
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

function nearbyText(token, tokens) {
  return (tokens || [])
    .filter((other) => Math.hypot((other.x || 0) - (token.x || 0), (other.y || 0) - (token.y || 0)) <= 2.8)
    .map((other) => other.text)
    .join(" ");
}

function isSitePlanPage(page) {
  const blob = `${page?.title || ""} ${page?.sheetId || ""} ${(page?.tokens || []).map((token) => token.text).join(" ")}`;
  return /\belectrical site plan\b|\bsite lighting\b/i.test(blob) && !/\bfloor plan\b/i.test(blob);
}

function isIndoorLightingAlias(alias) {
  const blob = `${alias?.symbol?.id || ""} ${alias?.symbol?.label || ""} ${alias?.code || ""}`.toLowerCase();
  if (/site|pole|area light|street|parking|flood/.test(blob)) return false;
  return /troffer|downlight|strip|can light|2x4|2x2|1x4|recessed|surface/.test(blob);
}

function candidateKey(item) {
  return `${normalizeTakeoffText(normalizeTypeMark(item.text))}|${Number(item.x || 0).toFixed(1)}|${Number(item.y || 0).toFixed(1)}`;
}

function collectMatchCandidates(page) {
  const tokens = (page.tokens || []).filter((token) => !isSheetChrome(token) && shouldAcceptPlanToken(token, page.tokens));
  const phrases = phrasesFromTokens(tokens).filter((phrase) => shouldAcceptPlanToken(phrase, page.tokens));
  const candidates = [];
  const seen = new Set();
  const add = (item) => {
    const key = candidateKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(item);
  };
  for (const phrase of phrases) {
    add({
      text: phrase.text,
      x: phrase.x,
      y: phrase.y,
      nearbyText: phrase.parts.map((part) => part.text).join(" "),
      sectionContext: phrase.parts.some((part) => isSectionContext(part, tokens)) || SECTION_PHRASE.test(phrase.text),
    });
  }
  for (const token of tokens) {
    if (candidates.some((item) => (
      normalizeTakeoffText(normalizeTypeMark(item.text)) === normalizeTakeoffText(normalizeTypeMark(token.text))
      && Math.hypot((item.x || 0) - (token.x || 0), (item.y || 0) - (token.y || 0)) < 0.45
    ))) continue;
    add({
      text: token.text,
      x: token.x,
      y: token.y,
      nearbyText: nearbyText(token, page.tokens),
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
  const dictionary = legendDictionaryFromPages(pages, drawingSymbols, symbols, trade);
  const aliases = dictionary.aliases;
  const usableDrawing = dictionary.usableDrawing;
  const matchSymbols = [...(symbols || []), ...usableDrawing];
  const counts = [];
  const seen = [];
  const usedGeometry = new Set();
  for (const page of pages || []) {
    if (!shouldScan(page, trade)) continue;
    const sitePlan = isSitePlanPage(page);
    const pageCandidates = collectMatchCandidates(page);
    const hits = [];
    for (const token of pageCandidates) {
      const symbol = matchTradeSymbol(token.text, matchSymbols, aliases, {
        sectionContext: token.sectionContext,
        nearbyText: token.nearbyText,
        sitePlan,
        reject: (item) => !shouldAcceptPlanToken({ ...token, text: item.text }, page.tokens),
      });
      if (!symbol) continue;
      hits.push({ token, symbol });
    }
    const assigned = assignExclusiveGeometry(hits.map((hit) => hit.token), page.paths || [], {
      shapeHintFor: (token) => shapeHintForToken(token.text, dictionary),
    });
    for (const hit of hits) {
      let { token, symbol } = hit;
      const geometry = assigned.get(token) || placeOnSymbolGeometry(token, (page.paths || []).filter((item) => !usedGeometry.has(item)), {
        shapeHint: shapeHintForToken(token.text, dictionary),
        rivals: hits.map((other) => other.token).filter((other) => other !== token),
      });
      if (isCanDeviceText(token.text, token.nearbyText, symbol.label) && geometry?.kind !== "rect") {
        symbol = resolveCanSymbol(matchSymbols) || symbol;
      }
      const geometryPoint = geometry ? { x: geometry.cx, y: geometry.cy } : null;
      const placed = geometryPoint && placementAllowed(geometryPoint)
        ? geometryPoint
        : placementAllowed(token)
          ? { x: token.x, y: token.y }
          : null;
      if (!placed) continue;
      const usedVector = Boolean(geometryPoint && placed.x === geometryPoint.x && placed.y === geometryPoint.y);
      const compact = normalizeTakeoffText(normalizeTypeMark(token.text));
      const fromLegend = aliases.some((alias) => normalizeTakeoffText(alias.code) === compact && alias.symbol?.id === symbol.id);
      const typeCode = fromLegend
        ? normalizeTypeMark(token.text).toUpperCase()
        : (taggedEquipmentCode(token.text) || symbol.abbr || "").toUpperCase();
      const near = seen.some((item) => {
        if (item.sheet !== page.page) return false;
        const sameType = item.typeCode === typeCode
          || (typeCode === "GFI" && item.typeCode === "GFI/WP")
          || (typeCode === "GFI/WP" && item.typeCode === "GFI");
        if (!sameType) return false;
        const tagDist = Math.hypot((item.tagX ?? item.x) - token.x, (item.tagY ?? item.y) - token.y);
        return tagDist < 0.35 || (distance(item, placed) < 0.42 && tagDist < 0.9);
      });
      if (near) continue;
      const mark = {
        id: newId(),
        source: "ai",
        trade,
        type: "count",
        sheet: page.page,
        x: placed.x,
        y: placed.y,
        category: symbol.takeoffCategory || symbol.category,
        symbol: symbol.id,
        symbolLabel: symbol.label,
        abbr: symbol.abbr,
        typeCode,
        color,
        matchedFrom: fromLegend ? "legend" : "drawing",
        outline: usedVector ? geometry.outline : null,
        outlineSource: usedVector ? "vector" : "text",
        detectSource: DETECT_SOURCE_ORIGINAL_PDF,
        confidence: usedVector ? "high" : "low",
        reviewStatus: "pending",
        anchor: anchorIds.has(symbol.id),
      };
      counts.push(mark);
      seen.push({ ...mark, tagX: token.x, tagY: token.y });
      if (usedVector) usedGeometry.add(geometry);
    }
  }
  const anchors = counts.filter((mark) => mark.anchor);
  const devices = counts.filter((mark) => !mark.anchor);
  const sections = findConduitSections(pages, trade);
  const groups = groupHomeruns(devices, anchors, maxHomeruns, { sections });
  const conduits = groups.map((group, index) => {
    const points = conduitRoutePoints(group.devices, group.anchor);
    if (points.length < 2) return null;
    const mark = {
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
      parallelRuns: 1,
      homerunCount: group.devices.length,
    };
    mark.runLabel = conduitRunLabel(mark);
    return mark;
  }).filter(Boolean);
  const callouts = findConduitRunCallouts(pages, trade);
  conduits.push(...applyConduitCallouts(conduits, callouts, anchors, conduits.length, trade, color));
  const cap = Math.max(1, Number(maxHomeruns) || DEFAULT_MAX_HOMERUNS);
  const pageKinds = Object.fromEntries((pages || []).filter((page) => page?.page).map((page) => [page.page, page.kind]));
  const persistedCount = persistedPlanDeviceCount(counts, pageKinds);
  const legendHits = counts.filter((mark) => mark.matchedFrom === "legend").length;
  const skipped = (pages || []).filter((page) => !pageMatchesTrade(page, trade));
  const skippedSheets = skipped.map((page) => ({
    page: page.page,
    kind: page.kind || "drawing",
    discipline: pageDiscipline(page),
    sheetId: page.sheetId || "",
    title: page.title || "",
  }));
  const skippedTrades = [...new Set(skippedSheets.map((page) => page.discipline))].filter((item) => item && item !== "unknown");
  const skipNote = skipped.length
    ? ` Skipped ${skipped.length} non-${trade} sheet(s)${skippedTrades.length ? ` (${skippedTrades.join(", ")})` : ""}.`
    : "";
  const noteMarks = notesToMarks(extractSheetNotes(pages, trade), trade);
  const reconciliation = reconcilePlanToSchedule({
    marks: counts,
    pages,
    pageKinds,
    trade,
  });
  return {
    marks: applyDeviceTypeColors([
      ...counts.map(({ anchor, matchedFrom, ...mark }) => mark),
      ...conduits,
      ...noteMarks,
    ]),
    summary: persistedCount
      ? `AI ${trade} takeoff: ${persistedCount} devices from the drawing${legendHits ? ` (${legendHits} matched from the legend)` : ""}, ${conduits.length} conduit runs on ${trade} sheets showing run count and path, max ${cap} homeruns per conduit.${skipNote}`
      : `No ${trade} symbols were found on ${trade} sheets.${skipNote || " Counts stay empty until that trade is labeled on the sheets."}`,
    deviceCount: persistedCount,
    conduitCount: conduits.length,
    noteCount: noteMarks.length,
    skippedSheets,
    reconciliation,
    reconciliationNote: describeReconciliation(reconciliation),
  };
}
