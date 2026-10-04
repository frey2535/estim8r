
import { pagePlanType } from "./drawing-docs.js";
import { isJunkGeometry } from "./vectorSymbols.js";
import { isPlanInterior, isPlotStampToken, normalizeTypeMark } from "./symbolDetection.js";

const CATEGORY_ALLOW = new Set(["Lighting","Receptacles","Switches","Equipment","Panels / MCC","Fire Alarm","Low Voltage","HVAC"]);

function bounds(candidate) {
  const w = Number(candidate?.w) || 0;
  const h = Number(candidate?.h) || 0;
  return { minX:(Number(candidate?.cx)||0)-w/2, maxX:(Number(candidate?.cx)||0)+w/2, minY:(Number(candidate?.cy)||0)-h/2, maxY:(Number(candidate?.cy)||0)+h/2 };
}
function gap(a,b) {
  const A=bounds(a), B=bounds(b);
  const dx=Math.max(0,Math.max(A.minX-B.maxX,B.minX-A.maxX));
  const dy=Math.max(0,Math.max(A.minY-B.maxY,B.minY-A.maxY));
  return Math.hypot(dx,dy);
}
function unionBounds(parts=[]) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of parts){const b=bounds(p);minX=Math.min(minX,b.minX);minY=Math.min(minY,b.minY);maxX=Math.max(maxX,b.maxX);maxY=Math.max(maxY,b.maxY);}
  if(!Number.isFinite(minX)) return null;
  return {minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY,cx:(minX+maxX)/2,cy:(minY+maxY)/2};
}
function normalizedPart(part, box) {
  return {
    dx: box.w ? (part.cx-box.cx)/box.w : 0,
    dy: box.h ? (part.cy-box.cy)/box.h : 0,
    w: box.w ? part.w/box.w : 0,
    h: box.h ? part.h/box.h : 0,
    kind: part.kind || "rect",
  };
}

export function isDeviceFragment(candidate) {
  if (!candidate) return false;
  const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const short = Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0);
  if (long < 0.08 || long > 0.52 || short < 0.06 || short > 0.16) return false;
  const aspect = long / (short || 1e-9);
  return aspect >= 1.28 && aspect <= 5.4;
}

export function isSlashFragment(candidate) {
  if (!isDeviceFragment(candidate)) return false;
  const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  return long <= 0.28;
}

function allowCandidate(candidate, options = {}) {
  if (!candidate) return false;
  if (!isJunkGeometry(candidate)) return true;
  return Boolean(options.allowSlash) && isDeviceFragment(candidate);
}

export function clusterSymbolGeometry(seed, candidates=[], options={}) {
  if(!seed) return null;
  const maxParts=Math.max(1,Number(options.maxParts)||12);
  const baseLong=Math.max(Number(seed.w)||0,Number(seed.h)||0,0.2);
  const joinGap=Number(options.joinGap)>0?Number(options.joinGap):Math.max(0.12,Math.min(0.52,baseLong*0.65));
  const maxSpan=Number(options.maxSpan)>0?Number(options.maxSpan):Math.max(0.65,Math.min(2.8,baseLong*3.2));
  const parts=[seed];
  let changed=true;
  while(changed && parts.length<maxParts){
    changed=false;
    const box=unionBounds(parts);
    for(const c of candidates){
      if(parts.includes(c)||!allowCandidate(c,options)) continue;
      if (options.keepSeedBody && looksLikeTroffer(seed)) continue;
      const nextBox=unionBounds([...parts,c]);
      if(Math.max(nextBox.w,nextBox.h)>maxSpan) continue;
      if(parts.some((p)=>gap(p,c)<=joinGap)){parts.push(c);changed=true;if(parts.length>=maxParts)break;}
    }
  }
  const box=unionBounds(parts);
  if(!box) return seed;
  const outlineParts=parts.map((p)=>({
    kind:p.outline?.kind||p.kind||"rect",
    source:p.outline?.source||p.source||"vector",
    cx:p.cx,cy:p.cy,w:p.w,h:p.h,r:p.r,
    points:p.outline?.points||p.points||[],
  }));
  return {
    ...seed,
    cx:box.cx,cy:box.cy,w:box.w,h:box.h,
    kind:"composite",
    source:parts.some((p)=>p.source==="raster")?"mixed":"vector",
    parts,
    outline:{kind:"composite",source:parts.some((p)=>p.source==="raster")?"mixed":"vector",w:box.w,h:box.h,parts:outlineParts},
    signature:geometrySignature({cx:box.cx,cy:box.cy,w:box.w,h:box.h,kind:"composite",parts}),
  };
}

