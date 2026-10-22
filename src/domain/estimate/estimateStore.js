import {
  ACTIVE_ESTIMATE_KEY,
  WAGE_BOOK_KEY,
  estimateStorageKey,
  syncEstimateDraft,
} from "./fromTakeoff.js";
import { LABOR_RATES_KEY, defaultLaborRates, ratesToWageBook, resolveShopRates } from "../labor/rates.js";
import { makeEstimateId } from "./projectDocuments.js";

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readWageBook() {
  return readShopWageBook();
}

export function readShopWageBook() {
  return ratesToWageBook(resolveShopRates(readJson(LABOR_RATES_KEY) || [], readJson(WAGE_BOOK_KEY) || {}));
}

/**
 * @param {any} crew
 */
export function writeWageBook(crew) {
  const book = {};
  for (const row of crew || []) book[row.id] = Number(row.wage) || 0;
  try {
    localStorage.setItem(WAGE_BOOK_KEY, JSON.stringify(book));
    localStorage.setItem(LABOR_RATES_KEY, JSON.stringify(defaultLaborRates(book)));
  } catch {
    /* private mode */
  }
  return book;
}

/**
 * @param {any} crew
 */
export function persistShopWageBook(crew) {
  return writeWageBook(crew);
}

/**
 * @param {any} fileName
 * @param {any} fileSize
 */
export function readEstimate(fileName, fileSize) {
  return readJson(estimateStorageKey(fileName, fileSize));
}

export function readActiveEstimate() {
  const key = localStorage.getItem(ACTIVE_ESTIMATE_KEY);
  if (!key) return null;
  return readJson(key);
}

export function startNewEstimate() {
  try {
    localStorage.removeItem(ACTIVE_ESTIMATE_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * Open a saved estimate, or clear the last one so New Estimate is a blank template.
 * @param {Record<string, any>} options
 */
export function openEstimateSession({ fileName, fileSize } = {}) {
  if (fileName) {
    const stored = activateEstimate(fileName, fileSize) || readEstimate(fileName, fileSize);
    if (stored) return stored;
  }
  startNewEstimate();
  return null;
}

/**
 * @param {any} fileName
 * @param {any} fileSize
 */
export function activateEstimate(fileName, fileSize) {
  const key = estimateStorageKey(fileName, fileSize);
  const stored = readJson(key);
  if (!stored) return null;
  localStorage.setItem(ACTIVE_ESTIMATE_KEY, key);
  return stored;
}

/**
 * @param {any} fileName
 * @param {any} fileSize
 */
export function deleteStoredEstimate(fileName, fileSize) {
  const key = estimateStorageKey(fileName, fileSize);
  localStorage.removeItem(key);
  if (localStorage.getItem(ACTIVE_ESTIMATE_KEY) === key) localStorage.removeItem(ACTIVE_ESTIMATE_KEY);
}

/**
 * @param {any} draft
 */
export function writeEstimate(draft) {
  const existing = readEstimate(draft.fileName, draft.fileSize) || {};
  const next = {
    ...existing,
    ...draft,
    id: draft.id || existing.id || makeEstimateId(),
    buildrSync: draft.buildrSync || existing.buildrSync || null,
  };
  const key = estimateStorageKey(next.fileName, next.fileSize);
  localStorage.setItem(key, JSON.stringify(next));
  localStorage.setItem(ACTIVE_ESTIMATE_KEY, key);
  return next;
}

export const LIVE_ESTIMATE_KEY = "estim8r.liveEstimate.v1";
export const RESTORE_JOB_KEY = "estim8r.restoreAfterRefresh";

export function consumeRestoreJobRoute() {
  try {
    const route = sessionStorage.getItem(RESTORE_JOB_KEY) || "";
    if (route) sessionStorage.removeItem(RESTORE_JOB_KEY);
    return route;
  } catch {
    return "";
  }
}

/** In-session snapshot so Refresh can restore an unsaved / unnamed open estimate. */
export function writeLiveEstimateDraft(draft) {
  try {
    if (!draft) return;
    sessionStorage.setItem(LIVE_ESTIMATE_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    /* private mode */
  }
}

export function readLiveEstimateDraft() {
  try {
    const raw = sessionStorage.getItem(LIVE_ESTIMATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLiveEstimateDraft() {
  try {
    sessionStorage.removeItem(LIVE_ESTIMATE_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * Copies takeoff quantities into the estimate. Never writes the takeoff sheet.
 * @param {any} [options]
 */
export function syncStoredEstimate(options = {}) {
  const {
    fileName,
    fileSize,
    drawingDocs,
    rollup,
    pageCount,
    markup,
    marks = [],
    runs = [],
    pageKinds = {},
  } = options;
  const existing = readEstimate(fileName, fileSize);
  const draft = syncEstimateDraft(existing, {
    fileName,
    fileSize,
    drawingDocs,
    rollup,
    pageCount,
    markup,
    wageBook: readShopWageBook(),
    marks,
    runs,
    pageKinds,
  });
  return writeEstimate(draft);
}
