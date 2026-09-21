import { classifyPageText, extractPdfPageItems } from "./drawing-docs";
import { extractPageSymbolPaths } from "./pdfPaths";
import { classifySheetDiscipline, findSheetId, parseSheetId } from "./sheetDiscipline";
import { getPdfDocument } from "@/lib/pdf-document";

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
    try {
      paths = await extractPageSymbolPaths(page);
    } catch {
      paths = [];
    }
    pages.push({ page: pageNumber, kind, tokens, sheetId, discipline, paths });
  }
  return pages;
}