export function geometrySignature(candidate) {
  if(!candidate) return null;
  const parts=candidate.parts?.length?candidate.parts:[candidate];
  const box=unionBounds(parts)||candidate;
  const long=Math.max(box.w||0,box.h||0), short=Math.max(0.0001,Math.min(box.w||0,box.h||0));
  const kinds={};
  for(const p of parts) kinds[p.kind||p.outline?.kind||"rect"]=(kinds[p.kind||p.outline?.kind||"rect"]||0)+1;
  return {
    aspect: long/short,
    long, short,
    partCount:parts.length,
    kinds,
    layout:parts.slice(0,12).map((p)=>normalizedPart(p,box)),
  };
}

function ratioScore(a,b){
  if(!a||!b||a<=0||b<=0)return 0;
  const r=Math.max(a,b)/Math.min(a,b);
  if(r<=1.2)return 1;if(r<=1.45)return .8;if(r<=1.8)return .55;if(r<=2.3)return .25;return 0;
}
export function geometrySimilarity(a,b){
  const A=a?.signature||geometrySignature(a), B=b?.signature||geometrySignature(b);
  if(!A||!B)return 0;
  const aspect=ratioScore(A.aspect,B.aspect);
  const size=(ratioScore(A.long,B.long)+ratioScore(A.short,B.short))/2;
  const count=Math.max(0,1-Math.abs(A.partCount-B.partCount)/Math.max(A.partCount,B.partCount,1));
  const keys=new Set([...Object.keys(A.kinds),...Object.keys(B.kinds)]);
  let kind=0,total=0;
  for(const k of keys){kind+=Math.min(A.kinds[k]||0,B.kinds[k]||0);total+=Math.max(A.kinds[k]||0,B.kinds[k]||0);}
  kind=total?kind/total:0;
  return aspect*.28+size*.28+count*.22+kind*.22;
}

export function bodySimilarity(a, b) {
  const A = a?.signature || geometrySignature(a);
  const B = b?.signature || geometrySignature(b);
  if (!A || !B) return 0;
  return (ratioScore(A.aspect, B.aspect) + ratioScore(A.long, B.long) + ratioScore(A.short, B.short)) / 3;
}

export function hatchEvidence(cluster, nearby = []) {
  const box = unionBounds(cluster?.parts?.length ? cluster.parts : (cluster ? [cluster] : [])) || cluster;
  const parts = [
    ...(cluster?.parts?.length ? cluster.parts : (cluster ? [cluster] : [])),
    ...nearby.filter((part) => {
      if (!box) return false;
      return Math.abs((part.cx || 0) - box.cx) <= (box.w || 0) / 2 + 0.04
        && Math.abs((part.cy || 0) - box.cy) <= (box.h || 0) / 2 + 0.04;
    }),
  ];
  let hatchParts = 0;
  const seen = new Set();
  for (const part of parts) {
    if (!part || seen.has(part)) continue;
    seen.add(part);
    const long = Math.max(Number(part.w) || 0, Number(part.h) || 0);
    const short = Math.min(Number(part.w) || 0, Number(part.h) || 0);
    if (long >= 0.08 && long <= 0.42 && short >= 0.07) hatchParts += 1;
  }
  return { partCount: Math.max(cluster?.parts?.length || 1, seen.size), hatchParts };
}

export function isHatchedFixture(cluster, nearby = []) {
  const evidence = hatchEvidence(cluster, nearby);
  return evidence.hatchParts >= 3 || evidence.partCount >= 4;
}

