const LEGEND_RE = /electrical\s+legend|lighting\s+legend|symbol\s+legend|\blegend\b|abbreviation/i;
const LIGHTING_SCHED_RE = /lighting\s+fixture\s+schedule|fixture\s+schedule|luminaire\s+schedule|lighting\s+schedule/i;
const DEVICE_SCHED_RE = /device\s+schedule|receptacle\s+schedule|switch\s+schedule/i;
const EQUIP_SCHED_RE = /equipment\s+schedule|mechanical\s+equipment|panel\s+schedule/i;
const SPEC_RE = /specification|general\s+notes|electrical\s+notes|abbreviations/i;
const SKIP = /^(symbol|symbols|description|type|manufacturer|model|remarks|notes|qty|quantity|mounting|voltage|watts|lamp|catalog)$/i;
const TYPE_RE = /^(?:type\s*)?([a-z]{1,3}\d{0,3}[a-z]{0,2}|\d{1,3}[a-z]{0,3})$/i;

export function classifyPageText(text) {
  const blob = String(text || "");
  if (LIGHTING_SCHED_RE.test(blob)) return "lighting-schedule";
  if (DEVICE_SCHED_RE.test(blob)) return "device-schedule";
  if (EQUIP_SCHED_RE.test(blob)) return "equipment-schedule";
  if (LEGEND_RE.test(blob)) return "legend";
  if (SPEC_RE.test(blob)) return "spec";
  return "drawing";
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

export function parseLegendRows(rows) {
  const symbols = [];
  for (const row of rows) {
    const tokens = row.tokens;
    if (tokens.length < 2) continue;
    const abbr = tokens[0];
    if (SKIP.test(abbr) || abbr.length > 12) continue;
    const label = tokens.slice(1).join(" ").replace(/\s+/g, " ").trim();
    if (label.length < 4 || SKIP.test(label)) continue;
    symbols.push({
      id: `legend:${slug(abbr)}:${slug(label).slice(0, 40)}`,
      category: guessCategory(label),
      drawingCategory: "From drawing",
      label,
      abbr: abbr.slice(0, 10),
      source: "legend",
    });
  }
  return uniqueById(symbols);
}

export function parseScheduleRows(rows, source) {
  const items = [];
  for (const row of rows) {
    const tokens = row.tokens;
    if (!tokens.length) continue;
    let type = "";
    let rest = tokens;
    const first = tokens[0].replace(/\.$/, "");
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
    items.push({
      id: `sched:${source}:${type}:${slug(label).slice(0, 40)}`,
      category: source === "equipment-schedule" ? "Equipment" : source === "device-schedule" ? "Receptacles" : "Lighting",
      drawingCategory: "From drawing",
      label: `Type ${type} — ${label}`,
      abbr: type,
      type,
      source,
    });
  }
  return uniqueById(items);
}

export async function extractPdfPageItems(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  return (content.items || []).map((item) => ({
    str: String(item.str || ""),
    x: item.transform?.[4] ?? 0,
    y: viewport.height - (item.transform?.[5] ?? 0),
    w: item.width || 0,
  })).filter((item) => item.str.trim());
}

export async function readDrawingDocuments(fileBytes) {
  const empty = { pages: [], symbols: [], scheduleItems: [], notes: [] };
  if (!fileBytes) return empty;
  const { getPdfDocument } = await import("@/lib/pdf-document");
  const pdf = await getPdfDocument(fileBytes);
  const pages = [];
  const symbols = [];
  const scheduleItems = [];
  const notes = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const items = await extractPdfPageItems(pdf, pageNumber);
    const rows = clusterTextRows(items);
    const text = rows.map((row) => row.text).join("\n");
    const kind = classifyPageText(text);
    pages.push({ page: pageNumber, kind, textLength: text.length });

    if (kind === "drawing") continue;
    if (items.length < 3 || text.trim().length < 12) {
      notes.push(`Sheet ${pageNumber} looks like a ${kind.replaceAll("-", " ")} but has no extractable text layer. Type devices in manually — Estim8r will not invent them.`);
      continue;
    }
    if (kind === "legend") symbols.push(...parseLegendRows(rows).map((item) => ({ ...item, page: pageNumber })));
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
  if (/recept|outlet|gfci|duplex|twist/.test(text)) return "Receptacles";
  if (/light|fixture|troffer|luminaire|exit|emerg|pole|flood|pendant|can /.test(text)) return "Lighting";
  if (/switch|dimmer|occup|sensor|photocell/.test(text)) return "Switches";
  if (/panel|transformer|switchboard|mcc|ats|generator/.test(text)) return "Panels / MCC";
  if (/conduit|emt|imc|raceway|tray/.test(text)) return "Raceway";
  if (/fire|smoke|strobe|horn|pull/.test(text)) return "Fire Alarm";
  if (/data|voice|camera|wap|speaker/.test(text)) return "Low Voltage";
  if (/hvac|disconnect|stat|motor starter/.test(text)) return "HVAC";
  return "Equipment";
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
