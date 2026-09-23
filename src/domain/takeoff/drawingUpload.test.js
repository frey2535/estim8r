import {
  captureFileList,
  drawingFileName,
  inferDrawingMime,
  snapshotDrawingFile,
  validateDrawingFile,
} from "./drawingUpload.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const pdf = { name: "plan.pdf", type: "application/pdf", size: 12, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
const jpgNoType = { name: "sheet.JPG", type: "", size: 8, arrayBuffer: async () => new Uint8Array([4, 5]).buffer };
const iosPhoto = { name: "", type: "image/jpeg", size: 20, arrayBuffer: async () => new Uint8Array([9]).buffer };
const heic = { name: "IMG_1001.HEIC", type: "image/heic", size: 40 };
const empty = { name: "blank.pdf", type: "application/pdf", size: 0 };
const text = { name: "notes.txt", type: "text/plain", size: 4 };

assert(captureFileList(null) === null, "null FileList is empty");
assert(captureFileList({ 0: pdf, length: 1 }) === pdf, "captures the first FileList entry");
assert(captureFileList({ length: 0 }) === null, "empty FileList is ignored");
assert(captureFileList({ 0: null, 1: pdf, length: 2 }) === pdf, "skips empty FileList slots");

assert(drawingFileName(iosPhoto) === "drawing.jpg", "nameless iOS photos get a drawing name");
assert(drawingFileName(pdf) === "plan.pdf", "named files keep their name");
assert(inferDrawingMime(jpgNoType) === "image/jpeg", "extension fills an empty iOS MIME type");
assert(inferDrawingMime({ name: "set.pdf", type: "application/octet-stream" }) === "application/pdf", "PDF extension wins over octet-stream");

assert(validateDrawingFile(null) === "No drawing selected.", "missing file is an error");
assert(validateDrawingFile(heic).includes("HEIC"), "HEIC is rejected with a visible error");
assert(validateDrawingFile(text).includes("Unsupported file"), "non-drawings are rejected");
assert(validateDrawingFile({ name: "notes.txt", type: "application/octet-stream", size: 4 }).includes("Unsupported file"), "octet-stream text is rejected");
assert(validateDrawingFile({ name: "plan.pdf", type: "application/octet-stream", size: 12 }) === "", "octet-stream PDFs are allowed");
assert(validateDrawingFile(empty).includes("empty"), "zero-byte files are rejected");
assert(validateDrawingFile(pdf) === "", "PDFs are allowed");
assert(validateDrawingFile(jpgNoType) === "", "extension-only images are allowed");
assert(validateDrawingFile({ name: "scan", type: "application/pdf", size: 2 }) === "", "PDF MIME without extension is allowed");

const snap = await snapshotDrawingFile({
  name: "plan.pdf",
  type: "",
  size: 3,
  lastModified: 100,
  arrayBuffer: async () => new Uint8Array([10, 20, 30]).buffer,
});
assert(snap.file.name === "plan.pdf", "snapshot keeps the file name");
assert(snap.file.type === "application/pdf", "snapshot stamps a PDF MIME type");
assert(snap.bytes.byteLength === 3, "snapshot keeps the file bytes");

let failed = "";
try {
  await snapshotDrawingFile({
    name: "plan.pdf",
    type: "application/pdf",
    size: 4,
    arrayBuffer: async () => new ArrayBuffer(0),
  });
} catch (error) {
  failed = error.message;
}
assert(failed.includes("empty"), "unreadable files throw a visible error");

if (process.exitCode) {
  console.error("drawingUpload tests failed");
} else {
  console.log("drawingUpload tests ok");
}