export function isEmergencyHatch(cluster, nearby = []) {
  const box = unionBounds(cluster?.parts?.length ? cluster.parts : (cluster ? [cluster] : [])) || cluster;
  if (!box) return false;
  const bodyLong = Math.max(box.w || 0, box.h || 0);
  const nested = (nearby || []).filter((part) => {
    const long = Math.max(Number(part.w) || 0, Number(part.h) || 0);
    const aspect = long / (Math.min(Number(part.w) || 0, Number(part.h) || 0) || 1e-9);
    if (long < 0.35 || long > 1.08 || long >= bodyLong * 0.95) return false;
    if (aspect < 1.45 || aspect > 2.05) return false;
    return Math.abs((part.cx || 0) - box.cx) <= (box.w || 0) / 2 + 0.02
      && Math.abs((part.cy || 0) - box.cy) <= (box.h || 0) / 2 + 0.02;
  });
  return nested.length >= 2;
}

export function looksLikeTroffer(cluster) {
  if (!cluster) return false;
  const long = Math.max(Number(cluster.w) || 0, Number(cluster.h) || 0);
  const short = Math.min(Number(cluster.w) || 0, Number(cluster.h) || 0);
  if (cluster.kind === "circle") return false;
  const aspect = long / (short || 1e-9);
  return long >= 0.7 && long <= 1.65 && short >= 0.55 && aspect >= 1.4 && aspect <= 2.2;
}

export function emergencyTwinAdjustment(cluster, entry, nearby = []) {
  const code = compact(entry?.code);
  if (!/^\d{1,2}e?$/.test(code) || !looksLikeTroffer(cluster)) return 0;
  const emergency = /e$/.test(code);
  const hatched = isHatchedFixture(cluster, nearby);
  if (emergency && hatched) return 0.11;
  if (!emergency && !hatched) return 0.08;
  if (emergency && !hatched) return -0.12;
  if (!emergency && hatched) return -0.12;
  return 0;
}

function circleHintEntry(entry) {
  const blob = `${entry?.shapeHint || ""} ${entry?.symbol?.label || ""} ${entry?.code || ""}`;
  if (/downlight|recessed can|occup|sensor|\bos\b|recept|gfi|gfci|duplex|outlet|pendant/i.test(blob)) return true;
  if (entry?.shapeHint === "circle") return true;
  return /^(gfi|gfiwp|os|2|2e|4)$/.test(compact(entry?.code));
}

function compact(v){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g,"");}
function meaningfulWords(label){
  return String(label||"").toLowerCase().split(/[^a-z0-9]+/).filter((w)=>w.length>=4&&!["type","with","wall","mount","mounted","device","fixture"].includes(w));
}

function seedNearLegendEntry(entry,page){
  const tokens=page?.tokens||[], paths=(page?.paths||[]).filter((p)=>!isJunkGeometry(p));
  const code=compact(entry.code||entry.symbol?.abbr||"");
  let anchors=tokens.filter((t)=>code&&compact(t.text)===code);
  if(!anchors.length){
    const words=meaningfulWords(entry.symbol?.label||"");
    anchors=tokens.filter((t)=>words.includes(compact(t.text))).slice(0,8);
  }
  let best=null,bestScore=-Infinity;
  for(const t of anchors){
    for(const p of paths){
      const dy=Math.abs((p.cy||0)-(t.y||0));
      const dx=(t.x||0)-(p.cx||0);
      const dist=Math.hypot(dx,dy);
      let score=0;
      if(dx>=0&&dx<=8&&dy<=1.5)score+=5-dx*.35-dy;
      else if(dist<=3.2)score+=2.5-dist;
      else continue;
      const long=Math.max(p.w||0,p.h||0);
      if(long>=.18&&long<=2.6)score+=1;
      if(score>bestScore){best=p;bestScore=score;}
    }
  }
  return bestScore>1.2?best:null;
}

export function attachLegendGeometryPrototypes(dictionary,pages=[]){
  const entries=(dictionary?.entries||[]).map((entry)=>({...entry}));
  for(const entry of entries){
    const category=entry.symbol?.takeoffCategory||entry.symbol?.category||"";
    if(category&&!CATEGORY_ALLOW.has(category))continue;
    const sourcePages=pages.filter((p)=>String(p.kind||"").includes("legend")||String(p.kind||"").includes("schedule"));
    let prototype=null;
    for(const page of sourcePages){
      const seed=seedNearLegendEntry(entry,page);
      if(!seed)continue;
      prototype=clusterSymbolGeometry(seed,page.paths||[],{maxSpan:2.8});
      if(prototype)break;
    }
    if(prototype)entry.prototype=prototype;
  }
  return {...dictionary,entries};
}

