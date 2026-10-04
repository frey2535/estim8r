import { electricalSheetLooksLikePlan } from "./sheetDiscipline.js";

const LEGEND_RE = /electrical\s+legend|lighting\s+legend|symbol\s+legend|\blegend\b|abbreviation/i;
const LIGHTING_SCHED_RE = /lighting\s+fixture\s+schedule|fixture\s+schedule|luminaire\s+schedule|lighting\s+schedule/i;
const DEVICE_SCHED_RE = /device\s+schedule|receptacle\s+schedule|switch\s+schedule/i;
const EQUIP_SCHED_RE = /equipment\s+schedule|mechanical\s+equipment|panel\s+schedule/i;
const ONELINE_RE = /\briser\s+diagram\b|one[\s-]?line(?:\s+diagram)?|single[\s-]?line/i;
const DETAIL_RE = /\b(?:electrical\s+)?(?:site\s+)?plan\s+details\b|\bsite\s+plan\s+details\b/i;
const SPEC_RE = /specification|general\s+notes|electrical\s+notes|abbreviations/i;
const PLAN_TITLE_RE = /\b(?:electrical\s+)?(?:lighting|power|receptacle|branch\s+power|floor)\s+plans?\b|\belectrical\s+(?:lighting|power)\b|\bpower\s*(?:&|and)\s*systems?\s+plans?\b/i;
const INDEX_RE = /\bdrawing\s+index\b|\bsheet\s+index\b|\bindex\s+of\s+drawings\b|\bthese\s+drawings\s+reflect\b/i;
const COVER_SHEET_RE = /\bcover\s*(?:sheet|\/)|^\s*cover\b|\bproject\s+cover\b|\btitle\s*sheet\b/i;
const COVERPLATE_RE = /\bcover\s*plates?\b/i;
const RENDERING_RE = /\b(?:artist'?s\s+)?rendering\b|\b3d\s+views?\b|\barchitectural\s+perspectives?\b/i;
const COMCHECK_RE = /\bcomcheck\b/i;
const SITE_ELECTRICAL_PLAN_RE = /\belectrical\s+site\s+plans?\b|\bsite\s+(?:electrical|lighting)\s+plans?\b|\bsite\s+lighting\s+plans?\b/i;
const SKIP = /^(symbol|symbols|description|type|manufacturer|model|remarks|notes|qty|quantity|mounting|voltage|watts|lamp|catalog)$/i;
const TYPE_RE = /^(?:type\s*)?([a-z]{1,3}\d{0,3}[a-z]{0,2}|\d{1,3}[a-z]{0,3})$/i;

function parseFraction(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  if (text.includes("/")) {
    const [a, b] = text.split("/").map(Number);
    return b ? a / b : 0;
  }
  return Number(text) || 0;
}

export function parsePrintedScale(text) {
  const blob = String(text || "");
  const architectural = blob.match(/\b(\d+(?:\/\d+)?|\d*\.\d+)\s*"\s*=\s*(\d+)\s*'\s*(?:-\s*(\d+)\s*")?/i);
  if (architectural) {
    const drawingInches = parseFraction(architectural[1]);
    const feet = Number(architectural[2]) + (Number(architectural[3] || 0) / 12);
    if (drawingInches > 0 && feet > 0) return { drawingInches, realFeet: feet, label: architectural[0].replace(/\s+/g, " ").trim() };
  }
  return null;
}

export function printedScaleCalibration(page) {
  const scale = page?.printedScale;
  const widthPt = Number(page?.widthPt) || 0;
  if (!scale?.drawingInches || !scale.realFeet || !widthPt) return null;
  const sheetWidthInches = widthPt / 72;
  const feetPerDrawingInch = scale.realFeet / scale.drawingInches;
  return {
    feet: sheetWidthInches * feetPerDrawingInch,
    percentLength: 100,
    source: "printed-scale",
    scaleLabel: scale.label,
  };
}

