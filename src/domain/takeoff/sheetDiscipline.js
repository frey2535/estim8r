export const SHEET_ID_RE = /\b([A-Z]{1,3})[- ]?(\d{1,2})[.-](\d{2})[A-Z]?\b/i;

const PREFIX_TRADE = {
  e: "electrical",
  el: "electrical",
  ep: "electrical",
  es: "electrical",
  ed: "electrical",
  ee: "electrical",
  fa: "fire-alarm",
  p: "plumbing",
  pl: "plumbing",
  s: "structural",
  st: "structural",
  sf: "structural",
  c: "civil",
  cg: "civil",
  cs: "civil",
  cm: "civil",
  cu: "civil",
  m: "mechanical",
  mh: "mechanical",
  mp: "mechanical",
  h: "hvac",
  hv: "hvac",
  a: "architectural",
  ad: "architectural",
};

const TITLE_HINTS = [
  { trade: "electrical", re: /\belectrical\b|lighting (?:fixture )?(?:plan|schedule)|power plan|one[\s-]?line|panelboard schedule|site lighting|electrical site/i },
  { trade: "fire-alarm", re: /\bfire[\s-]?alarm\b/i },
  { trade: "plumbing", re: /\bplumbing\b|sanitary waste|domestic water|underslab plumbing|plumbing legend/i },
  { trade: "structural", re: /\bstructural\b|foundation plan|roof framing|framing plan/i },
  { trade: "civil", re: /\bconstruction management\b|grading plan|erosion control|stormwater|site (?:civil )?plan\b/i },
  { trade: "hvac", re: /\bhvac\b/i },
  { trade: "mechanical", re: /\bmechanical\b|ductwork/i },
  { trade: "architectural", re: /\barchitectural\b/i },
];

const RELATED = {
  hvac: ["mechanical"],
  mechanical: ["hvac"],
};

export function parseSheetId(text) {
  const match = String(text || "").toUpperCase().match(SHEET_ID_RE);
  if (!match) return "";
  return `${match[1]}${Number(match[2])}.${match[3]}`;
}

export function tradeFromSheetId(sheetId) {
  const match = String(sheetId || "").toUpperCase().match(/^([A-Z]{1,3})/);
  if (!match) return "";
  return PREFIX_TRADE[match[1].toLowerCase()] || "";
}

export function findSheetId(tokens) {
  let best = "";
  let bestScore = -1;
  for (const token of tokens || []) {
    const id = parseSheetId(token.text);
    if (!id) continue;
    const score = (Number(token.x) || 0) + (Number(token.y) || 0);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

function hintTrade(text) {
  const blob = String(text || "");
  if (!blob.trim()) return "";
  for (const row of TITLE_HINTS) {
    if (row.re.test(blob)) return row.trade;
  }
  return "";
}

export function classifySheetDiscipline(text, tokens = []) {
  const list = tokens || [];
  const titleTokens = list.filter((token) => (token.x || 0) >= 68 && (token.y || 0) >= 70);
  const titleId = findSheetId(titleTokens.length ? titleTokens : list);
  const fromTitleId = tradeFromSheetId(titleId);
  if (fromTitleId) return fromTitleId;

  const fromTitleHint = hintTrade(titleTokens.map((token) => token.text).join(" "));
  if (fromTitleHint) return fromTitleHint;

  const blob = String(text || "");
  const fromHint = hintTrade(blob);
  if (fromHint) return fromHint;

  return tradeFromSheetId(parseSheetId(blob)) || "unknown";
}

export function pageDiscipline(page) {
  if (page?.discipline) return page.discipline;
  const tokens = page?.tokens || [];
  const text = [page?.sheetId, page?.title, ...tokens.map((token) => token.text)].filter(Boolean).join("\n");
  return classifySheetDiscipline(text, tokens);
}

export function pageMatchesTrade(page, trade) {
  if (!trade) return true;
  const discipline = pageDiscipline(page);
  if (!discipline || discipline === "unknown") return true;
  if (discipline === trade) return true;
  return (RELATED[trade] || []).includes(discipline);
}

export function isSheetChrome(token) {
  const x = Number(token?.x) || 0;
  const y = Number(token?.y) || 0;
  return (x >= 78 && y >= 78) || (x >= 86 && y <= 14) || y >= 97 || x <= 1.5;
}
