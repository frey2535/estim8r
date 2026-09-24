import { classifyPageText, extractPdfPageItems } from "./drawing-docs";
import { extractPageSymbolPaths } from "./pdfPaths";
import { classifySheetDiscipline, findSheetId, parseSheetId } from "./sheetDiscipline";
import { getPdfDocument } from "@/lib/pdf-document";
import { extractRasterSymbolCandidates } from "./rasterSymbols";

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
    const kind = classifyPageText(text);
    const sheetId = findSheetId(tokens) || parseSheetId(text);
    const discipline = classifySheetDiscipline(text, tokens);
    let paths = [];
    try { paths = await extractPageSymbolPaths(page); } catch { paths = []; }
    let rasterPaths = [];
    // Scanned/image-only drawings do not expose selectable PDF vectors. Build a
    // compact-object layer from rendered pixels only when native geometry is sparse.
    if (paths.length < 8) {
      try { rasterPaths = await extractRasterSymbolCandidates(page); } catch { rasterPaths = []; }
    }
    pages.push({ page: pageNumber, kind, tokens, sheetId, discipline, paths: paths.length >= 8 ? paths : [...paths, ...rasterPaths], rasterPaths });
  }
  return pages;
}
