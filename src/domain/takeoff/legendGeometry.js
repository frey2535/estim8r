
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

function shortPrintedLabel(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 10) return false;
  if (/^(?:LN|LP|PP|RP|H|L|EM)\d{1,2}$|^P\d{2}$/i.test(value)) return true;
  // Bare circuit / keynote numbers sitting beside a symbol. Type words such as
  // WP, GFI, SPR, or G are the device identity and must not steal the fill.
  return /^\d{1,3}[A-Z]?$/.test(value);
}

function partLong(part) {
  return Math.max(Number(part?.w) || 0, Number(part?.h) || 0, (Number(part?.r) || 0) * 2);
}

function isLabelSizedGlyph(part) {
  const long = partLong(part);
  return long > 0 && long <= 0.42;
}

function partNearPrintedLabel(part, tokens = []) {
  if (!isLabelSizedGlyph(part)) return false;
  const px = Number(part?.cx) || 0;
  const py = Number(part?.cy) || 0;
  const long = partLong(part);
  return (tokens || []).some((token) => {
    if (!shortPrintedLabel(token?.text)) return false;
    const dist = Math.hypot((Number(token.x) || 0) - px, (Number(token.y) || 0) - py);
    // Only the compact number/type glyph itself is a label. A full symbol body
    // may contain a letter such as G or 11 and must still receive the fill.
    return dist <= Math.max(0.16, Math.min(0.34, long * 1.15));
  });
}

function outlineFromPath(path) {
  if (!path) return null;
  return path.outline ? {
    ...path.outline,
    cx: path.outline.cx ?? path.cx,
    cy: path.outline.cy ?? path.cy,
    w: path.outline.w ?? path.w,
    h: path.outline.h ?? path.h,
    r: path.outline.r ?? path.r,
    source: path.outline.source || path.source || "vector",
  } : {
    kind: path.kind || "rect",
    source: path.source || "vector",
    cx: path.cx,
    cy: path.cy,
    w: path.w,
    h: path.h,
    r: path.r,
    points: path.points || [],
  };
}

function nearbySymbolBody(origin, paths = [], tokens = []) {
  const x = Number(origin?.x ?? origin?.cx) || 0;
  const y = Number(origin?.y ?? origin?.cy) || 0;
  let best = null;
  let bestScore = -Infinity;
  for (const path of paths || []) {
    if (!path || looksLikeHexNoteGlyph(path)) continue;
    if (partNearPrintedLabel(path, tokens)) continue;
    const cx = Number(path.cx) || 0;
    const cy = Number(path.cy) || 0;
    const dist = Math.hypot(cx - x, cy - y);
    if (dist > 1.25 || dist < 0.02) continue;
    const long = partLong(path);
    const short = Math.min(Number(path.w) || long, Number(path.h) || long);
    if (long < 0.16 || long > 1.65 || short < 0.12) continue;
    if (long / (short || 1e-9) > 2.8) continue;
    const compact = long >= 0.22 && long / (short || 1e-9) <= 1.75;
    const score = (compact ? 1.5 : 0.75) - dist * 1.2 + Math.min(0.4, long);
    if (score > bestScore) {
      best = path;
      bestScore = score;
    }
  }
  return bestScore > 0.2 ? best : null;
}

