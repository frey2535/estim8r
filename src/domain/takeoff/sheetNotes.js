import { pageMatchesTrade } from "./sheetDiscipline.js";

const NOTE_HEADER_RE = /^(?:general\s+|electrical\s+|drawing\s+|key\s+|sheet\s+)?notes?$/i;
const NUMBERED_NOTE_RE = /^(\d{1,2})[.)]\s*(.{6,})$/;
const SENTENCE_NOTE_RE = /^(?:provide|install|all|each|contractor|verify|coordinate|refer|mount|connect)\b/i;

function newId() {
  return globalThis.crypto?.randomUUID?.() || `note-${Math.random().toString(36).slice(2)}`;
}

function phrasesFromTokens(tokens = []) {
  const sorted = [...tokens].sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0) || (Number(a.x) || 0) - (Number(b.x) || 0));
  const lines = [];
  for (const token of sorted) {
    const text = String(token.text || "").trim();
    if (!text) continue;
    const last = lines[lines.length - 1];
    const sameLine = last && Math.abs((Number(token.y) || 0) - last.y) < 0.95
      && (Number(token.x) || 0) >= last.x - 1;
    if (sameLine) {
      last.text = `${last.text} ${text}`.replace(/\s+/g, " ").trim();
      last.parts.push(token);
    } else {
      lines.push({
        text,
        x: Number(token.x) || 0,
        y: Number(token.y) || 0,
        parts: [token],
      });
    }
  }
  return lines;
}

function isNotesSheetKind(kind) {
  const value = String(kind || "");
  if (/schedule|oneline|riser|detail/.test(value)) return false;
  return /legend|^spec$|drawing/.test(value) || !value;
}

export function isNoteMark(mark) {
  return mark?.type === "note" || mark?.type === "cloud" || mark?.tool === "markup";
}

export function extractSheetNotes(pages, trade) {
  const notes = [];
  const seen = new Set();
  for (const page of pages || []) {
    if (!isNotesSheetKind(page.kind)) continue;
    if (trade && page.kind === "drawing" && !pageMatchesTrade(page, trade)) continue;
    if (trade && page.kind !== "drawing" && !pageMatchesTrade(page, trade)) continue;
    const tokens = page.tokens || [];
    const headerTokens = tokens.filter((token) => NOTE_HEADER_RE.test(String(token.text || "").trim()));
    if (!headerTokens.length && page.kind !== "spec") continue;
    const scoped = headerTokens.length
      ? tokens.filter((token) => headerTokens.some((header) => {
        const dx = (Number(token.x) || 0) - (Number(header.x) || 0);
        const dy = (Number(token.y) || 0) - (Number(header.y) || 0);
        return dx >= -6 && dx <= 42 && dy >= -1.2 && dy <= 46;
      }))
      : tokens;
    const phrases = phrasesFromTokens(scoped);
    const headers = phrases.filter((phrase) => NOTE_HEADER_RE.test(phrase.text));
    if (!headers.length && page.kind !== "spec") continue;
    for (const phrase of phrases) {
      const numbered = String(phrase.text || "").trim().match(NUMBERED_NOTE_RE);
      const sentence = !numbered && page.kind === "spec" && SENTENCE_NOTE_RE.test(phrase.text) && phrase.text.length >= 20
        ? phrase.text
        : "";
      const text = numbered ? `${numbered[1]}. ${numbered[2].trim()}` : sentence;
      if (!text) continue;
      if (headers.length) {
        const nearHeader = headers.some((header) => {
          const dx = phrase.x - header.x;
          const dy = phrase.y - header.y;
          return dx >= -6 && dx <= 42 && dy >= -1.2 && dy <= 46;
        });
        if (!nearHeader && page.kind !== "spec") continue;
      }
      const key = `${page.page}|${text.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      notes.push({
        sheet: page.page,
        x: phrase.x,
        y: phrase.y,
        noteNumber: numbered ? Number(numbered[1]) : null,
        text,
      });
    }
  }
  return notes;
}

export function notesToMarks(notes, trade = "electrical") {
  return (notes || []).map((note) => ({
    id: newId(),
    source: "ai",
    type: "note",
    tool: "markup",
    trade,
    sheet: note.sheet || 1,
    x: Number(note.x) || 8,
    y: Number(note.y) || 16,
    text: note.text,
    symbolLabel: note.text,
    category: "Notes",
    reviewStatus: "pending",
  }));
}

export function mergeExtractedNotes(marks, pages, trade) {
  const list = marks || [];
  if (list.some((mark) => isNoteMark(mark) && mark.source === "ai")) return list;
  return [...list, ...notesToMarks(extractSheetNotes(pages, trade), trade)];
}
