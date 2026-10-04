import { geometrySimilarity } from "./legendGeometry.js";

function boundsToCandidate(minX, minY, maxX, maxY, width, height) {
  const wPx = maxX - minX + 1;
  const hPx = maxY - minY + 1;
  const w = (wPx / width) * 100;
  const h = (hPx / height) * 100;
  const cx = ((minX + maxX + 1) / 2 / width) * 100;
  const cy = ((minY + maxY + 1) / 2 / height) * 100;
  return { cx, cy, w, h, kind: "rect", source: "raster", outline: { kind: "rect", source: "raster", w, h, points: [] } };
}

export async function extractRasterSymbolCandidates(page, options = {}) {
  if (typeof document === "undefined") return [];
  const scale = Number(options.scale) || 1.35;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  await page.render({ canvasContext: ctx, viewport }).promise;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const step = 2;
  const gw = Math.ceil(width / step);
  const gh = Math.ceil(height / step);
  const dark = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      let hits = 0;
      for (let oy = 0; oy < step && gy * step + oy < height; oy += 1) {
        for (let ox = 0; ox < step && gx * step + ox < width; ox += 1) {
          const i = ((gy * step + oy) * width + gx * step + ox) * 4;
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (data[i + 3] > 40 && lum < 150) hits += 1;
        }
      }
      if (hits) dark[gy * gw + gx] = 1;
    }
  }
  const seen = new Uint8Array(dark.length);
  const out = [];
  const neighbors = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  for (let start = 0; start < dark.length; start += 1) {
    if (!dark[start] || seen[start]) continue;
    const queue = [start]; seen[start] = 1;
    let minX=gw,maxX=0,minY=gh,maxY=0,count=0;
    for (let q=0;q<queue.length;q+=1) {
      const at=queue[q], x=at%gw, y=Math.floor(at/gw); count+=1;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const [dx,dy] of neighbors){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=gw||ny>=gh)continue;const ni=ny*gw+nx;if(dark[ni]&&!seen[ni]){seen[ni]=1;queue.push(ni);}}
    }
    const bw=(maxX-minX+1)*step,bh=(maxY-minY+1)*step;
    const long=Math.max(bw/width*100,bh/height*100), short=Math.min(bw/width*100,bh/height*100);
    if(count<3 || long<0.16 || long>3.4 || short<0.06 || long/Math.max(short,0.01)>8) continue;
    out.push(boundsToCandidate(minX*step,minY*step,Math.min(width-1,(maxX+1)*step),Math.min(height-1,(maxY+1)*step),width,height));
  }
  return out;
}

export function pdfPageFromTakeoffPage(page) {
  if (page?.pdfPage && typeof page.pdfPage.getViewport === "function") return page.pdfPage;
  if (typeof page?.getViewport === "function") return page;
  return null;
}

export function rasterCandidatesFromPage(page) {
  if (Array.isArray(page?.rasterCandidates) && page.rasterCandidates.length) return page.rasterCandidates;
  if (Array.isArray(page?.rasterPaths) && page.rasterPaths.length) return page.rasterPaths;
  return (page?.paths || []).filter((path) => path?.source === "raster" || path?.outline?.source === "raster");
}

export async function hydrateRasterPaths(page, options = {}) {
  if (!page) return [];
  if (Array.isArray(page.rasterCandidates) && page.rasterCandidates.length) return page.rasterCandidates;
  if (Array.isArray(page.rasterPaths) && page.rasterPaths.length) return page.rasterPaths;
  const pdfPage = pdfPageFromTakeoffPage(page);
  if (!pdfPage || typeof document === "undefined") return [];
  const extracted = await extractRasterSymbolCandidates(pdfPage, options);
  page.rasterPaths = extracted;
  return extracted;
}

export async function hydratePagesRaster(pages, options = {}) {
  for (const page of pages || []) await hydrateRasterPaths(page, options);
  return pages;
}

export function matchRasterToLegend(candidates, dictionary, options = {}) {
  const threshold = Number(options.threshold) || 0.72;
  const entries = (dictionary?.entries || []).filter((entry) => entry?.prototype);
  if (!entries.length) return [];
  const hits = [];
  for (const candidate of candidates || []) {
    let best = null;
    let bestScore = 0;
    let runner = 0;
    for (const entry of entries) {
      const protos = entry.prototypes?.length ? entry.prototypes : [entry.prototype];
      const score = Math.max(...protos.map((proto) => geometrySimilarity(candidate, proto) || 0));
      if (score > bestScore) {
        runner = bestScore;
        bestScore = score;
        best = entry;
      } else if (score > runner) {
        runner = score;
      }
    }
    if (!best || bestScore < threshold) continue;
    hits.push({
      geometry: {
        ...candidate,
        source: "raster",
        outline: {
          kind: candidate.kind || candidate.outline?.kind || "rect",
          source: "raster",
          w: candidate.w,
          h: candidate.h,
          r: candidate.r,
          points: candidate.points || candidate.outline?.points || [],
        },
      },
      entry: best,
      score: bestScore,
      margin: bestScore - runner,
      ambiguous: bestScore - runner < 0.045,
    });
  }
  return hits.sort((a, b) => b.score - a.score);
}