export function looksLikeHexNoteGlyph(candidate) {
  if (!candidate) return false;
  const w = Number(candidate.w) || 0;
  const h = Number(candidate.h) || 0;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const area = w * h;
  return area >= 0.20 && area <= 0.38 && long >= 0.48 && long <= 0.74 && short >= 0.36 && short <= 0.52;
}

export function looksLikeReceptacleGlyph(candidate) {
  if (!candidate || looksLikeHexNoteGlyph(candidate)) return false;
  const w = Number(candidate.w) || 0;
  const h = Number(candidate.h) || 0;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const area = w * h;
  if (long < 0.10 || long > 0.40 || short < 0.08 || short > 0.32) return false;
  if (area < 0.010 || area > 0.11) return false;
  const aspect = long / (short || 1e-9);
  if (aspect > 2.75) return false;
  if (candidate.kind === "circle") return long < 0.36;
  return candidate.kind === "rect" || candidate.kind === "path" || candidate.kind === "composite" || Boolean(candidate.outline);
}

export function looksLikeUnlabeledReceptacleGlyph(candidate) {
  if (!looksLikeReceptacleGlyph(candidate)) return false;
  const w = Number(candidate.w) || 0;
  const h = Number(candidate.h) || 0;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const aspect = long / (short || 1e-9);
  const strokeBox = long >= 0.20 && long <= 0.36 && short >= 0.10 && short <= 0.16 && aspect >= 1.7 && aspect <= 2.75;
  const duplexBox = long >= 0.13 && long <= 0.24 && short >= 0.10 && short <= 0.20 && aspect >= 1.05 && aspect <= 1.75;
  return strokeBox || duplexBox;
}

export function isHatchTickCluster(candidate, paths = []) {
  if (!candidate) return false;
  const w = Number(candidate.w) || 0;
  const h = Number(candidate.h) || 0;
  const cx = Number(candidate.cx) || 0;
  const cy = Number(candidate.cy) || 0;
  const siblings = (paths || []).filter((other) => {
    if (Math.abs((Number(other.w) || 0) - w) > 0.028 || Math.abs((Number(other.h) || 0) - h) > 0.028) return false;
    const dx = Math.abs((Number(other.cx) || 0) - cx);
    const dy = Math.abs((Number(other.cy) || 0) - cy);
    return dx <= 5.5 && dy <= 5.5;
  });
  if (siblings.length < 9) return false;
  const xs = [...new Set(siblings.map((item) => (Number(item.cx) || 0).toFixed(1)))];
  const ys = [...new Set(siblings.map((item) => (Number(item.cy) || 0).toFixed(1)))];
  return xs.length >= 3 && ys.length >= 3;
}

function nearHexNoteGlyph(point, paths = []) {
  const x = Number(point?.x ?? point?.cx) || 0;
  const y = Number(point?.y ?? point?.cy) || 0;
  return (paths || []).some((path) => looksLikeHexNoteGlyph(path)
    && Math.hypot((Number(path.cx) || 0) - x, (Number(path.cy) || 0) - y) <= 0.55);
}

function nearNoteChrome(point, tokens = []) {
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  return (tokens || []).some((token) => {
    const text = normalizeTypeMark(token.text);
    if (!/^(digit|code|keynote|hex|typ\.?|see|schedule|qty)$/i.test(text)) return false;
    return Math.hypot((Number(token.x) || 0) - x, (Number(token.y) || 0) - y) <= 1.35;
  });
}

export function findNearbyReceptacleGlyph(point, paths = [], options = {}) {
  const x = Number(point?.x ?? point?.cx) || 0;
  const y = Number(point?.y ?? point?.cy) || 0;
  const radius = Number(options.radius) || 1.15;
  const hexClearance = Number(options.hexClearance) || 0.22;
  return (paths || [])
    .filter((path) => looksLikeReceptacleGlyph(path))
    .filter((path) => !(paths || []).some((hex) => looksLikeHexNoteGlyph(hex)
      && Math.hypot((Number(hex.cx) || 0) - (Number(path.cx) || 0), (Number(hex.cy) || 0) - (Number(path.cy) || 0)) < hexClearance))
    .map((path) => ({ path, dist: Math.hypot((Number(path.cx) || 0) - x, (Number(path.cy) || 0) - y) }))
    .filter((item) => item.dist <= radius)
    .sort((a, b) => a.dist - b.dist)[0]?.path || null;
}

