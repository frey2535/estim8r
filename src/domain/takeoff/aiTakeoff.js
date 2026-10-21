import { attachDetectionRecord, isReviewOnlyMark, labelLocationFromToken, nearbyCircuitTag, reviewCandidateMark, REVIEW_VISUAL_THRESHOLD } from "./detectionRecord.js";
import { applyDeviceTypeColors } from "./deviceStyles.js";
import { findSheetId, isSheetChrome, pageDiscipline, pageMatchesTrade, tradeFromSheetId } from "./sheetDiscipline.js";
import {
  fixtureSizeFromWholeToken,
  isCanDeviceText,
  isLightingFixtureCode,
  isNonPlanSheetKind,
  isNotesOrTitleBand,
  isPlanInterior,
  isPlotStampToken,
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
import { looksLikeCoverOrRendering, looksLikeElectricalPlan, looksLikeIndexPage, pagePlanType } from "./drawing-docs.js";
import { associateGeometry, assembleTrofferNearTag, assignExclusiveGeometry, looksLikeRecessedCanBody, placeOnSymbolGeometry, shapeHintFromLabel, tagOnSymbolGeometry } from "./vectorSymbols.js";
import { orthogonalizePolyline } from "./ortho.js";
import { attachConfirmedGeometryPrototypes, attachFragmentPrototypes, attachLegendGeometryPrototypes, attachPowerGlyphPrototypes, attachProjectPrototypes, entryFamily, findNearbyOccupancyGlyph, findNearbyReceptacleGlyph, isEmergencyHatch, isHatchTickCluster, looksLikeHexNoteGlyph, looksLikeOccupancyGlyph, nearbyLegendEntry, recoverMissedLegendSymbols, scanPageByLegendGeometry, scanUnlabeledPowerGlyphs, snapToEntryPrototype, symbolBodyOutline } from "./legendGeometry.js";
import { matchRasterToLegend, rasterCandidatesFromPage } from "./rasterSymbols.js";
import { ANCHOR_SYMBOL_IDS, DEFAULT_MAX_HOMERUNS } from "./trades.js";
import { buildTradeSearchManifest } from "./searchManifest.js";
import { dedupePhysicalSymbols } from "./takeoffQuality.js";
import { pagesIncludedInTakeoff } from "./interactiveSheet.js";

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
    if (trade && !pageMatchesTrade(page, trade)) {
      const discipline = pageDiscipline(page);
      if (discipline && discipline !== "unknown") continue;
    }
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
      legend: item,
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
    if (!source || pageMatchesTrade(source, trade)) return true;
    const discipline = pageDiscipline(source);
    return !discipline || discipline === "unknown";
  });
}