const STRONG_LEGEND_TITLE_RE = /\belectrical\s+(?:symbol\s+)?legend(?:\s*(?:and|&)\s*schedules?)?\b|\belectrical\s+legend\s+and\s+schedules\b|\bgeneral\s+notes\s*(?:&|and)\s*legends?\b/i;
const LIGHTING_PLAN_TITLE_RE = /\b(?:electrical\s+)?lighting(?:\s+floor)?\s+plans?\b|\bfloor\s+lighting\s+plans?\b/i;
const POWER_PLAN_TITLE_RE = /\b(?:electrical\s+)?power(?:\s+floor)?\s+plans?\b|\bbranch\s+power\s+plans?\b|\bpower\s*(?:&|and)\s*systems?\s+plans?\b/i;

export function isPlanTitleText(text) {
  const blob = String(text || "");
  if (DETAIL_RE.test(blob) || ONELINE_RE.test(blob)) return false;
  return LIGHTING_PLAN_TITLE_RE.test(blob)
    || POWER_PLAN_TITLE_RE.test(blob)
    || PLAN_TITLE_RE.test(blob)
    || SITE_ELECTRICAL_PLAN_RE.test(blob);
}

export function isIndexText(text) {
  const blob = String(text || "");
  if (INDEX_RE.test(blob)) return true;
  // Real floor plans cite many panel/room/sheet IDs. Only treat a bare ID
  // list as an index when the page is not already a lighting/power plan.
  if (isPlanTitleText(blob)) return false;
  const ids = blob.match(/\b[A-Z]{1,3}[- ]?\d{1,2}[.-]\d{2}[A-Z]?\b|\b[A-Z]{1,3}\d{3,4}[A-Z]?\b/gi) || [];
  return new Set(ids.map((id) => id.toUpperCase().replace(/[\s-]/g, ""))).size >= 8;
}

export function isCoverOrRenderingText(text) {
  const blob = String(text || "");
  if (isPlanTitleText(blob) || isIndexText(blob)) return false;
  if (RENDERING_RE.test(blob)) return true;
  if (COVER_SHEET_RE.test(blob)) return true;
  if (COVERPLATE_RE.test(blob)) return false;
  return false;
}

export function pageTextBlob(page) {
  return [page?.title, page?.sheetId, ...(page?.tokens || []).map((token) => token.text)].filter(Boolean).join(" ");
}

export function looksLikeIndexPage(page) {
  if (!page) return false;
  if (page.kind === "index") return true;
  return isIndexText(pageTextBlob(page));
}

export function looksLikeCoverOrRendering(page) {
  if (!page) return false;
  if (/^(cover|rendering|photo|title)$/i.test(String(page.kind || ""))) return true;
  return isCoverOrRenderingText(pageTextBlob(page));
}

export function looksLikeElectricalPlan(page) {
  if (!page) return false;
  if (looksLikeCoverOrRendering(page) || looksLikeIndexPage(page)) return false;
  const blob = pageTextBlob(page);
  if (COMCHECK_RE.test(blob) && !isPlanTitleText(blob)) return false;
  const electricalNamed = LIGHTING_PLAN_TITLE_RE.test(blob)
    || POWER_PLAN_TITLE_RE.test(blob)
    || SITE_ELECTRICAL_PLAN_RE.test(blob)
    || /\belectrical\s+(?:lighting|power|site)\b/i.test(blob);
  if (electricalNamed && !isIndexText(blob)) return true;
  const id = String(page.sheetId || "").toUpperCase();
  if (electricalSheetLooksLikePlan(id)) {
    if (STRONG_LEGEND_TITLE_RE.test(blob) && !isPlanTitleText(blob)) return false;
    if (/\b(?:diagrams?\s*(?:&|and)\s*schedules?|panelboard\s+schedules?)\b/i.test(blob) && !isPlanTitleText(blob)) return false;
    return true;
  }
  return false;
}