function classifyNearbyPowerLabel(point, tokens = []) {
  let best = "";
  let bestDist = 1.15;
  for (const token of tokens || []) {
    const text = normalizeTypeMark(token.text).toUpperCase();
    const dist = Math.hypot((Number(token.x) || 0) - (Number(point?.x) || 0), (Number(token.y) || 0) - (Number(point?.y) || 0));
    if (dist > bestDist) continue;
    if (text === "WP" || text === "GFI/WP") { best = "WP"; bestDist = dist; }
    else if (text === "SP" || text === "SPR") { best = "SP"; bestDist = dist; }
    else if (text === "GFI" || text === "GFCI") { best = "GFI"; bestDist = dist; }
    else if (text === "P2") { best = "P2"; bestDist = dist; }
    else if (text === "DB" || text === "DOORBELL") { best = "DB"; bestDist = dist; }
    else if (text === "OS") { best = "OS"; bestDist = dist; }
  }
  return best;
}

function glyphOutline(path) {
  return path?.outline || {
    kind: path?.kind || "rect",
    source: "vector",
    w: path?.w,
    h: path?.h,
    points: path?.points || [],
  };
}

export function attachPowerGlyphPrototypes(dictionary, marks = [], page = null) {
  const entries = (dictionary?.entries || []).map((entry) => ({ ...entry }));
  const byCode = new Map(entries.map((entry) => [compact(entry.code), entry]));
  for (const mark of marks || []) {
    const code = compact(mark.typeCode || mark.abbr);
    if (!/^(wp|sp|spr|gfi|gfiwp|os|r|p2|db)$/.test(code)) continue;
    let entry = byCode.get(code);
    if (!entry) {
      entry = { code: String(mark.typeCode || mark.abbr || "").toUpperCase(), symbol: { id: mark.symbol, label: mark.symbolLabel, abbr: mark.abbr, category: mark.category, takeoffCategory: mark.category }, shapeHint: "rect" };
      entries.push(entry);
      byCode.set(code, entry);
    }
    const seed = findNearbyReceptacleGlyph({ x: mark.x, y: mark.y }, page?.paths || []);
    if (!seed) continue;
    const cluster = clusterSymbolGeometry(seed, (page?.paths || []).filter((path) => looksLikeReceptacleGlyph(path)), { maxSpan: 0.55, maxParts: 5, joinGap: 0.12 });
    if (!cluster || looksLikeHexNoteGlyph(cluster) || !looksLikeReceptacleGlyph(cluster)) continue;
    entry.prototype = {
      ...cluster,
      source: "vector",
      outline: cluster.outline || glyphOutline(cluster),
    };
    entry.prototypes = [entry.prototype];
    entry.shapeHint = code === "os" || code === "gfi" ? "circle" : "rect";
  }
  return { ...dictionary, entries };
}

export function scanUnlabeledPowerGlyphs(page, options = {}) {
  const occupied = options.occupied || [];
  const tokens = page?.tokens || [];
  const paths = page?.paths || [];
  const symbols = options.symbols || [];
  const pick = (id) => (symbols || []).find((item) => item.id === id);
  const duplex = pick("duplex");
  const wp = pick("wp");
  const gfi = pick("gfci");
  const special = pick("special-rec") || duplex;
  if (!duplex && !special) return [];
  const hits = [];
  for (const path of paths) {
    if (!looksLikeUnlabeledReceptacleGlyph(path) || isHatchTickCluster(path, paths)) continue;
    const placed = { x: path.cx, y: path.cy };
    if (occupied.some((item) => Math.hypot((Number(item.x) || 0) - placed.x, (Number(item.y) || 0) - placed.y) < 0.34)) continue;
    if (!isPlanInterior(placed) || isPlotStampToken(placed, tokens)) continue;
    if (nearNoteChrome(placed, tokens) || nearHexNoteGlyph(placed, paths)) continue;
    const label = classifyNearbyPowerLabel(placed, tokens);
    const symbol = label === "WP" ? (wp || duplex)
      : label === "GFI" ? (gfi || duplex)
      : (label === "SP" || label === "P2" || label === "DB") ? (special || duplex)
      : duplex;
    if (!symbol) continue;
    hits.push({
      geometry: { ...path, outline: glyphOutline(path), source: "vector" },
      entry: { code: label || "R", symbol, shapeHint: "rect" },
      score: label ? 0.96 : 0.91,
      margin: 0.08,
      ambiguous: !label,
    });
  }
  return hits;
}

