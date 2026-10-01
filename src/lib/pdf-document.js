import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

const cache = new WeakMap();

export function getPdfDocument(fileBytes) {
  if (!fileBytes) return Promise.reject(new Error("No PDF data"));
  const hit = cache.get(fileBytes);
  if (hit) return hit;
  const promise = getDocument({
    data: new Uint8Array(fileBytes.slice(0)),
    disableAutoFetch: true,
    disableStream: true,
  }).promise;
  cache.set(fileBytes, promise);
  return promise;
}
