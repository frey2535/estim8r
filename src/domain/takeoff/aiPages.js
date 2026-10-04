import { classifyPageItems, inferPlanType, extractPdfPageItems } from "./drawing-docs";
import { extractPageSymbolPaths } from "./pdfPaths";
import { classifySheetDiscipline, findSheetId, parseSheetId } from "./sheetDiscipline";
import { getPdfDocument } from "@/lib/pdf-document";
import { extractRasterSymbolCandidates, hydrateRasterPaths } from "./rasterSymbols";

export async function readAiPages(fileBytes) {
  const pdf = await getPdfDocument(fileBytes);
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
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
    // Live PDF.js pages extract real raster blobs here. Node tests inject
    // rasterPaths/rasterCandidates on the page record instead.
    let rasterPaths = [];
    try {
      rasterPaths = await extractRasterSymbolCandidates(page);
      recorded.rasterPaths = rasterPaths;
      await hydrateRasterPaths(recorded);
      rasterPaths = recorded.rasterPaths || rasterPaths;
    } catch {
      rasterPaths = [];
    }
    recorded.paths = [...paths, ...rasterPaths];
    recorded.rasterPaths = rasterPaths;
    pages.push(recorded);
  }
  return pages;
}