export function symbolBodyOutline(geometry, tokens = [], options = {}) {
  const outline = geometry?.outline || geometry;
  if (!outline) return null;
  if (looksLikeHexNoteGlyph(geometry) || looksLikeHexNoteGlyph(outline)) return null;

  const paths = options.paths || [];
  const origin = {
    x: Number(outline.cx ?? geometry?.cx ?? geometry?.x) || 0,
    y: Number(outline.cy ?? geometry?.cy ?? geometry?.y) || 0,
  };
  const snapAwayFromLabel = (point) => outlineFromPath(nearbySymbolBody(point, paths, tokens));

  if (outline.kind === "composite" && outline.parts?.length) {
    const parts = outline.parts.filter((part) => !partNearPrintedLabel(part, tokens) && !looksLikeHexNoteGlyph(part));
    if (!parts.length) return snapAwayFromLabel(origin);
    const area = (part) => {
      const w = Number(part?.w) || (Number(part?.r) || 0) * 2;
      const h = Number(part?.h) || (Number(part?.r) || 0) * 2;
      return Math.max(0.0001, w * h);
    };
    const core = [...parts].sort((a, b) => area(b) - area(a))[0];
    if (partNearPrintedLabel(core, tokens) || looksLikeHexNoteGlyph(core)) return snapAwayFromLabel(origin);
    const coreLong = Math.max(partLong(core), 0.12);
    const kept = parts.filter((part) => {
      if (part === core) return true;
      if (partNearPrintedLabel(part, tokens)) return false;
      const d = gap(core, part);
      const center = Math.hypot((Number(part.cx) || 0) - (Number(core.cx) || 0), (Number(part.cy) || 0) - (Number(core.cy) || 0));
      return d <= Math.max(0.16, coreLong * 0.42) && center <= Math.max(0.45, coreLong * 1.45);
    });
    const bodyParts = kept.length ? kept : [core];
    const box = unionBounds(bodyParts);
    return {
      kind: "composite",
      source: outline.source || geometry?.source || "vector",
      cx: box?.cx,
      cy: box?.cy,
      w: box?.w,
      h: box?.h,
      parts: bodyParts,
    };
  }

  const asPart = {
    cx: origin.x,
    cy: origin.y,
    w: Number(outline.w) || partLong(outline),
    h: Number(outline.h) || partLong(outline),
    r: outline.r,
  };
  if (partNearPrintedLabel(asPart, tokens)) return snapAwayFromLabel(origin);
  return {
    ...outline,
    cx: outline.cx ?? origin.x,
    cy: outline.cy ?? origin.y,
  };
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

const SPATIAL_CELL = 2;

export function buildSpatialIndex(candidates = [], cell = SPATIAL_CELL) {
  const buckets = new Map();
  for (const item of candidates || []) {
    const gx = Math.floor((Number(item?.cx) || 0) / cell);
    const gy = Math.floor((Number(item?.cy) || 0) / cell);
    const key = `${gx}:${gy}`;
    const bin = buckets.get(key);
    if (bin) bin.push(item);
    else buckets.set(key, [item]);
  }
  return { buckets, cell };
}

export function nearbyFromIndex(index, x, y, radius) {
  if (!index?.buckets) return [];
  const cell = index.cell || SPATIAL_CELL;
  const reach = Math.ceil((Number(radius) || 0) / cell) + 1;
  const gx = Math.floor((Number(x) || 0) / cell);
  const gy = Math.floor((Number(y) || 0) / cell);
  const out = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const bin = index.buckets.get(`${gx + dx}:${gy + dy}`);
      if (bin) out.push(...bin);
    }
  }
  return out;
}