function entryFamily(entry) {
  const blob = `${entry?.symbol?.takeoffCategory || ""} ${entry?.symbol?.category || ""} ${entry?.symbol?.label || ""} ${entry?.code || ""}`;
  if (/lighting|downlight|troffer|can light|fixture/i.test(blob) && !/recept|gfi|switch/i.test(blob)) return "lighting";
  if (/recept|gfi|switch|outlet|duplex|weatherproof|special-purpose|\bwp\b|\bsp\b|\bspr\b/i.test(blob)) return "power";
  if (/equipment|panel|fan|hvac/i.test(blob)) return "power";
  return "";
}

export function planTypeScore(entry, planType) {
  const family = entryFamily(entry);
  if (!planType || !family) return 0;
  if (planType === family) return 0.08;
  if (planType !== family) return -0.07;
  return 0;
}

export function isEmergencyTwin(a, b) {
  const left = compact(a?.code || a);
  const right = compact(b?.code || b);
  if (!left || !right || left === right) return false;
  return left + "e" === right || right + "e" === left;
}

export function rankGeometryEntries(cluster, entries = [], planType = "", options = {}) {
  return (entries || [])
    .filter((entry) => entry?.prototype)
    .map((entry) => {
      const protos = entry.prototypes?.length ? entry.prototypes : [entry.prototype];
      const geom = Math.max(...protos.map((proto) => geometrySimilarity(cluster, proto)));
      const body = Math.max(...protos.map((proto) => bodySimilarity(cluster, proto)));
      const twin = (entries || []).some((other) => other !== entry && other.prototype && isEmergencyTwin(entry, other));
      const emergency = /^\d{1,2}e$/.test(compact(entry.code));
      const hatched = isHatchedFixture(cluster, options.nearby);
      const useBody = Boolean(options.twinHatch)
        && looksLikeTroffer(cluster)
        && ((twin && body >= 0.88) || (emergency && hatched && body >= 0.88));
      const raw = useBody ? Math.max(geom, body) : geom;
      return {
        entry,
        raw,
        score: raw + planTypeScore(entry, planType) + emergencyTwinAdjustment(cluster, entry, options.nearby),
      };
    })
    .sort((a, b) => b.score - a.score || b.raw - a.raw);
}

export function sizeCompatible(a, b) {
  const A = a?.signature || geometrySignature(a);
  const B = b?.signature || geometrySignature(b);
  if (!A || !B) return false;
  const longR = Math.max(A.long, B.long) / Math.max(0.0001, Math.min(A.long, B.long));
  const shortR = Math.max(A.short, B.short) / Math.max(0.0001, Math.min(A.short, B.short));
  return longR <= 1.32 && shortR <= 1.32;
}

export function resolveGeometryMatch(cluster, entries = [], options = {}) {
  const planType = options.planType || "";
  const ranked = rankGeometryEntries(cluster, entries, planType, options)
    .filter((row) => {
      if (!options.strictSize) return true;
      const protos = row.entry.prototypes?.length ? row.entry.prototypes : [row.entry.prototype];
      return protos.some((proto) => sizeCompatible(cluster, proto));
    });
  const best = ranked[0];
  if (!best) return null;
  const runner = ranked[1];
  const margin = best.score - (runner?.score || 0);
  const twins = runner ? isEmergencyTwin(best.entry, runner.entry) : false;
  const settledByPlan = Boolean(planType && entryFamily(best.entry) === planType && runner && entryFamily(runner.entry) !== planType);
  const hatchSettled = twins && Math.abs(
    emergencyTwinAdjustment(cluster, best.entry, options.nearby)
    - emergencyTwinAdjustment(cluster, runner.entry, options.nearby),
  ) >= 0.15;
  if (twins && margin < 0.08 && !settledByPlan && !hatchSettled) return null;
  return {
    entry: best.entry,
    score: best.raw,
    adjustedScore: best.score,
    margin,
    ambiguous: !settledByPlan && !hatchSettled && margin < 0.045,
  };
}

