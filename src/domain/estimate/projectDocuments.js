import { buildReviewMarkupPages } from "../takeoff/markupPages.js";
import { includedLines } from "./presentation.js";
import { estimateLineHours, estimateLineLaborCost } from "./manualLineLabor.js";

export const PROJECT_FOLDER_INDEX_KEY = "estim8r.projectDocs.v1";

export function projectFolderKey(projectName) {
  return String(projectName || "").trim().toLowerCase();
}

export function takeoffStorageKey(fileName, fileSize) {
  return `estim8r.takeoff.v1:${fileName || "drawing"}:${fileSize || 0}`;
}

export function matchProjectByName(projects, projectName) {
  const key = projectFolderKey(projectName);
  if (!key) return null;
  return (projects || []).find((project) => projectFolderKey(project.name) === key) || null;
}

/**
 * @param {any[]} projects
 * @param {{ projectId?: any, projectName?: any, projectAddress?: any }} [options]
 */
export function matchCompanyProject(projects, { projectId, projectName, projectAddress } = {}) {
  const rows = projects || [];
  const id = String(projectId || "").trim();
  if (id) {
    const byId = rows.find((project) => project.id === id);
    if (byId) return byId;
  }
  const byName = matchProjectByName(rows, projectName);
  if (byName) return byName;
  const address = String(projectAddress || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!address) return null;
  const matches = rows.filter((project) => (
    String(project.address || "").trim().toLowerCase().replace(/\s+/g, " ") === address
  ));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * @param {{
 *   canUseBuildr?: any,
 *   matchingProject?: any,
 *   existingProjectId?: any,
 *   accountError?: any,
 * }} [options]
 */
export function decideSaveDestination({
  canUseBuildr,
  matchingProject,
  existingProjectId,
  accountError,
} = {}) {
  if (existingProjectId && !accountError) {
    return { action: "buildr", project: matchingProject || { id: existingProjectId } };
  }
  if (matchingProject && canUseBuildr) {
    return { action: "buildr", project: matchingProject };
  }
  if (canUseBuildr && !matchingProject && !accountError) {
    return { action: "prompt" };
  }
  if (accountError) {
    return {
      action: "local",
      warning: `Could not reach Buildr: ${accountError}`,
    };
  }
  return { action: "local" };
}

export const ESTIM8R_ID_NOTE = "Estim8r-id:";

export function makeEstimateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `est_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function estim8rInvoiceNote(estimateId, extra) {
  return [`${ESTIM8R_ID_NOTE} ${estimateId}`, extra].filter(Boolean).join("\n");
}

export function parseEstim8rEstimateId(notes) {
  const match = String(notes || "").match(/Estim8r-id:\s*(\S+)/i);
  return match?.[1] || null;
}

/**
 * @param {any[]} invoices
 * @param {{ invoiceId?: any, estimateId?: any, invoiceNumber?: any }} [options]
 */
export function findInvoiceForEstim8r(invoices, { invoiceId, estimateId, invoiceNumber } = {}) {
  const rows = invoices || [];
  if (invoiceId) {
    const byId = rows.find((row) => row.id === invoiceId);
    if (byId) return byId;
  }
  if (estimateId) {
    const byNote = rows.find((row) => parseEstim8rEstimateId(row.notes) === estimateId);
    if (byNote) return byNote;
  }
  if (invoiceNumber) {
    return rows.find((row) => row.invoiceNumber === invoiceNumber || row.invoice_number === invoiceNumber) || null;
  }
  return null;
}

/**
 * @param {any[]} docs
 * @param {{ docType?: any, estimateId?: any, title?: any }} [options]
 */
export function findDocumentForEstim8r(docs, { docType, estimateId, title } = {}) {
  const rows = docs || [];
  if (estimateId) {
    const byNumber = rows.find((row) => row.docType === docType && row.number === estimateId);
    if (byNumber) return byNumber;
  }
  if (title) {
    return rows.find((row) => row.docType === docType && row.title === title) || null;
  }
  return null;
}

export function estimateContentFingerprint(estimate, takeoff) {
  return JSON.stringify({
    id: estimate?.id || "",
    fileName: estimate?.fileName || "",
    fileSize: estimate?.fileSize || 0,
    header: estimate?.header || {},
    lines: estimate?.lines || [],
    itemized: Boolean(estimate?.itemized),
    includeTotalsCard: Boolean(estimate?.includeTotalsCard),
    visibleTotals: estimate?.visibleTotals || null,
    overhead: estimate?.overhead,
    profit: estimate?.profit,
    materialMarkup: estimate?.materialMarkup,
    crew: estimate?.crew || [],
    factors: estimate?.factors || [],
    marks: takeoff?.marks || [],
    calibration: takeoff?.calibration || null,
    pageCount: takeoff?.pageCount || takeoff?.sheet || 1,
  });
}

export function buildrSyncFromResult(result, estimateId) {
  const documents = {};
  for (const doc of result?.documents || []) {
    if (doc?.doc_type) documents[doc.doc_type] = doc.id;
  }
  return {
    estimateId,
    projectId: result?.project?.id || null,
    invoiceId: result?.invoice?.id || null,
    documents,
  };
}

/**
 * @param {{
 *   fileName?: any,
 *   pageCount?: any,
 *   marks?: any,
 *   calibration?: any,
 *   titleBlock?: any,
 *   reconciliation?: any,
 *   skippedSheets?: any,
 * }} args
 */
export function buildMarkupPages({ fileName, pageCount, marks, calibration, titleBlock, reconciliation, skippedSheets }) {
  const count = Math.max(1, Number(pageCount) || 1);
  const pages = [];
  for (let page = 1; page <= count; page += 1) {
    pages.push({
      page,
      marks: (marks || []).filter((mark) => (mark.sheet || 1) === page),
    });
  }
  const markup = {
    version: 1,
    kind: "markup-pages",
    fileName: fileName || "",
    calibration: calibration || null,
    pages,
  };
  if (titleBlock && typeof titleBlock === "object") markup.titleBlock = titleBlock;
  markup.reviewPages = buildReviewMarkupPages({ marks, reconciliation, skippedSheets });
  return markup;
}

export function writeTakeoffSession(fileName, fileSize, session) {
  const payload = session && typeof session === "object" ? session : {};
  localStorage.setItem(takeoffStorageKey(fileName, fileSize), JSON.stringify(payload));
  return payload;
}

export function deleteProjectFolder(folder) {
  const id = folder?.id || projectFolderKey(folder?.projectName);
  const folders = readFolderIndex().filter((item) => item.id !== id);
  writeFolderIndex(folders);
  return folders;
}

export function readTakeoffSession(fileName, fileSize) {
  try {
    const raw = localStorage.getItem(takeoffStorageKey(fileName, fileSize));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readFolderIndex() {
  try {
    const raw = localStorage.getItem(PROJECT_FOLDER_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFolderIndex(folders) {
  localStorage.setItem(PROJECT_FOLDER_INDEX_KEY, JSON.stringify(folders));
  return folders;
}

export function listProjectFolders() {
  return readFolderIndex()
    .slice()
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function upsertProjectFolder(folder) {
  const key = projectFolderKey(folder.projectName);
  if (!key) throw new Error("A project name is required to save documents.");
  const now = new Date().toISOString();
  const next = {
    id: folder.id || key,
    projectName: String(folder.projectName).trim(),
    projectAddress: String(folder.projectAddress || "").trim(),
    fileName: folder.fileName || "",
    fileSize: folder.fileSize || 0,
    savedTo: folder.savedTo || "estim8r",
    buildrProjectId: folder.buildrProjectId || null,
    drawingName: folder.drawingName || folder.fileName || "",
    estimateName: folder.estimateName || `${String(folder.projectName).trim()}-estimate.json`,
    markupName: folder.markupName || `${String(folder.projectName).trim()}-markup-pages.json`,
    createdAt: folder.createdAt || now,
    updatedAt: now,
  };
  const folders = readFolderIndex();
  const index = folders.findIndex((item) => projectFolderKey(item.projectName) === key);
  if (index >= 0) folders[index] = { ...folders[index], ...next, createdAt: folders[index].createdAt || next.createdAt };
  else folders.unshift(next);
  writeFolderIndex(folders);
  return index >= 0 ? folders[index] : next;
}

const DRAWING_DB = "estim8r-project-docs";
const DRAWING_STORE = "files";

function drawingRecordKey(fileName, fileSize) {
  return `${fileName || "drawing"}:${fileSize || 0}`;
}

function openDrawingDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAWING_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAWING_STORE)) db.createObjectStore(DRAWING_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open Estim8r document storage."));
  });
}

export async function putDrawingFile(file) {
  if (!file || typeof indexedDB === "undefined") return null;
  const db = await openDrawingDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DRAWING_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(DRAWING_STORE).put(file, drawingRecordKey(file.name, file.size));
  });
  db.close();
  return drawingRecordKey(file.name, file.size);
}

export async function getDrawingFile(fileName, fileSize) {
  if (!fileName || typeof indexedDB === "undefined") return null;
  const db = await openDrawingDb();
  const file = await new Promise((resolve, reject) => {
    const tx = db.transaction(DRAWING_STORE, "readonly");
    const request = tx.objectStore(DRAWING_STORE).get(drawingRecordKey(fileName, fileSize));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return file || null;
}

export async function deleteDrawingFile(fileName, fileSize) {
  if (!fileName || typeof indexedDB === "undefined") return null;
  const db = await openDrawingDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DRAWING_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(DRAWING_STORE).delete(drawingRecordKey(fileName, fileSize));
  });
  db.close();
  return drawingRecordKey(fileName, fileSize);
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function estimateTotals(estimate) {
  const lines = includedLines(estimate);
  return lines.reduce((acc, line) => {
    const qty = Number(line.quantity) || 0;
    acc.material += qty * (Number(line.materialUnitCost) || 0);
    acc.hours += estimateLineHours(line);
    acc.labor += estimateLineLaborCost(line);
    return acc;
  }, { material: 0, hours: 0, labor: 0 });
}

export function estimateGrandTotal(estimate) {
  const totals = estimateTotals(estimate);
  const materialMarkup = totals.material * ((Number(estimate?.materialMarkup) || 0) / 100);
  const material = totals.material + materialMarkup;
  const direct = material + totals.labor;
  const contingency = direct * ((Number(estimate?.contingency) || 0) / 100);
  const overheadBase = direct + contingency;
  const overhead = overheadBase * ((Number(estimate?.overhead) || 0) / 100);
  const profitBase = overheadBase + overhead;
  const profit = profitBase * ((Number(estimate?.profit) || 0) / 100);
  const bondBase = profitBase + profit;
  const bondInsurance = bondBase * ((Number(estimate?.bondInsurance) || 0) / 100);
  return {
    ...totals,
    material,
    materialMarkup,
    direct,
    contingency,
    overhead,
    profit,
    bondInsurance,
    total: bondBase + bondInsurance,
  };
}

export const STANDALONE_ESTIMATE_PREFIX = "standalone:";

export function isDrawingFileName(fileName) {
  const name = String(fileName || "").trim();
  return Boolean(name) && !name.startsWith(STANDALONE_ESTIMATE_PREFIX);
}

export function standaloneEstimateFileName(projectName) {
  const key = projectFolderKey(projectName);
  return key ? `${STANDALONE_ESTIMATE_PREFIX}${key}` : "";
}

/**
 * Storage identity for an estimate: keep a real drawing name, otherwise key by project.
 * @param {{ fileName?: any, projectName?: any }} [options]
 */
export function estimateFileNameForSave({ fileName, projectName } = {}) {
  if (isDrawingFileName(fileName)) return String(fileName).trim();
  return standaloneEstimateFileName(projectName);
}

/**
 * @param {{ projectName?: any }} [options]
 */
export function canSaveProjectDocuments({ projectName } = {}) {
  return Boolean(String(projectName || "").trim());
}

/**
 * @param {{ projectName?: any }} [options]
 */
export function saveRequiresProjectName({ projectName } = {}) {
  return canSaveProjectDocuments({ projectName }) ? "" : "Enter a project name to save this estimate.";
}

export const ESTIM8R_ESTIMATE_DOC_TYPE = "estim8r_estimate";

/**
 * @param {any[]} [documents]
 */
export function estim8rEstimateDocumentUrl(documents = []) {
  const doc = (documents || []).find((item) => (
    String(item?.doc_type || item?.docType || "") === ESTIM8R_ESTIMATE_DOC_TYPE
  ));
  return doc?.file_url || doc?.fileUrl || null;
}

/**
 * Map a Buildr company estimate row into the Dashboard folder shape.
 * @param {any} row
 */
export function folderFromBuildrEstimate(row) {
  if (!row) return null;
  const projectName = String(row.project_name || row.projectName || "Estimate").trim() || "Estimate";
  const documents = Array.isArray(row.documents) ? row.documents : [];
  const estimateId = row.estim8r_estimate_id || row.estim8rEstimateId || null;
  const projectId = row.project_id || row.projectId || null;
  const fileName = estimateFileNameForSave({ projectName });
  return {
    id: `buildr:${row.id || estimateId || projectId || projectFolderKey(projectName)}`,
    origin: "buildr",
    projectName,
    projectAddress: String(row.project_address || row.projectAddress || "").trim(),
    fileName,
    fileSize: 0,
    savedTo: "buildr",
    buildrProjectId: projectId,
    buildrInvoiceId: row.invoice_id || row.invoiceId || null,
    estim8rEstimateId: estimateId,
    estimateName: `${projectName}-estimate.json`,
    drawingName: "",
    markupName: `${projectName}-markup-pages.json`,
    documents,
    estimateFileUrl: estim8rEstimateDocumentUrl(documents),
    total: Number(row.total) || 0,
    status: String(row.status || "draft"),
    hasDrawings: Boolean(row.has_drawings ?? row.hasDrawings),
    createdAt: row.issue_date || row.issueDate || null,
    updatedAt: row.issue_date || row.issueDate || null,
  };
}

function localEstimateKeys(folder) {
  const keys = new Set();
  const projectId = String(folder?.buildrProjectId || folder?.buildrSync?.projectId || "").trim();
  const estimateId = String(
    folder?.estim8rEstimateId
    || folder?.buildrSync?.estimateId
    || folder?.id
    || "",
  ).trim();
  const nameKey = projectFolderKey(folder?.projectName);
  if (projectId) keys.add(`project:${projectId}`);
  if (estimateId && !String(estimateId).startsWith("buildr:")) keys.add(`estimate:${estimateId}`);
  if (nameKey) keys.add(`name:${nameKey}`);
  return keys;
}

function buildrEstimateKeys(row) {
  const keys = new Set();
  const projectId = String(row?.project_id || row?.projectId || "").trim();
  const estimateId = String(row?.estim8r_estimate_id || row?.estim8rEstimateId || "").trim();
  const nameKey = projectFolderKey(row?.project_name || row?.projectName);
  if (projectId) keys.add(`project:${projectId}`);
  if (estimateId) keys.add(`estimate:${estimateId}`);
  if (nameKey) keys.add(`name:${nameKey}`);
  return keys;
}

function setsIntersect(a, b) {
  for (const key of a) {
    if (b.has(key)) return true;
  }
  return false;
}

/**
 * Merge browser-local folders with Buildr company estimates.
 * Prefer a local draft when it matches a company row; otherwise show the Buildr row.
 * @param {any[]} [localFolders]
 * @param {any[]} [buildrEstimates]
 */
export function mergeEstimateFolderRows(localFolders = [], buildrEstimates = []) {
  const locals = (localFolders || []).map((folder) => ({
    ...folder,
    origin: folder?.origin === "buildr" ? "buildr" : "local",
  }));
  const claimed = new Set();
  const merged = [];

  for (const folder of locals) {
    const keys = localEstimateKeys(folder);
    for (const key of keys) claimed.add(key);
    merged.push(folder);
  }

  for (const row of buildrEstimates || []) {
    const keys = buildrEstimateKeys(row);
    if (setsIntersect(keys, claimed)) continue;
    const remote = folderFromBuildrEstimate(row);
    if (!remote) continue;
    for (const key of keys) claimed.add(key);
    merged.push(remote);
  }

  return merged.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

/**
 * Normalize a downloaded estim8r_estimate JSON into a local draft.
 * Preserves labor lines, crew, factors, and totals so reviewers can open
 * company estimates in Estim8r as well as Buildr.
 * @param {any} json
 * @param {any} [folder]
 */
export function draftFromBuildrEstimateJson(json, folder = null) {
  const source = json && typeof json === "object" ? json : {};
  const projectName = String(
    source.header?.projectName
    || folder?.projectName
    || "Estimate",
  ).trim() || "Estimate";
  const fileName = isDrawingFileName(source.fileName)
    ? String(source.fileName).trim()
    : (folder?.fileName || estimateFileNameForSave({ projectName }));
  const fileSize = Number(source.fileSize) || Number(folder?.fileSize) || 0;
  const estimateId = source.id || folder?.estim8rEstimateId || makeEstimateId();
  const priorSync = source.buildrSync && typeof source.buildrSync === "object" ? source.buildrSync : {};
  return {
    ...source,
    id: estimateId,
    fileName,
    fileSize,
    header: {
      ...(source.header || {}),
      projectName,
      projectAddress: String(
        source.header?.projectAddress
        || folder?.projectAddress
        || "",
      ).trim(),
    },
    lines: Array.isArray(source.lines) ? source.lines : [],
    crew: Array.isArray(source.crew) ? source.crew : source.crew || undefined,
    factors: Array.isArray(source.factors) ? source.factors : source.factors || undefined,
    buildrSync: {
      ...priorSync,
      estimateId: priorSync.estimateId || estimateId,
      projectId: priorSync.projectId || folder?.buildrProjectId || null,
      invoiceId: priorSync.invoiceId || folder?.buildrInvoiceId || null,
      documents: priorSync.documents || {},
    },
  };
}
