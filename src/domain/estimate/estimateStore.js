import {
  ACTIVE_ESTIMATE_KEY,
  WAGE_BOOK_KEY,
  estimateStorageKey,
  syncEstimateDraft,
} from "./fromTakeoff.js";

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readWageBook() {
  return readJson(WAGE_BOOK_KEY) || {};
}

export function writeWageBook(crew) {
  const book = {};
  for (const row of crew || []) book[row.id] = Number(row.wage) || 0;
  try {
    localStorage.setItem(WAGE_BOOK_KEY, JSON.stringify(book));
  } catch {
    /* private mode */
  }
  return book;
}

export function readEstimate(fileName, fileSize) {
  return readJson(estimateStorageKey(fileName, fileSize));
}

export function readActiveEstimate() {
  const key = localStorage.getItem(ACTIVE_ESTIMATE_KEY);
  if (!key) return null;
  return readJson(key);
}

export function writeEstimate(draft) {
  const key = estimateStorageKey(draft.fileName, draft.fileSize);
  localStorage.setItem(key, JSON.stringify(draft));
  localStorage.setItem(ACTIVE_ESTIMATE_KEY, key);
  if (draft.crew) writeWageBook(draft.crew);
  return draft;
}

/** Copies takeoff quantities into the estimate. Never writes the takeoff sheet. */
export function syncStoredEstimate({ fileName, fileSize, drawingDocs, rollup, pageCount }) {
  const existing = readEstimate(fileName, fileSize);
  const draft = syncEstimateDraft(existing, {
    fileName,
    fileSize,
    drawingDocs,
    rollup,
    pageCount,
    wageBook: readWageBook(),
  });
  return writeEstimate(draft);
}