export function legendDictionaryFromPages(pages, drawingSymbols, catalogSymbols, trade) {
  const usableDrawing = usableDrawingSymbols(drawingSymbols, pages, trade);
  const aliases = mergeAliases(
    aliasesFromDrawingSymbols(usableDrawing, catalogSymbols),
    fixtureAliasesFromSchedules(pages, catalogSymbols, trade),
  );
  const entries = aliases.map((alias) => ({
    code: alias.code,
    symbol: alias.symbol,
    legend: alias.legend || null,
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
  if (/^(wp|sp|spr|r|p2)$/.test(compact)) return "rect";
  if (/^(vf|ef)\d*$/.test(compact)) return "rect";
  const entry = (dictionary?.entries || []).find((item) => normalizeTakeoffText(item.code) === compact);
  if (entry?.shapeHint) return entry.shapeHint;
  return shapeHintFromLabel(`${entry?.symbol?.label || ""} ${text}`);
}

function placementAllowed(point, options = {}) {
  if (!point) return false;
  if (isSheetChrome(point) || isTitleBlockLetter(point)) return false;
  if (!options.sitePlan && isNotesOrTitleBand(point)) return false;
  return true;
}

function lightingSymbolForCode(code, symbols) {
  const printed = String(code || "").toUpperCase();
  if (printed === "OS") {
    return (symbols || []).find((item) => item.id === "occ" || item.abbr === "OS") || resolveCanSymbol(symbols);
  }
  return resolveCanSymbol(symbols)
    || (symbols || []).find((item) => item.category === "Lighting")
    || null;
}

function typedLightingBodyMark({
  trade,
  sheet,
  geometry,
  sources = [],
  scores = {},
}) {
  return reviewCandidateMark({
    trade,
    sheet,
    geometry,
    reason: "unlabeled-lighting-can",
    sources,
    scores,
  });
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
  if (looksLikeCoverOrRendering(page) || looksLikeIndexPage(page)) return false;
  if (isNonPlanSheetKind(page.kind) || page.kind === "spec") {
    if (!(trade === "electrical" && looksLikeElectricalPlan(page))) return false;
  }
  if (trade === "electrical") {
    const id = page.sheetId || findSheetId(page.tokens || []);
    const fromId = tradeFromSheetId(id);
    if (fromId && fromId !== "electrical") return false;
    return looksLikeElectricalPlan(page);
  }
  if (trade && !pageMatchesTrade(page, trade)) return false;
  return true;
}

function knownLegendCodes(dictionary) {
  return new Set((dictionary?.entries || [])
    .map((entry) => normalizeTakeoffText(normalizeTypeMark(entry?.code || entry?.symbol?.abbr || "")))
    .filter(Boolean));
}

export function shouldScanWithDictionary(page, trade, dictionary) {
  if (shouldScan(page, trade)) return true;
  if (!page || trade !== "electrical") return false;
  if (looksLikeCoverOrRendering(page) || looksLikeIndexPage(page)) return false;

  const id = page.sheetId || findSheetId(page.tokens || []);
  const fromId = tradeFromSheetId(id);
  if (fromId && fromId !== "electrical") return false;

  // CAD exports can have an electrical sheet number but no extractable title.
  // Keep geometry-bearing electrical plan sheets eligible even when the
  // text classifier fails; otherwise the entire takeoff silently returns zero.
  // Exclude cover/index and clearly non-plan schedules or specifications.
  const kind = String(page.kind || "").toLowerCase();
  if (fromId === "electrical"
    && !isNonPlanSheetKind(kind)
    && kind !== "spec"
    && (page.paths || []).length >= 12) return true;

  const codes = knownLegendCodes(dictionary);
  if (!codes.size) return false;

  const matchingTypeTokens = (page.tokens || []).filter((token) => (
    codes.has(normalizeTakeoffText(normalizeTypeMark(token?.text)))
    && isPlanInterior(token)
    && !isSheetChrome(token)
  ));

  // A real plan may have a weak/missing title block or be exported in a way
  // that defeats looksLikeElectricalPlan(). If the sheet contains known
  // project legend codes in the plan interior, do not silently skip it.
  if (matchingTypeTokens.length >= 1 && (page.paths || []).length >= 12) return true;

  // Do not treat every dense CAD sheet as electrical. That rasterized and
  // scanned architectural / mechanical / plumbing pages on live bid sets and
  // crashed the tab. Legend codes or an electrical sheet id are required.
  return false;
}

/** If sheet gating drops every page, still scan electrical-looking sheets so AI Assist is not empty. */
export function pagesToScan(pages, trade, dictionary) {
  const list = pages || [];
  const eligible = list.filter((page) => shouldScanWithDictionary(page, trade, dictionary));
  if (eligible.length) return eligible;
  return list.filter((page) => {
    if (!page) return false;
    if (looksLikeCoverOrRendering(page) || looksLikeIndexPage(page)) return false;
    if (isNonPlanSheetKind(page.kind) || page.kind === "spec") return false;
    const id = page.sheetId || findSheetId(page.tokens || []);
    const fromId = tradeFromSheetId(id);
    if (fromId && fromId !== "electrical") return false;
    return fromId === "electrical"
      || looksLikeElectricalPlan(page)
      || ((page.paths || []).length >= 12 && knownLegendCodes(dictionary).size > 0 && (page.tokens || []).some((token) => (
        knownLegendCodes(dictionary).has(normalizeTakeoffText(normalizeTypeMark(token?.text)))
        && isPlanInterior(token)
      )));
  });
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

export function findConduitSections(pages, trade, dictionary = null) {
  const sections = [];
  const seen = new Set();
  for (const page of pages || []) {
    if (!shouldScanWithDictionary(page, trade, dictionary)) continue;
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
  if (options.planType === "lighting") {
    if (/^(pc|photocell)$/i.test(token)) return null;
    if (/^(120|208|240|277|480)$/.test(token)) return null;
    if (/^ef(?:[- ]?\d+)?$/i.test(token)) return null;
  }
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
  if (/^facp$/i.test(compact)) {
    return (symbols || []).find((item) => item.id === "facp") || null;
  }
  if (compact === "sp" && options.planType === "power") {
    const special = (symbols || []).find((item) => item.id === "special-rec");
    if (special) return special;
  }
  if (/^p2$/i.test(compact) && options.planType === "power") {
    const special = (symbols || []).find((item) => item.id === "special-rec" || item.id === "dedicated" || item.id === "duplex");
    if (special) return special;
  }
  if (/^(db|bell|chime|doorbell)$/i.test(token) && options.planType === "power") {
    const special = (symbols || []).find((item) => item.id === "special-rec" || item.id === "duplex");
    if (special) return { ...special, id: special.id, label: "Doorbell", abbr: "DB" };
  }
  if (isCanDeviceText(token) || isCanDeviceText(options.nearbyText)) {
    const can = resolveCanSymbol(symbols);
    if (can) return can;
  }
  const fixture = findFixtureInText(symbols, token, { allowEmbedded: options.allowEmbedded });
  if (fixture) return fixture;
  if (options.sectionContext && /^[a-z]{1,2}$/.test(compact)) return null;
  const words = token.split(/\s+/).filter(Boolean);
  if (/^(generator|panelboard|panelboards|exhaustfan|exhaustfans?)$/i.test(compact) && options.planType !== "site") {
    return null;
  }
  if (words.length < 5) {
    const synonym = findSynonym(symbols, token);
    if (synonym) return synonym;
    const label = findLabelMatch(symbols, token);
    if (label) return label;
  }
  const alias = (aliases || []).find((item) => normalizeTakeoffText(item.code) === compact);
  if (alias?.symbol) {
    if (options.sitePlan && isIndoorLightingAlias(alias) && /^[0-9A-Z]{1,3}$/i.test(token)) return null;
    if (options.planType === "power" && isIndoorLightingAlias(alias)) return null;
    return alias.symbol;
  }
  const hits = (symbols || []).filter((item) => (
    item.abbr
    && normalizeTakeoffText(item.abbr) === compact
    && item.abbr.length >= 2
    && item.category !== "Raceway"
  ));
  if (!hits.length) {
    if (options.planType === "lighting" && isLightingFixtureCode(token)) {
      return lightingSymbolForCode(token, symbols);
    }
    return null;
  }
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
  // Expand diagonal hops into 90° elbows so AI conduit matches field installs.
  const ortho = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!ortho.length) {
      ortho.push(point);
      continue;
    }
    const prev = ortho[ortho.length - 1];
    if (Math.abs(prev.x - point.x) > 0.05 && Math.abs(prev.y - point.y) > 0.05) {
      ortho.push({ x: point.x, y: prev.y });
    }
    ortho.push(point);
  }
  return orthogonalizePolyline(ortho);
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

export function findConduitRunCallouts(pages, trade, dictionary = null) {
  const callouts = [];
  for (const page of pages || []) {
    if (!shouldScanWithDictionary(page, trade, dictionary)) continue;
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

function equipmentFamilyCode(value) {
  const direct = taggedEquipmentCode(value);
  if (direct) return direct;
  const compact = normalizeTakeoffText(value);
  if (/^ef\d*$/.test(compact)) return "EF";
  if (/^vf\d*$/.test(compact)) return "VF";
  return "";
}

function equipmentCodeForVisual(visual) {
  return equipmentFamilyCode(visual?.entry?.code)
    || equipmentFamilyCode(visual?.entry?.symbol?.abbr)
    || equipmentFamilyCode(visual?.entry?.symbol?.id)
    || equipmentFamilyCode(visual?.entry?.symbol?.label);
}

function printedEquipmentTags(page, family) {
  return (page?.tokens || []).filter((token) => equipmentFamilyCode(token.text) === family);
}

function hasPrintedEquipmentTagNear(page, family, point, radius = 2.4) {
  if (!family || !point) return false;
  return printedEquipmentTags(page, family).some((token) => (
    Math.hypot((Number(token.x) || 0) - point.x, (Number(token.y) || 0) - point.y) <= radius
  ));
}

function isVisualOnlyEquipmentHit(visual, page, placed) {
  const family = equipmentCodeForVisual(visual);
  if (!family) return false;
  return !hasPrintedEquipmentTagNear(page, family, placed);
}

function isTrustedUnlabeledPowerGlyph(visual, planType) {
  if (planType !== "power") return false;
  if (visual?.source !== "unlabeled-power-glyph") return false;
  const code = String(visual?.entry?.code || "").toUpperCase();
  if (code !== "R") return false;
  const geometry = visual?.geometry || {};
  if ((geometry.source || geometry.outline?.source) !== "vector") return false;
  return Number(visual?.score) >= 0.9;
}

function removeNearbyReviewMarks(counts, seen, sheet, point, radius = 0.34) {
  for (let index = counts.length - 1; index >= 0; index -= 1) {
    const mark = counts[index];
    if (mark.sheet !== sheet || !isReviewOnlyMark(mark)) continue;
    if (distance(mark, point) <= radius) counts.splice(index, 1);
  }
  for (let index = seen.length - 1; index >= 0; index -= 1) {
    const mark = seen[index];
    if (mark.sheet !== sheet || !isReviewOnlyMark(mark)) continue;
    if (distance(mark, point) <= radius) seen.splice(index, 1);
  }
}

function compactLegendCode(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isPrintedPlanDeviceCode(text) {
  const printed = normalizeTypeMark(text).toUpperCase();
  if (!printed) return false;
  if (isQuotedTypeMark(text)) return true;
  if (isLightingFixtureCode(printed) || printed === "F") return true;
  if (/^(WP|SP|SPR|GFI|GFI\/WP|OS|R|P2|DB|DOORBELL|FACP)$/.test(printed)) return true;
  return Boolean(taggedEquipmentCode(text));
}

function isPowerDeviceTag(printedCode, planType) {
  return /^(WP|SP|SPR|P2|DB|DOORBELL|GFI|GFI\/WP)$/.test(printedCode)
    || (planType === "power" && printedCode === "R");
}

function trustedOffsetEmergencyBody(token, geometry, placed) {
  const printed = normalizeTypeMark(token?.text).toUpperCase();
  if (!/^\d{1,2}E$/.test(printed) || !geometry || !placed) return false;
  const long = Math.max(Number(geometry.w) || 0, Number(geometry.h) || 0);
  const short = Math.min(Number(geometry.w) || 0, Number(geometry.h) || 0);
  const aspect = long / (short || 1e-9);
  const dist = Math.hypot(placed.x - token.x, placed.y - token.y);
  return long >= 0.55 && long <= 1.45 && short >= 0.45 && aspect <= 2.1 && dist <= 1.8;
}

function snapQuotedTypeOntoTag(token, geometry, placed, hint) {
  if (!token || !placed) return null;
  const printed = normalizeTypeMark(token.text).toUpperCase();
  const quotedOrLighting = isQuotedTypeMark(token.text)
    || isLightingFixtureCode(printed)
    || printed === "F";
  if (!quotedOrLighting) return null;
  const dist = Math.hypot(placed.x - token.x, placed.y - token.y);
  if (dist <= 0.50) return null;
  if (trustedOffsetEmergencyBody(token, geometry, placed)) return null;
  const long = Math.max(Number(geometry?.w) || 0, Number(geometry?.h) || 0);
  const short = Math.min(Number(geometry?.w) || 0, Number(geometry?.h) || 0);
  const aspect = long / (short || 1e-9);
  const junkOffset = long < 0.50 || short < 0.35 || aspect > 2.4;
  const tagOnSymbolCodes = /^(1|2|4|2E|F)$/;
  if (!junkOffset && !tagOnSymbolCodes.test(printed)) return null;
  return tagOnSymbolGeometry(token, {
    shapeHint: hint || (printed === "F" || isLightingFixtureCode(printed) ? "rect" : "circle"),
  });
}

function matchingPrintedLegend(point, page, dictionary, planType, entry) {
  const typed = nearbyLegendEntry(point, page.tokens || [], dictionary, {
    radius: 1.35,
    planType,
    anchorFamily: entryFamily(entry),
  });
  const printed = compactLegendCode(typed?.entry?.code);
  const wanted = compactLegendCode(entry?.code);
  if (printed && wanted && printed === wanted) return typed;
  return null;
}

function specialtyTypeCode(value) {
  const text = normalizeTypeMark(value).toUpperCase();
  if (text === "GFIWP" || text === "WPGFI" || text === "GFI/WP") return "GFI/WP";
  if (text === "SPR") return "SP";
  if (/^(WP|GFI|OS|SP)$/.test(text)) return text;
  return "";
}

function specialtyCodesMatch(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  return (left === "GFI/WP" && right === "GFI") || (left === "GFI" && right === "GFI/WP");
}

function printedSpecialtyTags(page, code) {
  return (page?.tokens || []).filter((token) => specialtyCodesMatch(specialtyTypeCode(token.text), code));
}

function hasPrintedSpecialtyTagNear(page, code, point, radius = 0.72) {
  if (!page || !code || !point) return false;
  return printedSpecialtyTags(page, code).some((token) => (
    Math.hypot((Number(token.x) || 0) - point.x, (Number(token.y) || 0) - point.y) <= radius
  ));
}

function isVisualOnlySpecialtyHit(visual, page, placed) {
  const code = specialtyTypeCode(visual?.entry?.code || visual?.entry?.symbol?.abbr);
  if (!code) return false;
  if (code === "WP" || code === "SP" || code === "GFI" || code === "GFI/WP") {
    return !hasPrintedSpecialtyTagNear(page, code, placed, 0.72);
  }
  if (code === "OS") {
    if (hasPrintedSpecialtyTagNear(page, "OS", placed, 0.72)) return false;
    return !looksLikeOccupancyGlyph(visual.geometry);
  }
  return false;
}

function keepLabeledSpecialtyMarks(marks, pages) {
  const pageMap = new Map((pages || []).map((page) => [page.page, page]));
  const claimed = new Set();
  const ranked = [...(marks || [])].sort((left, right) => {
    const leftToken = left.matchedFrom === "legend" || left.matchedFrom === "drawing" ? 0 : 1;
    const rightToken = right.matchedFrom === "legend" || right.matchedFrom === "drawing" ? 0 : 1;
    return leftToken - rightToken;
  });
  const kept = [];
  for (const mark of ranked) {
    if (isReviewOnlyMark(mark) || (mark.type !== "count" && mark.type !== "drop")) {
      kept.push(mark);
      continue;
    }
    const code = specialtyTypeCode(mark.typeCode || mark.abbr);
    if (code !== "WP" && code !== "SP" && code !== "OS" && code !== "GFI" && code !== "GFI/WP") {
      kept.push(mark);
      continue;
    }
    const page = pageMap.get(mark.sheet);
    const nearest = printedSpecialtyTags(page, code)
      .map((token) => ({
        token,
        dist: Math.hypot((Number(token.x) || 0) - mark.x, (Number(token.y) || 0) - mark.y),
      }))
      .sort((left, right) => left.dist - right.dist)[0];
    const fromToken = mark.matchedFrom === "legend" || mark.matchedFrom === "drawing";
    const tagDist = nearest?.dist ?? Infinity;
    if ((code === "WP" || code === "SP" || code === "GFI" || code === "GFI/WP") && !fromToken && tagDist > 0.72) continue;
    if (fromToken && tagDist > 1.15 && !mark.labelLocation) continue;
    if (nearest && tagDist <= 0.85) {
      const key = `${mark.sheet}|${code}|${Number(nearest.token.x).toFixed(2)}|${Number(nearest.token.y).toFixed(2)}`;
      if (claimed.has(key)) continue;
      claimed.add(key);
    } else if ((code === "WP" || code === "SP" || code === "GFI" || code === "GFI/WP") && !fromToken) {
      continue;
    }
    kept.push(mark);
  }
  return kept;
}

function addMissingSpecialtyTokenReviewMarks(marks, pages, options = {}) {
  const out = [...(marks || [])];
  const symbols = options.symbols || [];
  const aliases = options.aliases || [];
  for (const page of pages || []) {
    if (!shouldScan(page, options.trade || "electrical")) continue;
    const planType = pagePlanType(page);
    for (const token of page.tokens || []) {
      const code = specialtyTypeCode(token.text);
      if (!code) continue;
      if (!shouldAcceptPlanToken(token, page.tokens || [], { planType, paths: page.paths || [] })) continue;
      const alreadyCovered = out.some((mark) => {
        if (mark.sheet !== page.page || !specialtyCodesMatch(specialtyTypeCode(mark.typeCode || mark.abbr), code)) return false;
        const labelDist = mark.labelLocation
          ? Math.hypot((Number(mark.labelLocation.x) || 0) - (Number(token.x) || 0), (Number(mark.labelLocation.y) || 0) - (Number(token.y) || 0))
          : Infinity;
        const bodyDist = Math.hypot((Number(mark.x) || 0) - (Number(token.x) || 0), (Number(mark.y) || 0) - (Number(token.y) || 0));
        return labelDist <= 0.22 || bodyDist <= 0.42;
      });
      if (alreadyCovered) continue;
      const symbol = matchTradeSymbol(token.text, symbols, aliases, {
        planType,
        nearbyText: nearbyText(token, page.tokens || []),
        reject: (item) => !shouldAcceptPlanToken({ ...token, text: item.text }, page.tokens || [], { planType, paths: page.paths || [] }),
      });
      if (!symbol) continue;
      const shapeHint = code === "OS" || code === "GFI" || code === "GFI/WP" ? "circle" : "rect";
      const geometry = tagOnSymbolGeometry(token, { shapeHint });
      const mark = attachDetectionRecord({
        id: newId(),
        source: "ai",
        trade: options.trade || "electrical",
        type: "count",
        sheet: page.page,
        x: token.x,
        y: token.y,
        category: symbol.takeoffCategory || symbol.category,
        symbol: symbol.id,
        symbolLabel: symbol.label,
        abbr: symbol.abbr,
        typeCode: code,
        color: options.color || "#2563eb",
        matchedFrom: "drawing",
        outline: geometry?.outline || null,
        outlineSource: "text",
        detectSource: DETECT_SOURCE_ORIGINAL_PDF,
        confidence: "low",
        reviewStatus: "pending",
        layer: "device",
      }, {
        geometry,
        symbolBodyLocation: { x: Number(token.x) || 0, y: Number(token.y) || 0 },
        labelLocation: labelLocationFromToken(token),
        detectionSources: ["drawing", "text"],
        textContextScore: 0.7,
        requiresReview: true,
        reviewReason: "text-only-body",
      });
      out.push(mark);
    }
  }
  return out;
}

function validateTaggedEquipmentMarks(marks, pages) {
  const pageMap = new Map((pages || []).map((page) => [page.page, page]));
  return (marks || []).filter((mark) => {
    const family = equipmentFamilyCode(mark.typeCode)
      || equipmentFamilyCode(mark.abbr)
      || equipmentFamilyCode(mark.symbol)
      || equipmentFamilyCode(mark.symbolLabel);
    if (!family) return true;

    const page = pageMap.get(mark.sheet);
    const label = mark.labelLocation;
    if (label && hasPrintedEquipmentTagNear(page, family, label, 0.55)) return true;
    if ((mark.matchedFrom === "drawing" || mark.matchedFrom === "legend")
      && hasPrintedEquipmentTagNear(page, family, { x: mark.x, y: mark.y }, 2.4)) return true;
    return false;
  });
}

function isSitePlanPage(page) {
  const blob = `${page?.title || ""} ${page?.sheetId || ""} ${(page?.tokens || []).map((token) => token.text).join(" ")}`;
  if (/^ES\d/i.test(String(page?.sheetId || ""))) return true;
  return /\belectrical site plan\b|\bsite lighting\b|\bsite plan\b/i.test(blob) && !/\bfloor plan\b/i.test(blob);
}

function isIndoorLightingAlias(alias) {
  const blob = `${alias?.symbol?.id || ""} ${alias?.symbol?.label || ""} ${alias?.code || ""} ${alias?.symbol?.category || ""} ${alias?.symbol?.takeoffCategory || ""}`.toLowerCase();
  if (/site|pole|area light|street|parking|flood/.test(blob) && !/lighting fixture/.test(blob)) return false;
  if (/ceiling fan|bay fan|fanimation|paddle fan/.test(blob)) return true;
  if (/^f\d/.test(String(alias?.code || "").toLowerCase()) && !/recept|gfi|exhaust|vent/.test(blob)) return true;
  if (/\blighting\b/.test(blob) && !/recept|gfi|switch|sensor/.test(blob)) return true;
  return /troffer|downlight|strip|can light|2x4|2x2|1x4|recessed|surface/.test(blob);
}

function candidateKey(item) {
  return `${normalizeTakeoffText(normalizeTypeMark(item.text))}|${Number(item.x || 0).toFixed(1)}|${Number(item.y || 0).toFixed(1)}`;
}

function collectMatchCandidates(page, options = {}) {
  const accept = (token) => shouldAcceptPlanToken(token, page.tokens, options);
  const tokens = (page.tokens || []).filter((token) => !isSheetChrome(token) && accept(token));
  const phrases = phrasesFromTokens(tokens).filter((phrase) => accept(phrase));
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
  projectPrototypes = [],
  timeBudgetMs = 22000,
  includePage,
}) {
  const deadline = Date.now() + Math.max(4000, Number(timeBudgetMs) || 22000);
  const remainingMs = () => deadline - Date.now();
  const timedScan = (page, dictionary, options) => {
    const budget = Math.max(0, Math.min(2800, remainingMs()));
    if (budget < 80) return [];
    return scanPageByLegendGeometry(page, dictionary, { ...options, timeBudgetMs: budget });
  };
  const anchorIds = new Set(ANCHOR_SYMBOL_IDS[trade] || []);
  let dictionary = attachLegendGeometryPrototypes(legendDictionaryFromPages(pages, drawingSymbols, symbols, trade), pages);
  if (projectPrototypes.length) dictionary = attachProjectPrototypes(dictionary, projectPrototypes);
  const aliases = dictionary.aliases;
  const usableDrawing = dictionary.usableDrawing;
  const matchSymbols = [...(symbols || []), ...usableDrawing];
  const counts = [];
  const seen = [];
  const usedGeometry = new Set();
  // Use exactly the same eligible pages as raster hydration. Previously the
  // raster fallback could extract candidates from a sheet that this loop then
  // silently skipped, producing a completed takeoff with zero device counts.
  const scanPages = pagesIncludedInTakeoff(pagesToScan(pages, trade, dictionary), includePage);
  for (const page of scanPages) {
    const sitePlan = isSitePlanPage(page);
    const planType = pagePlanType(page);
    const pageCandidates = collectMatchCandidates(page, { planType, paths: page.paths || [], sitePlan });
    const hits = [];
    for (const token of pageCandidates) {
      const symbol = matchTradeSymbol(token.text, matchSymbols, aliases, {
        sectionContext: token.sectionContext,
        nearbyText: token.nearbyText,
        sitePlan,
        planType,
        reject: (item) => !shouldAcceptPlanToken({ ...token, text: item.text }, page.tokens, { planType, paths: page.paths || [], sitePlan }),
      });
      if (!symbol) continue;
      hits.push({ token, symbol });
    }
    const assigned = assignExclusiveGeometry(hits.map((hit) => hit.token), page.paths || [], {
      shapeHintFor: (token) => shapeHintForToken(token.text, dictionary),
    });
    for (const hit of hits) {
      let { token, symbol } = hit;
      const hint = shapeHintForToken(token.text, dictionary)
        || (isCanDeviceText(token.text, token.nearbyText, symbol.label) ? "circle" : null);
      const entry = (dictionary.entries || []).find((item) => normalizeTakeoffText(item.code) === normalizeTakeoffText(normalizeTypeMark(token.text)));
      const printedCode = normalizeTypeMark(token.text).toUpperCase();
      const powerDeviceTag = isPowerDeviceTag(printedCode, planType);
      const powerGlyph = powerDeviceTag
        ? findNearbyReceptacleGlyph(token, page.paths || [], {
          radius: printedCode === "WP" || printedCode === "GFI/WP" ? 0.55 : 0.62,
          allowWpCover: printedCode === "WP" || printedCode === "GFI/WP",
        })
        : null;
      const occupancyGlyph = printedCode === "OS"
        ? findNearbyOccupancyGlyph(token, page.paths || [], { radius: 0.62 })
        : null;
      let geometry = occupancyGlyph
        ? { ...occupancyGlyph, source: "vector", outline: occupancyGlyph.outline || { kind: occupancyGlyph.kind || "path", source: "vector", w: occupancyGlyph.w, h: occupancyGlyph.h, points: occupancyGlyph.points || [] } }
        : powerGlyph
        ? { ...powerGlyph, source: "vector", outline: powerGlyph.outline || { kind: powerGlyph.kind || "rect", source: "vector", w: powerGlyph.w, h: powerGlyph.h, points: powerGlyph.points || [] } }
        : assigned.get(token) || placeOnSymbolGeometry(token, (page.paths || []).filter((item) => !usedGeometry.has(item)), {
          shapeHint: hint,
          rivals: hits.map((other) => other.token).filter((other) => other !== token),
        }) || assembleTrofferNearTag(token, (page.paths || []).filter((item) => !usedGeometry.has(item)))
        || snapToEntryPrototype(token, page, entry, { used: usedGeometry });
      if (geometry && looksLikeHexNoteGlyph(geometry)) {
        geometry = powerGlyph
          ? { ...powerGlyph, source: "vector", outline: powerGlyph.outline || { kind: powerGlyph.kind || "rect", source: "vector", w: powerGlyph.w, h: powerGlyph.h } }
          : null;
      }
      if (geometry && powerDeviceTag) {
        const away = Math.hypot((geometry.cx || 0) - token.x, (geometry.cy || 0) - token.y);
        if (away > 0.62) {
          geometry = powerGlyph
            ? { ...powerGlyph, source: "vector", outline: powerGlyph.outline || { kind: powerGlyph.kind || "rect", source: "vector", w: powerGlyph.w, h: powerGlyph.h } }
            : null;
        }
      }
      if (hint === "circle" && geometry && !occupancyGlyph) {
        const away = Math.hypot((geometry.cx || 0) - token.x, (geometry.cy || 0) - token.y);
        const code = normalizeTypeMark(token.text).toUpperCase();
        if (away > 0.48 && code === "OS") {
          geometry = null;
        }
      }
      if (isCanDeviceText(token.text, token.nearbyText, symbol.label) && geometry?.kind !== "rect") {
        symbol = resolveCanSymbol(matchSymbols) || symbol;
      }
      const lightingType = planType === "lighting" || /^\d{1,2}E?$/.test(printedCode);
      const twinTaken = lightingType && hits.some((other) => {
        if (other.token === token) return false;
        const otherCode = normalizeTypeMark(other.token.text).toUpperCase();
        if (otherCode.replace(/E$/, "") !== printedCode.replace(/E$/, "") || otherCode === printedCode) return false;
        return Math.hypot((other.token.x || 0) - token.x, (other.token.y || 0) - token.y) < 2.8;
      });
      if (twinTaken && (!geometry || geometry.source === "text" || geometry.outline?.source === "text")) {
        const leftover = placeOnSymbolGeometry(token, (page.paths || []).filter((item) => !usedGeometry.has(item)), {
          shapeHint: hint || "rect",
          rivals: [],
          farRadius: 1.7,
        });
        if (leftover && leftover.source !== "text" && !looksLikeHexNoteGlyph(leftover)) {
          const long = Math.max(Number(leftover.w) || 0, Number(leftover.h) || 0);
          if (long >= 0.4 && long <= 1.15) geometry = leftover;
        }
      }
      let paintOutline = geometry ? symbolBodyOutline(geometry, page.tokens, { paths: page.paths }) : null;
      let geometryPoint = geometry ? {
        x: Number(paintOutline?.cx ?? geometry.cx),
        y: Number(paintOutline?.cy ?? geometry.cy),
      } : null;
      // Prefer extracted fixture geometry. When the type mark sits on the symbol
      // itself (slashed-circle cans, OS, GFI, quoted Revit types), the tag *is*
      // the device — place the fill there instead of inventing an offset or
      // dropping the count. Chrome/title-block stays dropped. A classified
      // token with no symbol body stays as UNKNOWN/REVIEW instead of vanishing.
      if (geometryPoint && !placementAllowed(geometryPoint, { sitePlan })) continue;
      if (!geometryPoint && isPrintedPlanDeviceCode(token.text) && placementAllowed({ x: token.x, y: token.y }, { sitePlan })) {
        const fallbackHint = hint
          || (isLightingFixtureCode(printedCode) || printedCode === "F" ? "rect" : "circle");
        geometry = tagOnSymbolGeometry(token, { shapeHint: fallbackHint });
        paintOutline = geometry ? symbolBodyOutline(geometry, page.tokens, { paths: page.paths }) : null;
        geometryPoint = geometry ? {
          x: Number(paintOutline?.cx ?? geometry.cx),
          y: Number(paintOutline?.cy ?? geometry.cy),
        } : null;
      }
      if (geometryPoint) {
        const snapped = snapQuotedTypeOntoTag(token, geometry, geometryPoint, hint);
        if (snapped) {
          geometry = snapped;
          paintOutline = symbolBodyOutline(geometry, page.tokens, { paths: page.paths });
          geometryPoint = {
            x: Number(paintOutline?.cx ?? geometry.cx),
            y: Number(paintOutline?.cy ?? geometry.cy),
          };
        }
      }
      if (!geometryPoint) {
        const review = reviewCandidateMark({
          trade,
          sheet: page.page,
          label: labelLocationFromToken(token),
          reason: "classified-without-symbol-body",
          sources: ["text"],
          scores: { text: 0.55 },
        });
        if (review) {
          counts.push(review);
          seen.push({ ...review, tagX: token.x, tagY: token.y });
        }
        continue;
      }
      const placed = geometryPoint;
      const geometrySource = geometry?.outline?.source || geometry?.source || "text";
      const geometryAnchored = geometrySource !== "text";
      const compact = normalizeTakeoffText(normalizeTypeMark(token.text));
      const fromLegend = aliases.some((alias) => normalizeTakeoffText(alias.code) === compact && alias.symbol?.id === symbol.id);
      const printed = normalizeTypeMark(token.text).toUpperCase();
      const typeCode = fromLegend || isLightingFixtureCode(printed) || printed === "F" || /^(WP|SP|SPR|GFI|GFI\/WP|OS|R|P2|DB|DOORBELL|FACP)$/.test(printed)
        ? (printed === "DOORBELL" ? "DB" : printed)
        : (taggedEquipmentCode(token.text) || symbol.abbr || "").toUpperCase();
      const near = seen.some((item) => {
        if (item.sheet !== page.page) return false;
        const sameType = item.typeCode === typeCode
          || (typeCode === "GFI" && item.typeCode === "GFI/WP")
          || (typeCode === "GFI/WP" && item.typeCode === "GFI");
        if (!sameType) return false;
        const tagDist = Math.hypot((item.tagX ?? item.x) - token.x, (item.tagY ?? item.y) - token.y);
        if (powerDeviceTag && tagDist >= 0.55) return false;
        return tagDist < 0.35 || (distance(item, placed) < 0.42 && tagDist < 0.9);
      });
      if (near) continue;
      // For point devices without trusted geometry (like OS), create a minimal circle outline
      // so they are hit-testable and renderable with a generic chip.
      if (!paintOutline && /^(OS|GFI|GFI\/WP|WP|SP|SPR)$/.test(typeCode)) {
        paintOutline = {
          kind: "circle",
          source: "generic",
          r: 0.52,
        };
      }
      const mark = attachDetectionRecord({
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
        legendEntryId: entry?.legend?.id || null,
        legendCode: entry?.code || typeCode,
        legendLabel: entry?.legend?.label || entry?.symbol?.label || symbol?.label || "",
        legendCategory: entry?.legend?.takeoffCategory || entry?.legend?.category || entry?.symbol?.takeoffCategory || entry?.symbol?.category || symbol?.takeoffCategory || symbol?.category || "",
        legendSource: entry?.legend?.source || entry?.symbol?.source || "",
        legendSourcePage: entry?.legend?.page || entry?.symbol?.page || null,
        outline: paintOutline,
        outlineSource: paintOutline?.source || geometrySource,
        detectSource: DETECT_SOURCE_ORIGINAL_PDF,
        confidence: geometrySource === "vector" ? "high" : "medium",
        reviewStatus: "pending",
        layer: "device",
        anchor: anchorIds.has(symbol.id),
      }, {
        geometry,
        symbolBodyLocation: placed,
        labelLocation: labelLocationFromToken(token),
        circuitTagLocation: nearbyCircuitTag(token, page.tokens),
        detectionSources: [fromLegend ? "legend" : "drawing", geometrySource].filter(Boolean),
        vectorMatchScore: geometrySource === "vector" ? 0.9 : 0,
        legendMatchScore: fromLegend ? 0.85 : 0,
        textContextScore: 0.7,
        visualMatchScore: powerGlyph ? 0.85 : 0,
      });
      counts.push(mark);
      seen.push({ ...mark, tagX: token.x, tagY: token.y });
      if (geometryAnchored) usedGeometry.add(geometry);
    }
    // Process confirmed labeled detections first. Review-only visual candidates
    // must not reserve geometry and suppress actual legend-linked devices.
    // Visual legend pass: detect repeated graphical symbols even when the plan has
    // no adjacent type text. This is required for power receptacles and many light
    // fixtures whose only identity is their legend geometry.
    const visualHits = timedScan(page, dictionary, {
      planType,
      threshold: 0.74,
      strictSize: false,
      occupyRadius: 0.24,
      occupied: seen.filter((item) => item.sheet === page.page),
    });
    for (const visual of visualHits) {
      const geometry = visual.geometry;
      const paintOutline = symbolBodyOutline(geometry, page.tokens, { paths: page.paths });
      const placed = {
        x: Number(paintOutline?.cx ?? geometry.cx),
        y: Number(paintOutline?.cy ?? geometry.cy),
      };
      if (isVisualOnlyEquipmentHit(visual, page, placed)) continue;
      if (isVisualOnlySpecialtyHit({ ...visual, geometry }, page, placed)) continue;
      if (!placementAllowed(placed, { sitePlan })) continue;
      const duplicate = seen.some((item) => item.sheet === page.page && distance(item, placed) < 0.34);
      if (duplicate) continue;
      const review = reviewCandidateMark({
        trade,
        sheet: page.page,
        geometry,
        reason: "legend-geometry-review",
        sources: ["legend-geometry", "vector"],
        scores: { visual: visual.score, legend: visual.score, vector: visual.score },
      });
      if (!review) continue;
      counts.push(review);
      seen.push({ ...review, tagX: placed.x, tagY: placed.y });
    }
    // After labeled hits exist, copy their extracted bodies and slash/tick
    // fragments across the same sheet to recover devices that have no printed type mark.
    const pageCounts = counts.filter((mark) => mark.sheet === page.page);
    if (planType === "power") dictionary = attachPowerGlyphPrototypes(dictionary, pageCounts, page);
    dictionary = attachConfirmedGeometryPrototypes(dictionary, pageCounts);
    dictionary = attachFragmentPrototypes(dictionary, pageCounts, page);
    const occupied = seen.filter((item) => (
      item.sheet === page.page
      && (planType !== "lighting" || !isReviewOnlyMark(item))
    ));
    const twinHits = planType === "power" ? [] : timedScan(page, {
      ...dictionary,
      entries: (dictionary.entries || []).filter((entry) => /^\d{1,2}e?$/i.test(entry.code || "") && /2x4|troffer/i.test(entry.symbol?.label || "")),
    }, {
      planType,
      threshold: 0.80,
      strictSize: false,
      keepSeedBody: true,
      twinHatch: true,
      occupyRadius: 1.55,
      occupied,
    }).filter((hit) => {
      const code = String(hit.entry?.code || "").toLowerCase();
      if (!code.endsWith("e")) return true;
      const nearby = (page.paths || []).filter((path) => Math.hypot((path.cx || 0) - hit.geometry.cx, (path.cy || 0) - hit.geometry.cy) <= 0.8);
      return isEmergencyHatch(hit.geometry, nearby);
    });
    const unlabeledHits = [
      ...timedScan(page, dictionary, {
        planType,
        threshold: 0.76,
        strictSize: false,
        occupyRadius: 0.28,
        occupied,
      }),
      ...twinHits,
      ...(planType === "power" ? scanUnlabeledPowerGlyphs(page, { occupied: occupied.filter((item) => !isReviewOnlyMark(item)), symbols: matchSymbols }) : []),
    ];
    for (const visual of unlabeledHits) {
      const geometry = visual.geometry;
      const trustedPowerGlyph = isTrustedUnlabeledPowerGlyph(visual, planType);
      const paintOutline = trustedPowerGlyph
        ? (geometry.outline || geometry)
        : symbolBodyOutline(geometry, page.tokens, { paths: page.paths });
      const placed = {
        x: Number((trustedPowerGlyph ? geometry.cx : paintOutline?.cx) ?? geometry.cx),
        y: Number((trustedPowerGlyph ? geometry.cy : paintOutline?.cy) ?? geometry.cy),
      };
      const titleBand = placed.y < 12;
      if (!placementAllowed(placed, { sitePlan }) || !isPlanInterior(placed) || isPlotStampToken(placed, page.tokens) || titleBand) continue;
      if (looksLikeHexNoteGlyph(geometry)) continue;
      const existingIndex = counts.findIndex((mark) => mark.sheet === page.page && distance(mark, placed) < 0.34);
      const existing = existingIndex >= 0 ? counts[existingIndex] : null;
      if (existing && !(trustedPowerGlyph && isReviewOnlyMark(existing))) continue;
      if (isVisualOnlyEquipmentHit(visual, page, placed)) continue;
      if (isVisualOnlySpecialtyHit({ ...visual, geometry }, page, placed)) continue;
      if (trustedPowerGlyph) {
        removeNearbyReviewMarks(counts, seen, page.page, placed);
        const symbol = visual.entry?.symbol;
        const mark = attachDetectionRecord({
          id: newId(),
          source: "ai",
          trade,
          type: "count",
          sheet: page.page,
          x: placed.x,
          y: placed.y,
          category: symbol?.takeoffCategory || symbol?.category || "Receptacles",
          symbol: symbol?.id || "duplex",
          symbolLabel: symbol?.label || "Duplex receptacle",
          abbr: symbol?.abbr || "R",
          typeCode: "R",
          color,
          matchedFrom: "plan-glyph",
          outline: paintOutline,
          outlineSource: paintOutline?.source || geometry?.source || "vector",
          detectSource: DETECT_SOURCE_ORIGINAL_PDF,
          confidence: "high",
          reviewStatus: "pending",
          layer: "device",
          geometryScore: visual.score,
        }, {
          geometry,
          symbolBodyLocation: placed,
          detectionSources: ["plan-glyph", "vector"],
          vectorMatchScore: visual.score,
          visualMatchScore: visual.score,
          combinedConfidence: visual.score,
          requiresReview: false,
        });
        counts.push(mark);
        seen.push({ ...mark, tagX: placed.x, tagY: placed.y });
        continue;
      }
      const review = reviewCandidateMark({
        trade,
        sheet: page.page,
        geometry,
        reason: matchingPrintedLegend(placed, page, dictionary, planType, visual.entry)
          ? "duplicate-plan-repeat"
          : "unlabeled-plan-repeat",
        sources: ["plan-repeat", "legend-geometry"],
        scores: { visual: visual.score, legend: visual.score, vector: visual.score },
      });
      if (review) {
        counts.push(review);
        seen.push({ ...review, tagX: placed.x, tagY: placed.y });
      }
    }
    // Keep mid-confidence visual hits as UNKNOWN/REVIEW instead of deleting them.
    // Chrome, hex notes, hatch ticks, and title-block stamps stay dropped.
    const reviewHits = timedScan(page, dictionary, {
      planType,
      threshold: REVIEW_VISUAL_THRESHOLD,
      occupyRadius: 0.34,
      occupied: seen.filter((item) => item.sheet === page.page),
    });
    for (const visual of reviewHits) {
      const geometry = visual.geometry;
      const placed = { x: geometry.cx, y: geometry.cy };
      const titleBand = placed.y < 12;
      if (!placementAllowed(placed, { sitePlan }) || !isPlanInterior(placed) || isPlotStampToken(placed, page.tokens) || titleBand) continue;
      if (looksLikeHexNoteGlyph(geometry) || isHatchTickCluster(geometry, page.paths || [])) continue;
      const duplicate = seen.some((item) => item.sheet === page.page && distance(item, placed) < 0.34);
      if (duplicate) continue;
      const review = reviewCandidateMark({
        trade,
        sheet: page.page,
        geometry,
        reason: "low-confidence-visual",
        sources: ["legend-geometry"],
        scores: { visual: visual.score, legend: visual.score, vector: visual.score },
      });
      if (!review) continue;
      counts.push(review);
      seen.push({ ...review, tagX: placed.x, tagY: placed.y });
    }
    // Final high-recall recovery pass: search each legend type independently
    // after normal detection has established prototypes. This catches repeated
    // symbols that were skipped by the global competition/deduplication pass.
    const recoveryHits = remainingMs() > 200
      ? recoverMissedLegendSymbols(page, dictionary, {
        planType,
        occupied: seen.filter((item) => item.sheet === page.page),
        deadline,
      })
      : [];
    for (const visual of recoveryHits) {
      const geometry = visual.geometry;
      const symbol = visual.entry?.symbol;
      if (!geometry || !symbol) continue;
      const paintOutline = symbolBodyOutline(geometry, page.tokens, { paths: page.paths });
      const placed = {
        x: Number(paintOutline?.cx ?? geometry.cx),
        y: Number(paintOutline?.cy ?? geometry.cy),
      };
      if (isVisualOnlySpecialtyHit(visual, page, placed)) continue;
      if (!placementAllowed(placed, { sitePlan }) || !isPlanInterior(placed) || isPlotStampToken(placed, page.tokens)) continue;
      if (placed.y < 12) continue;
      if (looksLikeHexNoteGlyph(geometry) || isHatchTickCluster(geometry, page.paths || [])) continue;
      if (seen.some((item) => item.sheet === page.page && distance(item, placed) < 0.28)) continue;
      const review = reviewCandidateMark({
        trade,
        sheet: page.page,
        geometry,
        reason: matchingPrintedLegend(placed, page, dictionary, planType, visual.entry)
          ? "duplicate-legend-recovery"
          : "unlabeled-legend-recovery",
        sources: ["legend-recovery"],
        scores: { visual: visual.score, legend: visual.score, vector: visual.score },
      });
      if (review) {
        counts.push(review);
        seen.push({ ...review, tagX: placed.x, tagY: placed.y });
      }
    }

    const rasterHits = matchRasterToLegend(rasterCandidatesFromPage(page), dictionary, {
      threshold: REVIEW_VISUAL_THRESHOLD,
    });
    for (const visual of rasterHits) {
      const geometry = visual.geometry;
      const paintOutline = symbolBodyOutline(geometry, page.tokens, { paths: page.paths });
      const placed = {
        x: Number(paintOutline?.cx ?? geometry.cx),
        y: Number(paintOutline?.cy ?? geometry.cy),
      };
      if (isVisualOnlyEquipmentHit(visual, page, placed)) continue;
      if (isVisualOnlySpecialtyHit(visual, page, placed)) continue;
      const titleBand = placed.y < 12;
      if (!placementAllowed(placed, { sitePlan }) || !isPlanInterior(placed) || isPlotStampToken(placed, page.tokens) || titleBand) continue;
      if (looksLikeHexNoteGlyph(geometry) || isHatchTickCluster(geometry, page.paths || [])) continue;
      const existing = counts.find((mark) => mark.sheet === page.page && distance(mark, placed) < 0.4);
      if (existing) {
        existing.detectionSources = [...new Set([...(existing.detectionSources || []), "raster"])];
        existing.visualMatchScore = Math.max(Number(existing.visualMatchScore) || 0, visual.score);
        const rasterCode = String(visual.entry?.code || "").toUpperCase();
        if (rasterCode && existing.typeCode && rasterCode !== existing.typeCode && !isReviewOnlyMark(existing)) {
          existing.requiresReview = true;
          existing.detectionAmbiguous = true;
          existing.reviewReason = existing.reviewReason || "detector-disagreement";
        }
        continue;
      }
      const symbol = visual.entry?.symbol;
      if (visual.score >= 0.84 && symbol && !visual.ambiguous) {
        const mark = attachDetectionRecord({
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
          typeCode: String(visual.entry.code || symbol.abbr || "").toUpperCase(),
          color,
          matchedFrom: "raster",
          outline: paintOutline,
          outlineSource: paintOutline?.source || "raster",
          detectSource: DETECT_SOURCE_ORIGINAL_PDF,
          confidence: "medium",
          reviewStatus: "pending",
          layer: "device",
          geometryScore: visual.score,
        }, {
          geometry,
          symbolBodyLocation: placed,
          detectionSources: ["raster"],
          visualMatchScore: visual.score,
          requiresReview: true,
          reviewReason: "raster-only",
        });
        counts.push(mark);
        seen.push({ ...mark, tagX: placed.x, tagY: placed.y });
        continue;
      }
      const review = reviewCandidateMark({
        trade,
        sheet: page.page,
        geometry,
        reason: visual.ambiguous ? "detector-disagreement" : "low-confidence-visual",
        sources: ["raster"],
        scores: { visual: visual.score },
      });
      if (!review) continue;
      counts.push(review);
      seen.push({ ...review, tagX: placed.x, tagY: placed.y });
    }
    if (planType === "lighting") {
      for (const path of page.paths || []) {
        if (!looksLikeRecessedCanBody(path)) continue;
        const placed = { x: path.cx, y: path.cy };
        if (!placementAllowed(placed, { sitePlan }) || !isPlanInterior(placed) || placed.x > 64 || placed.y < 12) continue;
        if (isPlotStampToken(placed, page.tokens)) continue;
        if (seen.some((item) => item.sheet === page.page && distance(item, placed) < 0.55)) continue;
        const review = typedLightingBodyMark({
          trade,
          sheet: page.page,
          geometry: path,
          placed,
          tokens: page.tokens,
          paths: page.paths,
          symbols: matchSymbols,
          color,
          sources: ["vector"],
          scores: { visual: 0.7, vector: 0.75 },
        });
        if (!review) continue;
        counts.push(review);
        seen.push({ ...review, tagX: placed.x, tagY: placed.y });
      }
    }
  }
  let validatedCounts = validateTaggedEquipmentMarks(
    keepLabeledSpecialtyMarks(dedupePhysicalSymbols(counts), pages),
    pages,
  );
  validatedCounts = addMissingSpecialtyTokenReviewMarks(validatedCounts, pages, {
    trade,
    color,
    symbols: matchSymbols,
    aliases,
  });
  const anchors = validatedCounts.filter((mark) => mark.anchor && !isReviewOnlyMark(mark));
  const devices = validatedCounts.filter((mark) => !mark.anchor && !isReviewOnlyMark(mark));
  const sections = findConduitSections(pages, trade, dictionary);
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
  const callouts = findConduitRunCallouts(pages, trade, dictionary);
  conduits.push(...applyConduitCallouts(conduits, callouts, anchors, conduits.length, trade, color));
  const cap = Math.max(1, Number(maxHomeruns) || DEFAULT_MAX_HOMERUNS);
  const pageKinds = Object.fromEntries((pages || []).filter((page) => page?.page).map((page) => [page.page, page.kind]));
  const noteMarks = notesToMarks(extractSheetNotes(pages, trade), trade);
  const coloredMarks = applyDeviceTypeColors([
    ...validatedCounts.map(({ anchor, ...mark }) => mark),
    ...conduits,
    ...noteMarks,
  ]);
  const persistedCount = persistedPlanDeviceCount(validatedCounts, pageKinds);
  const legendHits = validatedCounts.filter((mark) => mark.matchedFrom === "legend").length;
  const scannedPageNumbers = new Set(scanPages.map((page) => page.page));
  const skipped = (pages || []).filter((page) => !scannedPageNumbers.has(page.page));
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
  const reconciliation = reconcilePlanToSchedule({
    marks: validatedCounts,
    pages,
    pageKinds,
    trade,
  });
  const searchManifest = buildTradeSearchManifest({
    pages,
    trade,
    dictionary,
    marks: validatedCounts,
    shouldScanPage: (page) => scannedPageNumbers.has(page.page),
  });
  return {
    marks: coloredMarks,
    summary: persistedCount
      ? `AI ${trade} takeoff: ${persistedCount} devices from the drawing${legendHits ? ` (${legendHits} matched from the legend)` : ""}, ${conduits.length} conduit runs on ${trade} sheets showing run count and path, max ${cap} homeruns per conduit.${skipNote}`
      : `No ${trade} symbols were found on ${trade} sheets.${skipNote || " Counts stay empty until that trade is labeled on the sheets."}`,
    deviceCount: persistedCount,
    reviewCount: validatedCounts.filter(isReviewOnlyMark).length,
    conduitCount: conduits.length,
    noteCount: noteMarks.length,
    skippedSheets,
    reconciliation,
    searchManifest,
    reconciliationNote: describeReconciliation(reconciliation),
  };
}