export function classifyPageText(text) {
  const blob = String(text || "");
  if (isIndexText(blob)) return "index";
  if (COMCHECK_RE.test(blob) && !isPlanTitleText(blob)) return "spec";
  if (isCoverOrRenderingText(blob)) return "cover";
  if (STRONG_LEGEND_TITLE_RE.test(blob) && !isPlanTitleText(blob)) return "legend";
  // Real plan sheets often carry fixture/equipment schedules in a side panel.
  // The plan title must win over schedule text or AI skips the entire floor plan.
  if (isPlanTitleText(blob) && !isIndexText(blob)) return "drawing";
  if (LIGHTING_SCHED_RE.test(blob)) return "lighting-schedule";
  if (DEVICE_SCHED_RE.test(blob)) return "device-schedule";
  if (EQUIP_SCHED_RE.test(blob)) return "equipment-schedule";
  if (ONELINE_RE.test(blob)) return "oneline";
  if (DETAIL_RE.test(blob)) return "detail";
  if (LEGEND_RE.test(blob)) return "legend";
  if (SPEC_RE.test(blob)) return "spec";
  return "other";
}

export function classifyPageItems(items = [], viewport = {}) {
  const width = Number(viewport?.width) || 1;
  const height = Number(viewport?.height) || 1;
  const full = (items || []).map((item) => String(item.str || "").trim()).filter(Boolean).join("\n");
  const titleBlock = (items || [])
    .filter((item) => (Number(item.x) || 0) >= width * 0.58 && (Number(item.y) || 0) >= height * 0.62)
    .map((item) => String(item.str || "").trim()).filter(Boolean).join(" ");
  if (isIndexText(titleBlock) || isIndexText(full)) return "index";
  if (isCoverOrRenderingText(titleBlock) && !isPlanTitleText(titleBlock)) return "cover";
  if (COMCHECK_RE.test(titleBlock) || (COMCHECK_RE.test(full) && !isPlanTitleText(titleBlock))) return "spec";
  if (STRONG_LEGEND_TITLE_RE.test(titleBlock) && !isPlanTitleText(titleBlock)) return "legend";
  if (isPlanTitleText(titleBlock)) return "drawing";
  return classifyPageText(full);
}

export function inferPlanType(items = [], viewport = {}) {
  const width = Number(viewport?.width) || 1;
  const height = Number(viewport?.height) || 1;
  const titleBlock = (items || [])
    .filter((item) => (Number(item.x) || 0) >= width * 0.5 && (Number(item.y) || 0) >= height * 0.58)
    .map((item) => String(item.str || "").trim()).filter(Boolean).join(" ");
  if (LIGHTING_PLAN_TITLE_RE.test(titleBlock)) return "lighting";
  if (POWER_PLAN_TITLE_RE.test(titleBlock)) return "power";
  const full = (items || []).map((item) => String(item.str || "").trim()).filter(Boolean).join(" ");
  if (LIGHTING_PLAN_TITLE_RE.test(full)) return "lighting";
  if (POWER_PLAN_TITLE_RE.test(full)) return "power";
  return "";
}

export function pagePlanType(page) {
  if (page?.planType) return String(page.planType);
  const blob = [page?.title, page?.sheetId, ...(page?.tokens || []).map((token) => token.text)].filter(Boolean).join(" ");
  if (LIGHTING_PLAN_TITLE_RE.test(blob)) return "lighting";
  if (POWER_PLAN_TITLE_RE.test(blob)) return "power";
  return "";
}

export function clusterTextRows(items, yTolerance = 3.5) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const item of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - item.y) <= yTolerance) {
      last.cells.push(item);
    } else {
      rows.push({ y: item.y, cells: [item] });
    }
  }
  return rows.map((row) => {
    const cells = [...row.cells].sort((a, b) => a.x - b.x);
    return {
      y: row.y,
      text: cells.map((cell) => cell.str.trim()).filter(Boolean).join(" "),
      tokens: cells.map((cell) => cell.str.trim()).filter(Boolean),
    };
  }).filter((row) => row.text);
}