export function attachConfirmedGeometryPrototypes(dictionary, marks = []) {
  const entries = (dictionary?.entries || []).map((entry) => ({ ...entry }));
  const byCode = new Map(entries.map((entry) => [compact(entry.code), entry]));
  for (const mark of marks || []) {
    const code = compact(mark.typeCode || mark.abbr);
    const entry = byCode.get(code);
    if (!entry || !mark.outline || mark.outlineSource === "text") continue;
    const candidate = {
      cx: Number(mark.x) || 0,
      cy: Number(mark.y) || 0,
      w: Number(mark.outline.w) || Number(mark.w) || 0,
      h: Number(mark.outline.h) || Number(mark.h) || 0,
      kind: mark.outline.kind || "rect",
      source: mark.outlineSource || mark.outline.source || "vector",
      parts: mark.outline.parts || mark.parts,
      outline: mark.outline,
    };
    if (!candidate.w || !candidate.h) continue;
    candidate.signature = geometrySignature(candidate);
    entry.prototypes = entry.prototypes || (entry.prototype ? [entry.prototype] : []);
    if (entry.prototypes.length < 2 && !entry.prototypes.some((existing) => geometrySimilarity(candidate, existing) >= 0.96 && sizeCompatible(candidate, existing))) {
      entry.prototypes.push(candidate);
    }
    if (!entry.prototype || entry.prototype.fragmentSymbol || geometrySimilarity(candidate, entry.prototype) < 0.5) {
      entry.prototype = candidate;
    }
  }
  return { ...dictionary, entries };
}

function countFragmentMatches(page, prototype) {
  if (!prototype) return 0;
  const hits = scanPageByLegendGeometry(page, { entries: [{ code: "frag", symbol: { id: "frag" }, prototype }] }, {
    allowSlash: true,
    threshold: 0.92,
    strictSize: true,
    occupyRadius: 0.2,
    occupied: [],
  });
  return hits.length;
}

export function attachFragmentPrototypes(dictionary, marks = [], page = null) {
  const entries = (dictionary?.entries || []).map((entry) => ({ ...entry }));
  const byCode = new Map(entries.map((entry) => [compact(entry.code), entry]));
  const fragments = (page?.paths || []).filter(isDeviceFragment);
  if (!fragments.length) return { ...dictionary, entries };
  const labeledCount = new Map();
  for (const mark of marks || []) {
    const code = compact(mark.typeCode || mark.abbr);
    labeledCount.set(code, (labeledCount.get(code) || 0) + 1);
  }
  for (const mark of marks || []) {
    const code = compact(mark.typeCode || mark.abbr);
    const entry = byCode.get(code);
    if (!entry || !circleHintEntry(entry)) continue;
    if (entry.prototype && !entry.prototype.fragmentSymbol && entry.prototype.source !== "text") continue;
    const nearby = fragments.filter((fragment) => Math.hypot((fragment.cx || 0) - mark.x, (fragment.cy || 0) - mark.y) <= 0.52);
    if (!nearby.length) continue;
    const cluster = clusterSymbolGeometry(nearby[0], nearby, {
      allowSlash: true,
      maxSpan: 0.85,
      joinGap: 0.26,
      maxParts: 6,
    });
    if (!cluster) continue;
    const long = Math.max(cluster.w || 0, cluster.h || 0);
    if (long < 0.12 || long > 0.72) continue;
    cluster.fragmentSymbol = true;
    cluster.signature = geometrySignature(cluster);
    if (!entry.slashPrototype) entry.slashPrototype = cluster;
  }
  for (const entry of entries) {
    if (!entry.slashPrototype) continue;
    const matches = countFragmentMatches(page, entry.slashPrototype);
    const labeled = labeledCount.get(compact(entry.code)) || 0;
    if (matches > labeled + 1) entry.slashPrototype = null;
  }
  return { ...dictionary, entries };
}