function candidatePool(candidates, options, x, y, radius) {
  if (options?.index) return nearbyFromIndex(options.index, x, y, radius);
  return candidates || [];
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
    const pool=candidatePool(candidates,options,box.cx,box.cy,maxSpan+joinGap);
    for(const c of pool){
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

function layoutDistanceScore(layoutA=[], layoutB=[]){
  if(!layoutA.length||!layoutB.length)return 0.5;
  const scoreOneWay=(A,B)=>{
    let total=0;
    for(const a of A){
      let best=Infinity;
      for(const b of B){
        const kindPenalty=a.kind===b.kind?0:0.18;
        const d=Math.hypot((a.dx||0)-(b.dx||0),(a.dy||0)-(b.dy||0))
          + Math.abs((a.w||0)-(b.w||0))*0.55
          + Math.abs((a.h||0)-(b.h||0))*0.55
          + kindPenalty;
        if(d<best)best=d;
      }
      total+=best;
    }
    return total/Math.max(1,A.length);
  };
  const raw=(scoreOneWay(layoutA,layoutB)+scoreOneWay(layoutB,layoutA))/2;
  return Math.max(0,Math.min(1,1-raw/1.25));
}

function rotateLayout(layout=[],turns=0){
  const t=((turns%4)+4)%4;
  return layout.map((part)=>{
    let dx=part.dx||0,dy=part.dy||0,w=part.w||0,h=part.h||0;
    for(let i=0;i<t;i+=1){
      const nextDx=-dy;
      const nextDy=dx;
      dx=nextDx;dy=nextDy;
      const nextW=h;h=w;w=nextW;
    }
    return {...part,dx,dy,w,h};
  });
}

function bestLayoutScore(A,B){
  let best=0;
  for(let turns=0;turns<4;turns+=1){
    best=Math.max(best,layoutDistanceScore(A.layout||[],rotateLayout(B.layout||[],turns)));
  }
  return best;
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
  const layout=bestLayoutScore(A,B);
  return aspect*.18+size*.20+count*.16+kind*.16+layout*.30;
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
    const prototypes=[];
    for(const page of sourcePages){
      const seed=seedNearLegendEntry(entry,page);
      if(!seed)continue;
      const seedLong=Math.max(Number(seed.w)||0,Number(seed.h)||0,0.2);
      const prototype=clusterSymbolGeometry(seed,page.paths||[],{
        maxSpan:Math.max(0.7,Math.min(1.8,seedLong*2.4)),
        joinGap:Math.max(0.08,Math.min(0.28,seedLong*0.55)),
        maxParts:10,
      });
      if(!prototype)continue;
      if(!prototypes.some((existing)=>geometrySimilarity(existing,prototype)>=0.97)){
        prototypes.push(prototype);
      }
      if(prototypes.length>=3)break;
    }
    if(prototypes.length){
      entry.prototypes=prototypes;
      entry.prototype=prototypes[0];
    }
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
  const aspect = long / (short || 1e-9);
  return area >= 0.20 && area <= 0.38 && long >= 0.48 && long <= 0.74 && short >= 0.36 && short <= 0.52 && aspect >= 1.2;
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
  const duplexBox = long >= 0.17 && long <= 0.24 && short >= 0.12 && short <= 0.20 && aspect >= 1.05 && aspect <= 1.75;
  return strokeBox || duplexBox;
}

export function isPlanReceptacleGlyph(candidate, paths = [], tokens = []) {
  if (!looksLikeUnlabeledReceptacleGlyph(candidate)) return false;
  if (isHatchTickCluster(candidate, paths) || looksLikeHexNoteGlyph(candidate)) return false;
  if (nearHexNoteGlyph(candidate, paths, 1.0)) return false;
  const placed = { x: Number(candidate.cx) || 0, y: Number(candidate.cy) || 0 };
  if (!isPlanInterior(placed) || isPlotStampToken(placed, tokens)) return false;
  if (placed.y > 74 || placed.y < 12) return false;
  if ((tokens || []).some((token) => {
    const text = normalizeTypeMark(token.text).toUpperCase();
    if (!/^(WP|SP|SPR|GFI|GFI\/WP|P2|DB)$/.test(text)) return false;
    return Math.hypot((Number(token.x) || 0) - placed.x, (Number(token.y) || 0) - placed.y) <= 0.55;
  })) return false;
  return true;
}

export function uniquePlanReceptacleGlyphs(paths = [], tokens = []) {
  const glyphs = (paths || []).filter((path) => isPlanReceptacleGlyph(path, paths, tokens));
  const unique = [];
  for (const glyph of glyphs) {
    if (unique.some((other) => Math.hypot((other.cx || 0) - (glyph.cx || 0), (other.cy || 0) - (glyph.cy || 0)) < 0.28)) continue;
    unique.push(glyph);
  }
  return unique;
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

export function nearHexNoteGlyph(point, paths = [], radius = 0.55) {
  const x = Number(point?.x ?? point?.cx) || 0;
  const y = Number(point?.y ?? point?.cy) || 0;
  const limit = Number(radius) || 0.55;
  return (paths || []).some((path) => looksLikeHexNoteGlyph(path)
    && Math.hypot((Number(path.cx) || 0) - x, (Number(path.cy) || 0) - y) <= limit);
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

export function looksLikeWpCoverGlyph(candidate) {
  if (!candidate || looksLikeHexNoteGlyph(candidate)) return false;
  const w = Number(candidate.w) || 0;
  const h = Number(candidate.h) || 0;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const aspect = long / (short || 1e-9);
  return long >= 0.36 && long <= 0.72 && short >= 0.32 && aspect <= 1.45;
}

export function findNearbyReceptacleGlyph(point, paths = [], options = {}) {
  const x = Number(point?.x ?? point?.cx) || 0;
  const y = Number(point?.y ?? point?.cy) || 0;
  const radius = Number(options.radius) || 1.15;
  const hexClearance = Number(options.hexClearance) || 0.22;
  const allowWpCover = Boolean(options.allowWpCover);
  return (paths || [])
    .filter((path) => looksLikeReceptacleGlyph(path) || (allowWpCover && looksLikeWpCoverGlyph(path)))
    .filter((path) => !(paths || []).some((hex) => looksLikeHexNoteGlyph(hex)
      && Math.hypot((Number(hex.cx) || 0) - (Number(path.cx) || 0), (Number(hex.cy) || 0) - (Number(path.cy) || 0)) < hexClearance))
    .map((path) => ({ path, dist: Math.hypot((Number(path.cx) || 0) - x, (Number(path.cy) || 0) - y) }))
    .filter((item) => item.dist <= radius)
    .sort((a, b) => {
      const receptacleFirst = Number(looksLikeReceptacleGlyph(b.path)) - Number(looksLikeReceptacleGlyph(a.path));
      return receptacleFirst || a.dist - b.dist;
    })[0]?.path || null;
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
    if (!/^(wp|sp|spr|r|p2|db)$/.test(code)) continue;
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
  if (!duplex) return [];
  const gfiHeavy = tokens.filter((token) => /^GFI/i.test(normalizeTypeMark(token.text))).length >= 8;
  const hits = [];
  for (const path of paths) {
    if (!isPlanReceptacleGlyph(path, paths, tokens)) continue;
    const placed = { x: path.cx, y: path.cy };
    if (occupied.some((item) => Math.hypot((Number(item.x) || 0) - placed.x, (Number(item.y) || 0) - placed.y) < 0.34)) continue;
    if (isPlotStampToken(placed, tokens) || nearNoteChrome(placed, tokens)) continue;
    if (classifyNearbyPowerLabel(placed, tokens) || gfiHeavy) continue;
    if (!duplex) continue;
    hits.push({
      geometry: { ...path, outline: glyphOutline(path), source: "vector" },
      entry: { code: "R", symbol: duplex, shapeHint: "rect" },
      score: 0.91,
      margin: 0.08,
      ambiguous: true,
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
    if (/^(wp|sp|spr|r|p2|db)$/.test(code)) continue;
    if ((Number(mark.x) || 0) > 64 || (Number(mark.y) || 0) < 14) continue;
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
    const long = Math.max(candidate.w, candidate.h);
    if (long < 0.45) continue;
    if (entry.prototype) {
      const protoLong = Math.max(Number(entry.prototype.w) || 0, Number(entry.prototype.h) || 0);
      if (protoLong > 0.7 && long < protoLong * 0.62) continue;
    }
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

function pushHypothesis(hypotheses, cluster, entry, proto, planType, nearby, options) {
  const geom = geometrySimilarity(cluster, proto);
  const body = bodySimilarity(cluster, proto);
  const sizeOk = sizeCompatible(cluster, proto);
  const score = Math.max(geom, options.bodyOnly ? body : 0)
    + planTypeScore(entry, planType)
    + emergencyTwinAdjustment(cluster, entry, nearby);
  hypotheses.push({ cluster, entry, raw: geom, score, sizeOk, nearby });
}

export function scanPageByLegendGeometry(page,dictionary,options={}){
  const threshold=Number(options.threshold)||0.76;
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
  const hypotheses=[];
  const seen=new Set();
  const index=buildSpatialIndex(paths);
  const started=Date.now();
  const budget=Number(options.timeBudgetMs)>0?Number(options.timeBudgetMs):12000;
  const maxSeeds=Number(options.maxSeeds)>0?Number(options.maxSeeds):1800;
  const dense=paths.length>2500 || paths.length*entries.length>80000;
  let seedsUsed=0;

  for(const seed of paths){
    if(Date.now()-started>budget) break;
    if(seedsUsed>=maxSeeds) break;
    if (options.allowSlash && !isDeviceFragment(seed) && isJunkGeometry(seed)) continue;
    if (options.twinHatch && !looksLikeTroffer(seed)) continue;
    const seedLong=Math.max(Number(seed.w)||0,Number(seed.h)||0,0.02);
    if(dense && (seedLong>3.2 || seedLong<0.06)) continue;
    seedsUsed+=1;

    if(dense){
      const cluster=clusterSymbolGeometry(seed,paths,{
        allowSlash:Boolean(options.allowSlash),
        keepSeedBody:Boolean(options.keepSeedBody),
        maxSpan:Math.max(0.42,Math.min(2.5,seedLong*1.42)),
        joinGap:Math.max(0.06,Math.min(0.38,seedLong*0.72)),
        maxParts:14,
        index,
      });
      if(!cluster) continue;
      const distKey=[cluster.cx.toFixed(2),cluster.cy.toFixed(2),cluster.w.toFixed(2),cluster.h.toFixed(2),cluster.parts?.length||1].join(":");
      if(seen.has(distKey)) continue;
      seen.add(distKey);
      const nearby=nearbyFromIndex(index,cluster.cx,cluster.cy,Math.max(0.5,seedLong*1.2));
      for(const entry of entries){
        const protos=entry.prototypes?.length?entry.prototypes:[entry.prototype];
        for(const proto of protos){
          if(!proto) continue;
          pushHypothesis(hypotheses,cluster,entry,proto,planType,nearby,options);
        }
      }
      continue;
    }

    for(const entry of entries){
      const protos=entry.prototypes?.length?entry.prototypes:[entry.prototype];
      for(const proto of protos){
        if(!proto) continue;
        const pLong=Math.max(Number(proto.w)||0,Number(proto.h)||0,0.18);
        const pShort=Math.max(0.08,Math.min(Number(proto.w)||0,Number(proto.h)||0,pLong));
        if(options.strictSize && (seedLong>pLong*1.75 || seedLong<pShort*0.15)) continue;
        const cluster=clusterSymbolGeometry(seed,paths,{
          allowSlash:Boolean(options.allowSlash),
          keepSeedBody:Boolean(options.keepSeedBody),
          maxSpan:Math.max(0.42,Math.min(2.5,pLong*1.42)),
          joinGap:Math.max(0.06,Math.min(0.38,pShort*0.72)),
          maxParts:Math.max(4,Math.min(14,(proto.parts?.length||1)+5)),
          index,
        });
        if(!cluster) continue;
        const distKey=[entry.symbol?.id||entry.code,cluster.cx.toFixed(2),cluster.cy.toFixed(2),cluster.w.toFixed(2),cluster.h.toFixed(2),cluster.parts?.length||1].join(":");
        if(seen.has(distKey)) continue;
        seen.add(distKey);
        const nearby=nearbyFromIndex(index,cluster.cx,cluster.cy,Math.max(0.5,pLong*0.9));
        pushHypothesis(hypotheses,cluster,entry,proto,planType,nearby,options);
      }
    }
  }

  const hits=[];
  hypotheses.sort((a,b)=>b.score-a.score);
  for(const row of hypotheses){
    if(row.raw < threshold) continue;
    if(options.strictSize && !row.sizeOk) continue;
    const cluster=row.cluster;
    if(occupied.some((point)=>Math.hypot((point.x||0)-cluster.cx,(point.y||0)-cluster.cy)<(Number(options.occupyRadius)||0.26))) continue;
    if(hits.some((hit)=>Math.hypot(hit.geometry.cx-cluster.cx,hit.geometry.cy-cluster.cy)<0.20)) continue;

    const rivals=hypotheses.filter((other)=>other!==row && Math.hypot(other.cluster.cx-cluster.cx,other.cluster.cy-cluster.cy)<0.22);
    const runner=rivals[0];
    const margin=row.score-(runner?.score||0);
    hits.push({
      geometry:cluster,
      entry:row.entry,
      score:row.raw,
      margin,
      ambiguous:Boolean(runner && margin<0.035),
    });
  }
  return hits;
}

export function recoverMissedLegendSymbols(page, dictionary, options = {}) {
  const planType = options.planType || pagePlanType(page);
  const occupied = options.occupied || [];
  const tokens = page?.tokens || [];
  const entries = (dictionary?.entries || []).filter((entry) => {
    if (!entry?.prototype) return false;
    const family = entryFamily(entry);
    return !planType || !family || family === planType;
  });
  const recovered = [];
  for (const entry of entries) {
    const hits = scanPageByLegendGeometry(page, { entries: [entry] }, {
      planType,
      threshold: 0.68,
      strictSize: false,
      occupyRadius: 0.24,
      occupied: [...occupied, ...recovered.map((hit) => ({ x: hit.geometry.cx, y: hit.geometry.cy }))],
      timeBudgetMs: 4500,
      maxSeeds: 2200,
      allowSlash: true,
      keepSeedBody: true,
    });
    if (!hits.length) continue;
    const repeated = hits.length >= 2;
    const wanted = compact(entry.code);
    for (const hit of hits) {
      const nearbyCode = tokens.some((token) => (
        wanted
        && compact(token.text) === wanted
        && Math.hypot((Number(token.x) || 0) - hit.geometry.cx, (Number(token.y) || 0) - hit.geometry.cy) <= 0.85
      ));
      const strong = hit.score >= 0.86;
      const repeatedStrong = repeated && hit.score >= 0.78;
      const labeledStrong = nearbyCode && hit.score >= 0.72;
      if (!strong && !repeatedStrong && !labeledStrong) continue;
      if (recovered.some((other) => Math.hypot(other.geometry.cx-hit.geometry.cx,other.geometry.cy-hit.geometry.cy) < 0.22)) continue;
      recovered.push({
        ...hit,
        entry,
        recoveryReason: strong ? "high-geometry" : labeledStrong ? "geometry+type-code" : "repeated-prototype",
        ambiguous: false,
      });
    }
  }
  return recovered;
}

export function pickInteractiveSymbolGeometry(page, point, options = {}) {
  if (!page || !point) return null;
  const paths=(page.paths||[]).filter((path)=>allowCandidate(path,{allowSlash:true}));
  const radius=Number(options.radius)||1.25;
  const nearby=paths
    .map((path)=>({path,dist:Math.hypot((path.cx||0)-point.x,(path.cy||0)-point.y)}))
    .filter((row)=>row.dist<=radius)
    .sort((a,b)=>a.dist-b.dist)
    .slice(0,18);
  if(!nearby.length) return null;

  let best=null;
  let bestScore=-Infinity;
  for(const row of nearby){
    const seed=row.path;
    const seedLong=Math.max(Number(seed.w)||0,Number(seed.h)||0,0.16);
    for(const span of [Math.max(0.42,seedLong*1.7),Math.max(0.7,seedLong*2.5),1.35]){
      const cluster=clusterSymbolGeometry(seed,paths,{
        allowSlash:true,
        maxSpan:Math.min(2.2,span),
        joinGap:Math.max(0.08,Math.min(0.32,seedLong*0.7)),
        maxParts:12,
      });
      if(!cluster) continue;
      const long=Math.max(Number(cluster.w)||0,Number(cluster.h)||0);
      const short=Math.min(Number(cluster.w)||0,Number(cluster.h)||0);
      if(long<0.10||long>2.4||short<0.04) continue;
      const d=Math.hypot(cluster.cx-point.x,cluster.cy-point.y);
      const contains = Math.abs(point.x-cluster.cx)<=Math.max(0.12,(cluster.w||0)/2+0.12)
        && Math.abs(point.y-cluster.cy)<=Math.max(0.12,(cluster.h||0)/2+0.12);
      const partBonus=Math.min(0.45,(cluster.parts?.length||1)*0.045);
      const score=(contains?2.2:0.8)-d*1.4+partBonus-Math.max(0,long-1.6)*0.25;
      if(score>bestScore){best=cluster;bestScore=score;}
    }
  }
  return best;
}

export function matchGeometryToLegend(cluster, dictionary, options = {}) {
  if(!cluster) return null;
  const entries=(dictionary?.entries||[]).filter((entry)=>entry?.prototype);
  if(!entries.length) return null;
  return resolveGeometryMatch(cluster, entries, {
    planType: options.planType || "",
    strictSize: false,
    bodyOnly: false,
    nearby: options.nearby || [],
  });
}

export function attachProjectPrototypes(dictionary, prototypes = []) {
  const entries = (dictionary?.entries || []).map((entry) => ({ ...entry }));
  const byCode = new Map(entries.map((entry) => [compact(entry.code), entry]));
  for (const item of prototypes || []) {
    const code = compact(item?.code);
    const entry = byCode.get(code);
    if (!entry || !item?.prototype) continue;
    const proto = item.prototype;
    const long = Math.max(Number(proto.w) || 0, Number(proto.h) || 0);
    if (long < 0.35 || long > 2.2) continue;
    entry.prototypes = entry.prototypes || (entry.prototype ? [entry.prototype] : []);
    if (entry.prototypes.length < 3 && !entry.prototypes.some((existing) => geometrySimilarity(proto, existing) >= 0.96)) {
      entry.prototypes.push(proto);
    }
    if (!entry.prototype || entry.prototype.fragmentSymbol) entry.prototype = proto;
  }
  return { ...dictionary, entries };
}
