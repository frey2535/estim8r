export const DRAWING_INPUT_ID = "estim8r-drawing-file-input";
export const DRAWING_ACCEPT = [
  "application/pdf",
  "application/x-pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/*",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
].join(",");

const HEIC_RE = /\.(heic|heif)$/i;
const DRAWING_EXT_RE = /\.(pdf|png|jpe?g|webp)$/i;

const listeners = new Set();
let pendingDrawing = null;
let pendingError = "";
let pickerOpen = false;

export function isDrawingPickerOpen() {
  return pickerOpen;
}

export function markDrawingPickerOpen() {
  pickerOpen = true;
}

export function markDrawingPickerClosed() {
  pickerOpen = false;
}

export function captureFileList(fileList) {
  if (!fileList) return null;
  if (typeof fileList.length === "number") {
    for (let i = 0; i < fileList.length; i += 1) {
      if (fileList[i]) return fileList[i];
    }
    return null;
  }
  return fileList[0] || fileList.item?.(0) || null;
}

export function drawingFileName(file) {
  const name = String(file?.name || "").trim();
  if (name) return name;
  const type = String(file?.type || "").toLowerCase();
  if (type === "application/pdf" || type === "application/x-pdf") return "drawing.pdf";
  if (type === "image/png") return "drawing.png";
  if (type === "image/webp") return "drawing.webp";
  if (type.startsWith("image/")) return "drawing.jpg";
  return "drawing";
}

export function inferDrawingMime(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type === "application/pdf" || type === "application/x-pdf") return "application/pdf";
  if (type.includes("heic") || type.includes("heif")) return type;
  if (type.startsWith("image/")) return type;
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return type;
}

export function validateDrawingFile(file) {
  if (!file) return "No drawing selected.";
  const name = drawingFileName(file);
  const type = String(file.type || "").toLowerCase();
  if (type.includes("heic") || type.includes("heif") || HEIC_RE.test(name)) {
    return "This photo format (HEIC) cannot be used as a drawing. Choose a PDF, PNG, JPG, JPEG, or WEBP.";
  }
  const typeOk = type === "application/pdf"
    || type === "application/x-pdf"
    || type.startsWith("image/");
  const extOk = DRAWING_EXT_RE.test(name);
  if (!typeOk && !extOk) {
    return "Unsupported file. Choose a PDF, PNG, JPG, JPEG, or WEBP drawing.";
  }
  if (typeof file.size === "number" && file.size === 0) {
    return "The selected file is empty or could not be read.";
  }
  return "";
}

export async function snapshotDrawingFile(file) {
  const error = validateDrawingFile(file);
  if (error) throw new Error(error);
  if (typeof file.arrayBuffer !== "function") {
    throw new Error("Estim8r could not read the selected drawing.");
  }
  const bytes = await file.arrayBuffer();
  if (!bytes?.byteLength) {
    throw new Error("The selected file is empty or could not be read.");
  }
  const name = drawingFileName(file);
  const type = inferDrawingMime(file) || "application/octet-stream";
  const copy = new File([bytes], name, {
    type,
    lastModified: file.lastModified || Date.now(),
  });
  return { file: copy, bytes };
}

export function rememberPendingDrawing(next) {
  pendingDrawing = next?.file ? next : null;
  pendingError = "";
}

export function takePendingDrawing() {
  return pendingDrawing;
}

export function clearPendingDrawing() {
  pendingDrawing = null;
  pendingError = "";
}

function notify(payload) {
  for (const listener of listeners) listener(payload);
}

export function subscribeDrawingUpload(listener) {
  listeners.add(listener);
  if (pendingDrawing?.file || pendingError) {
    listener({
      file: pendingDrawing?.file || null,
      bytes: pendingDrawing?.bytes || null,
      error: pendingError,
    });
  }
  return () => listeners.delete(listener);
}

export async function ingestDrawingFiles(fileList) {
  const picked = captureFileList(fileList);
  if (!picked) {
    return { file: null, bytes: null, error: "" };
  }
  const snap = await snapshotDrawingFile(picked);
  rememberPendingDrawing(snap);
  pendingError = "";
  notify({ file: snap.file, bytes: snap.bytes, error: "" });
  return snap;
}

export async function handleNativeDrawingChange(event) {
  const input = event?.target;
  const picked = captureFileList(input?.files);
  if (!picked) return { file: null, bytes: null, error: "" };
  try {
    const snap = await ingestDrawingFiles(input.files);
    try { if (input) input.value = ""; } catch { /* iOS may throw after a successful read */ }
    markDrawingPickerClosed();
    return snap;
  } catch (error) {
    try { if (input) input.value = ""; } catch { /* ignore */ }
    markDrawingPickerClosed();
    const message = error?.message || "Estim8r could not read the selected drawing.";
    pendingDrawing = null;
    pendingError = message;
    notify({ file: null, bytes: null, error: message });
    return { file: null, bytes: null, error: message };
  }
}

export function openSharedDrawingPicker() {
  const input = typeof document !== "undefined"
    ? document.getElementById(DRAWING_INPUT_ID)
    : null;
  if (!input) {
    const error = "Estim8r could not open the file picker.";
    pendingError = error;
    notify({ file: null, bytes: null, error });
    return false;
  }
  markDrawingPickerOpen();
  try { input.value = ""; } catch { /* ignore */ }
  input.click();
  return true;
}
