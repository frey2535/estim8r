import { chromium } from "playwright";
import fs from "node:fs";

const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5173", {waitUntil:"networkidle"});
const result = await page.evaluate(async () => {
  const pdfjs = await import("/node_modules/pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/node_modules/pdfjs-dist/build/pdf.worker.mjs";
  const [{readDrawingDocuments,drawingSymbolsFromDocs},{readAiPages},{buildAiMarks},{applyDeviceTypeColors,deviceOutline,isDeviceMark},{findConduitOption,paletteForTrade}] = await Promise.all([
    import("/src/domain/takeoff/drawing-docs.js"),
    import("/src/domain/takeoff/aiPages.js"),
    import("/src/domain/takeoff/aiTakeoff.js"),
    import("/src/domain/takeoff/deviceStyles.js"),
    import("/src/domain/takeoff/trades.js"),
  ]);
  const bytes = new Uint8Array(await (await fetch("/public-test-set.pdf")).arrayBuffer());
  const docs = await readDrawingDocuments(bytes);
  const drawingSymbols = drawingSymbolsFromDocs(docs);
  const palette = paletteForTrade("electrical", drawingSymbols);
  const pages = await readAiPages(bytes);
  const planned = buildAiMarks({pages,trade:"electrical",symbols:palette.symbols,drawingSymbols:palette.fromDrawing,maxHomeruns:8,conduit:findConduitOption("emt-3-4","electrical"),color:"#2563eb"});
  const marks=applyDeviceTypeColors((planned.marks||[]).map(m=>({...m,source:m.source||"ai",trade:m.trade||"electrical",markerSize:m.markerSize||1.45,reviewStatus:m.reviewStatus||"pending"})))
    .filter(isDeviceMark).map(m=>({...m,resolvedOutline:deviceOutline(m,m.markerSize||1.45)}));
  return {pages:pages.map(p=>({page:p.page,kind:p.kind,sheetId:p.sheetId,discipline:p.discipline,tokenCount:p.tokens?.length||0,pathCount:p.paths?.length||0})),parsedLegend:drawingSymbols,summary:planned.summary,reconciliation:planned.reconciliation||null,deviceCount:planned.deviceCount,conduitCount:planned.conduitCount,marks};
});
fs.writeFileSync("public-plan-test-result.json",JSON.stringify(result,null,2));
console.log(JSON.stringify({deviceCount:result.deviceCount,conduitCount:result.conduitCount,pages:result.pages,summary:result.summary},null,2));
await browser.close();