export function parseLegendRows(rows, options = {}) {
  const symbols = [];
  const hasQtyColumn = Boolean(options.hasQtyColumn || (rows || []).some((row) => /\bqty\b|\bquantity\b/i.test(row.text || "")));
  for (const row of rows) {
    const tokens = row.tokens;
    if (tokens.length < 2) continue;
    const abbr = tokens[0];
    if (SKIP.test(abbr) || abbr.length > 12) continue;
    const label = tokens.slice(1).join(" ").replace(/\s+/g, " ").trim();
    if (label.length < 4 || SKIP.test(label)) continue;
    const scheduleQty = scheduleQuantityFromTokens(tokens, { hasQtyColumn, kind: "legend" });
    symbols.push({
      id: `legend:${slug(abbr)}:${slug(label).slice(0, 40)}`,
      category: guessCategory(label),
      drawingCategory: "From drawing",
      label,
      abbr: abbr.slice(0, 10),
      source: "legend",
      ...(scheduleQty != null ? { scheduleQty } : {}),
    });
  }
  return uniqueById(symbols);
}

const VOLTAGE = new Set(["120", "208", "240", "277", "347", "480", "600"]);

export function scheduleQuantityFromTokens(tokens = [], options = {}) {
  const list = (tokens || []).map((token) => String(token || "").trim()).filter(Boolean);
  const qtyIndex = list.findIndex((token) => /^(qty|quantity)$/i.test(token));
  if (qtyIndex >= 0) {
    const parsed = parsePrintedQty(list[qtyIndex + 1]);
    if (parsed != null) return parsed;
  }
  if (!options.hasQtyColumn && options.kind !== "legend") return null;
  return parsePrintedQty(list[list.length - 1]);
}

function parsePrintedQty(text) {
  const raw = String(text || "").trim();
  if (!/^\d{1,3}$/.test(raw)) return null;
  if (VOLTAGE.has(raw)) return null;
  const value = Number(raw);
  if (value < 1 || value > 500) return null;
  return value;
}