export function snapToEntryPrototype(token, page, entry, options = {}) {
  if (!token || !entry?.prototype) return null;
  const used = options.used || new Set();
  const paths = (page?.paths || []).filter((path) => !used.has(path) && !isJunkGeometry(path));
  let best = null;
  let bestScore = 0;
  for (const seed of paths) {
    if (Math.hypot((seed.cx || 0) - token.x, (seed.cy || 0) - token.y) > 1.8) continue;
    const cluster = clusterSymbolGeometry(seed, paths, { maxSpan: 2.2 });
    if (!cluster) continue;
    const score = geometrySimilarity(cluster, entry.prototype);
    if (score > bestScore) {
      best = cluster;
      bestScore = score;
    }
  }
  if (!best || bestScore < 0.86) return null;
  if (Math.hypot(best.cx - token.x, best.cy - token.y) > 1.15) return null;
  return best;
}

export function scanPageByLegendGeometry(page,dictionary,options={}){
  const threshold=Number(options.threshold)||0.82;
  const entries=(dictionary?.entries||[]).filter((e)=>{
    if(!e.prototype) return false;
    if (!options.planType) return true;
    const family = entryFamily(e);
    return !family || family === options.planType;
  });
  if(!entries.length)return [];
  const planType=options.planType||pagePlanType(page);
  const occupied=options.occupied||[];
  const paths=(page?.paths||[]).filter((p)=>allowCandidate(p,options));
  const clusters=[];
  // Do not globally consume primitives here. A single primitive can be the seed
  // for several nearby symbol hypotheses; consuming it after the first cluster
  // caused one fixture family to dominate a sheet and hid other device types.
  const seenClusterKeys=new Set();
  const clusterOpts = options.allowSlash
    ? { allowSlash: true, maxSpan: 0.85, joinGap: 0.26, maxParts: 6 }
    : { maxSpan: 2.8, keepSeedBody: Boolean(options.keepSeedBody) };
  for(const seed of paths){
    if (options.allowSlash && !isDeviceFragment(seed) && isJunkGeometry(seed)) continue;
    if (options.twinHatch && !looksLikeTroffer(seed)) continue;
    const cluster=clusterSymbolGeometry(seed,paths,clusterOpts);
    if(!cluster)continue;
    if (options.allowSlash) {
      const long = Math.max(cluster.w || 0, cluster.h || 0);
      if (long < 0.1 || long > 0.98) continue;
    }
    const key=[cluster.cx.toFixed(2),cluster.cy.toFixed(2),cluster.w.toFixed(2),cluster.h.toFixed(2),cluster.parts?.length||1].join(":");
    if(seenClusterKeys.has(key))continue;
    seenClusterKeys.add(key);
    clusters.push(cluster);
  }
  const hits=[];
  for(const cluster of clusters){
    if(occupied.some((point)=>Math.hypot((point.x||0)-cluster.cx,(point.y||0)-cluster.cy)<(Number(options.occupyRadius)||0.34))) continue;
    const nearby = (page?.paths || []).filter((path) => Math.hypot((path.cx || 0) - cluster.cx, (path.cy || 0) - cluster.cy) <= 0.7);
    const resolved=resolveGeometryMatch(cluster,entries,{
      planType,
      strictSize:options.strictSize,
      bodyOnly:options.bodyOnly,
      nearby,
    });
    if(resolved&&resolved.score>=threshold){
      hits.push({geometry:cluster,entry:resolved.entry,score:resolved.score,margin:resolved.margin,ambiguous:resolved.ambiguous});
    }
  }
  // Keep the strongest hypothesis for the same physical footprint, but do not
  // suppress distinct nearby symbols.
  return hits.sort((a,b)=>b.score-a.score).filter((hit,index,all)=>!all.slice(0,index).some((other)=>
    Math.hypot(other.geometry.cx-hit.geometry.cx,other.geometry.cy-hit.geometry.cy)<0.16 &&
    other.entry.symbol?.id===hit.entry.symbol?.id
  ));
}
