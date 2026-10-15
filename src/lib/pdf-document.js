import { getDocument } from "pdfjs-dist";

const cache = new WeakMap();

export function getPdfDocument(fileBytes) {
  if (!fileBytes) return Promise.reject(new Error("No PDF data"));
  const hit = cache.get(fileBytes);
  if (hit) return hit;
  const promise = getDocument({
    data: new Uint8Array(fileBytes.slice(0)),
    disableAutoFetch: true,
    disableStream: true,\n    wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,\n    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
  }).promise;
  cache.set(fileBytes, promise);
  return promise;
}
