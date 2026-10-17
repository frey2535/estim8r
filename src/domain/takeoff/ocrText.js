export async function recognizeImage(image, createWorker) {
  if (!image || typeof createWorker !== "function") {
    return { ok: false, error: "OCR needs a page image and the Tesseract worker." };
  }
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(image);
    const text = String(result?.data?.text || "").replace(/\s+/g, " ").trim();
    return { ok: true, text, words: result?.data?.words || [] };
  } finally {
    await worker.terminate?.();
  }
}
