import { buildReviewMarkupPages } from "../takeoff/markupPages.js";
import { includedLines } from "./presentation.js";

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

export function decideSaveDestination({ hasBuildrAccount, canUseBuildr, matchingProject, existingProjectId }) {
  if (existingProjectId) {
    return { action: "buildr", project: matchingProject || { id: existingProjectId } };
  }
  if (matchingProject && (hasBuildrAccount || canUseBuildr)) {
    return { action: "buildr", project: matchingProject };
  }
  if (canUseBuildr && !matchingProject) {
    return { action: "prompt" };
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
    visibleTotals: estimate?.visibleTotals || null,
    overhead: estimate?.overhead,
    profit: estimate?.profit,
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

export function buildMarkupPages({ fileName, pageCount, marks, calibration, titleBlock }) {
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
  markup.reviewPages = buildReviewMarkupPages({ marks });
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
    acc.hours += qty * (Number(line.laborMhPerUnit) || 0);
    acc.labor += qty * (Number(line.laborMhPerUnit) || 0) * (Number(line.laborRate) || 0);
    return acc;
  }, { material: 0, hours: 0, labor: 0 });
}

export function estimateGrandTotal(estimate) {
  const totals = estimateTotals(estimate);
  const direct = totals.material + totals.labor;
  const contingency = direct * ((Number(estimate?.contingency) || 0) / 100);
  const overheadBase = direct + contingency;
  const overhead = overheadBase * ((Number(estimate?.overhead) || 0) / 100);
  const profitBase = overheadBase + overhead;
  const profit = profitBase * ((Number(estimate?.profit) || 0) / 100);
  const bondBase = profitBase + profit;
  const bondInsurance = bondBase * ((Number(estimate?.bondInsurance) || 0) / 100);
  return {
    ...totals,
    direct,
    contingency,
    overhead,
    profit,
    bondInsurance,
    total: bondBase + bondInsurance,
  };
}

export function canSaveProjectDocuments({ fileName, projectName }) {
  return Boolean(String(fileName || "").trim() && String(projectName || "").trim());
}