export function parseScheduleRows(rows, source, options = {}) {
  const items = [];
  const hasQtyColumn = Boolean(options.hasQtyColumn || (rows || []).some((row) => /\bqty\b|\bquantity\b/i.test(row.text || "")));
  for (const row of rows) {
    const tokens = row.tokens;
    if (!tokens.length) continue;
    let type = "";
    let rest = tokens;
    const first = tokens[0].replace(/\.$/, "").replace(/^['"‘’“”`]+|['"‘’“”`]+$/g, "");
    const typed = first.match(TYPE_RE);
    if (typed && !SKIP.test(first)) {
      type = typed[1].toUpperCase();
      rest = tokens.slice(1);
    } else if (/^type$/i.test(tokens[0]) && tokens[1] && TYPE_RE.test(tokens[1])) {
      type = tokens[1].toUpperCase();
      rest = tokens.slice(2);
    }
    if (!type) continue;
    const label = rest.join(" ").replace(/\s+/g, " ").trim();
    if (!label || SKIP.test(label) || label.length < 3) continue;
    const scheduleQty = scheduleQuantityFromTokens(tokens, { hasQtyColumn, kind: options.kind || source });
    items.push({
      id: `sched:${source}:${type}:${slug(label).slice(0, 40)}`,
      category: guessCategory(label) || (source === "equipment-schedule" ? "Equipment" : source === "device-schedule" ? "Receptacles" : "Lighting"),
      drawingCategory: "From drawing",
      label: `Type ${type} — ${label}`,
      abbr: type,
      type,
      source,
      ...(scheduleQty != null ? { scheduleQty } : {}),
    });
  }
  return uniqueById(items);
}

export async function extractPdfPage(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const items = (content.items || []).map((item) => ({
    str: String(item.str || ""),
    x: item.transform?.[4] ?? 0,
    y: viewport.height - (item.transform?.[5] ?? 0),
    w: item.width || 0,
  })).filter((item) => item.str.trim());
  return { items, viewport };
}

export async function extractPdfPageItems(pdf, pageNumber) {
  const { items } = await extractPdfPage(pdf, pageNumber);
  return items;
}

export async function readDrawingDocuments(fileBytes) {
  const empty = { pages: [], symbols: [], scheduleItems: [], notes: [], titleBlock: null };
  if (!fileBytes) return empty;
  const { getPdfDocument } = await import("@/lib/pdf-document");
  const { parseTitleBlock, titleBlockRowsFromItems } = await import("@/domain/estimate/fromDrawings");
  const pdf = await getPdfDocument(fileBytes);
  const pages = [];
  const symbols = [];
  const scheduleItems = [];
  const notes = [];
  const titleParts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const { items, viewport } = await extractPdfPage(pdf, pageNumber);
    const rows = clusterTextRows(items);
    const text = rows.map((row) => row.text).join("\n");
    const kind = classifyPageItems(items, viewport);
    pages.push({ page: pageNumber, kind, textLength: text.length, text, widthPt: viewport.width, heightPt: viewport.height, printedScale: parsePrintedScale(text) });
    const titleRows = titleBlockRowsFromItems(items, viewport);
    const titleText = titleRows.join("\n");
    if (pageNumber <= 3 || /title\s+sheet|cover\s+sheet/i.test(text) || /title\s+sheet|cover\s+sheet/i.test(titleText)) {
      if (titleText.trim()) titleParts.push(titleText);
    }

    if (kind === "drawing") continue;
    if (items.length < 3 || text.trim().length < 12) {
      notes.push(`Sheet ${pageNumber} looks like a ${kind.replaceAll("-", " ")} but has no extractable text layer. Type devices in manually — Estim8r will not invent them.`);
      continue;
    }
    if (kind === "legend") symbols.push(...parseLegendRows(rows, { hasQtyColumn: rows.some((row) => /\bqty\b|\bquantity\b/i.test(row.text)) }).map((item) => ({ ...item, page: pageNumber })));
    if (kind === "lighting-schedule" || kind === "device-schedule" || kind === "equipment-schedule" || kind === "spec") {
      scheduleItems.push(...parseScheduleRows(rows, kind).map((item) => ({ ...item, page: pageNumber })));
      if (kind === "spec" || kind === "legend") {
        symbols.push(...parseLegendRows(rows).map((item) => ({ ...item, page: pageNumber })));
      }
    }
  }

  return {
    pages,
    symbols: uniqueById(symbols),
    scheduleItems: uniqueById(scheduleItems),
    notes,
    titleBlock: parseTitleBlock(titleParts.join("\n\n")),
  };
}

export function drawingSymbolsFromDocs(docs) {
  const fromLegend = docs?.symbols || [];
  const fromSched = (docs?.scheduleItems || []).map((item) => ({
    id: item.id,
    category: item.drawingCategory || "From drawing",
    takeoffCategory: item.category,
    label: item.label,
    abbr: item.abbr,
    source: item.source,
    page: item.page,
  }));
  return uniqueById([
    ...fromLegend.map((item) => ({
      ...item,
      category: item.drawingCategory || "From drawing",
      takeoffCategory: item.category,
    })),
    ...fromSched,
  ]);
}

function guessCategory(label) {
  const text = label.toLowerCase();
  if (/water closet|\burinal\b|lavatory|\bsink\b|floor drain|cleanout|hose bibb|plumbing/.test(text)) return "Plumbing";
  if (/\bahu\b|vav box|boiler|chiller|\bpump\b|mechanical/.test(text)) return "Mechanical";
  if (/manhole|catch basin|storm inlet|\bcurb\b|paving/.test(text)) return "Civil";
  if (/\bcolumn\b|footing|\bbrace\b|grid line/.test(text)) return "Structural";
  if (/recept|outlet|gfci|duplex|twist/.test(text)) return "Receptacles";
  if (/light|fixture|troffer|luminaire|exit|emerg|pole|flood|pendant|can /.test(text)) return "Lighting";
  if (/switch|dimmer|occup|sensor|photocell/.test(text)) return "Switches";
  if (/panel|transformer|switchboard|mcc|ats|generator/.test(text)) return "Panels / MCC";
  if (/conduit|emt|imc|raceway|tray/.test(text)) return "Raceway";
  if (/fire|smoke|strobe|horn|pull/.test(text)) return "Fire Alarm";
  if (/data|voice|camera|wap|speaker/.test(text)) return "Low Voltage";
  if (/hvac|condensing|fan-coil|unit heater/.test(text)) return "HVAC";
  if (/\b(?:vent|exhaust)\s*fans?\b/.test(text)) return "Equipment";
  if (/motor|junction|pull box|equipment connection/.test(text)) return "Equipment";
  return "";
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueById(list) {
  const seen = new Set();
  return list.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
