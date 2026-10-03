
import { pagePlanType } from "./drawing-docs.js";
import { isJunkGeometry } from "./vectorSymbols.js";

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
      if(parts.includes(c)||isJunkGeometry(c)) continue;
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

function entryFamily(entry) {
  const blob = `${entry?.symbol?.takeoffCategory || ""} ${entry?.symbol?.category || ""} ${entry?.symbol?.label || ""}`;
  if (/lighting|downlight|troffer|can light|fixture/i.test(blob) && !/recept|gfi|switch/i.test(blob)) return "lighting";
  if (/recept|gfi|switch|outlet|duplex/i.test(blob)) return "power";
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

export function rankGeometryEntries(cluster, entries = [], planType = "") {
  return (entries || [])
    .filter((entry) => entry?.prototype)
    .map((entry) => ({
      entry,
      raw: geometrySimilarity(cluster, entry.prototype),
      score: geometrySimilarity(cluster, entry.prototype) + planTypeScore(entry, planType),
    }))
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
  const ranked = rankGeometryEntries(cluster, entries, planType)
    .filter((row) => !options.strictSize || sizeCompatible(cluster, row.entry.prototype));
  const best = ranked[0];
  if (!best) return null;
  const runner = ranked[1];
  const margin = best.score - (runner?.score || 0);
  const twins = runner ? isEmergencyTwin(best.entry, runner.entry) : false;
  const settledByPlan = Boolean(planType && entryFamily(best.entry) === planType && runner && entryFamily(runner.entry) !== planType);
  if (twins && margin < 0.08 && !settledByPlan) return null;
  return {
    entry: best.entry,
    score: best.raw,
    adjustedScore: best.score,
    margin,
    ambiguous: !settledByPlan && margin < 0.045,
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
    if (!entry.prototype || geometrySimilarity(candidate, entry.prototype) < 0.5) {
      entry.prototype = candidate;
    }
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
  const entries=(dictionary?.entries||[]).filter((e)=>e.prototype);
  if(!entries.length)return [];
  const planType=options.planType||pagePlanType(page);
  const occupied=options.occupied||[];
  const paths=(page?.paths||[]).filter((p)=>!isJunkGeometry(p));
  const clusters=[];
  // Do not globally consume primitives here. A single primitive can be the seed
  // for several nearby symbol hypotheses; consuming it after the first cluster
  // caused one fixture family to dominate a sheet and hid other device types.
  const seenClusterKeys=new Set();
  for(const seed of paths){
    const cluster=clusterSymbolGeometry(seed,paths,{maxSpan:2.8});
    if(!cluster)continue;
    const key=[cluster.cx.toFixed(2),cluster.cy.toFixed(2),cluster.w.toFixed(2),cluster.h.toFixed(2),cluster.parts?.length||1].join(":");
    if(seenClusterKeys.has(key))continue;
    seenClusterKeys.add(key);
    clusters.push(cluster);
  }
  const hits=[];
  for(const cluster of clusters){
    if(occupied.some((point)=>Math.hypot((point.x||0)-cluster.cx,(point.y||0)-cluster.cy)<(Number(options.occupyRadius)||0.34))) continue;
    const resolved=resolveGeometryMatch(cluster,entries,{planType,strictSize:options.strictSize});
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
