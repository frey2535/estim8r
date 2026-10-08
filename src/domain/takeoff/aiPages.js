import { classifyPageItems, inferPlanType, extractPdfPageItems, looksLikeCoverOrRendering, looksLikeIndexPage } from "./drawing-docs";
import { extractPageSymbolPaths } from "./pdfPaths";
import { classifySheetDiscipline, findSheetId, parseSheetId } from "./sheetDiscipline";
import { getPdfDocument } from "@/lib/pdf-document";
import { extractRasterSymbolCandidates, hydrateRasterPaths } from "./rasterSymbols";
import { isNonPlanSheetKind } from "./symbolDetection.js";

function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function shouldExtractRaster(recorded) {
  if (!recorded) return false;
  if (looksLikeCoverOrRendering(recorded) || looksLikeIndexPage(recorded)) return false;
  if (isNonPlanSheetKind(recorded.kind) || recorded.kind === "spec") return false;
  return true;
}

export async function readAiPages(fileBytes, options = {}) {
  const includeRaster = options.includeRaster === true;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const pdf = await getPdfDocument(fileBytes);
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.(pageNumber, pdf.numPages);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const items = await extractPdfPageItems(pdf, pageNumber);
    const tokens = items.map((item) => ({
      text: item.str.trim(),
      x: viewport.width ? (item.x / viewport.width) * 100 : 0,
      y: viewport.height ? (item.y / viewport.height) * 100 : 0,
    })).filter((item) => item.text);
    const text = tokens.map((item) => item.text).join("\n");
    const kind = classifyPageItems(items, viewport);
    const planType = inferPlanType(items, viewport);
    const sheetId = findSheetId(tokens) || parseSheetId(text);
    const discipline = classifySheetDiscipline(text, tokens);
    let paths = [];
    try { paths = await extractPageSymbolPaths(page); } catch { paths = []; }
    const recorded = {
      page: pageNumber,
      kind,
      tokens,
      sheetId,
      discipline,
      planType,
      paths,
      pdfPage: page,
      rasterPaths: [],
    };
    // Raster blobs stay on rasterPaths. Merging them into paths made the
    // geometry-first scan O(paths × legend × prototypes) hang on real CAD PDFs.
    if (includeRaster && shouldExtractRaster(recorded)) {
      try {
        const rasterPaths = await extractRasterSymbolCandidates(page);
        recorded.rasterPaths = rasterPaths;
        await hydrateRasterPaths(recorded);
        recorded.rasterPaths = recorded.rasterPaths || rasterPaths;
      } catch {
        recorded.rasterPaths = [];
      }
    }
    pages.push(recorded);
    await yieldToUi();
  }
  return pages;
}
