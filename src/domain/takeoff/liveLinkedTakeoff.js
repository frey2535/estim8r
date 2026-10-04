import { isPersistedPlanDetection, isNonPlanSheetKind } from "./symbolDetection.js";

const DEFAULT_BINDINGS = [
  { match: /duplex|receptacle|outlet/i, assemblyId: "device-duplex-receptacle" },
  { match: /switch/i, assemblyId: "device-switch" },
  { match: /light|fixture|troffer|luminaire|downlight|pendant/i, assemblyId: "device-light-fixture" },
];

export function takeoffContext(mark = {}) {
  return { sheet: mark.sheet || 1, area: mark.area || mark.zone || "", phase: mark.phase || "", system: mark.system || mark.category || "", alternate: mark.alternate || "", costCode: mark.costCode || "" };
}
export function takeoffMultiplier(mark = {}) {
  const n = Number(mark.typicalMultiplier ?? mark.multiplier ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
export function assemblyBindingForMark(mark = {}, bindings = DEFAULT_BINDINGS) {
  if (mark.assemblyId) return { assemblyId: mark.assemblyId, source: "assigned" };
  const text = [mark.typeCode, mark.abbr, mark.symbol, mark.symbolLabel, mark.category].filter(Boolean).join(" ");
  const hit = bindings.find((row) => row.match?.test?.(text));
  return hit ? { assemblyId: hit.assemblyId, source: "automatic" } : null;
}
export function buildLiveTakeoffIndex(marks = []) {
  const byMarkId = {};
  for (const mark of marks) if (mark?.id) byMarkId[mark.id] = { markId: mark.id, objectId: mark.objectId || mark.sourceObjectId || "", assembly: assemblyBindingForMark(mark), multiplier: takeoffMultiplier(mark), context: takeoffContext(mark), reviewStatus: mark.reviewStatus || "", source: mark.source || "manual" };
  return { version: 1, byMarkId };
}
export function applyTypicalMultiplier(rows = [], marks = []) {
  const byKey = new Map();
  for (const mark of marks) {
    const key = String(mark.category || "").toLowerCase()+"|"+String(mark.symbolLabel || mark.symbol || "").toLowerCase();
    const v = byKey.get(key) || { raw: 0, effective: 0 }; v.raw += 1; v.effective += takeoffMultiplier(mark); byKey.set(key, v);
  }
  return rows.map((row) => {
    const key = String(row.category || "").toLowerCase()+"|"+String(row.symbol || "").toLowerCase(), v = byKey.get(key);
    return v && row.count > 0 ? { ...row, count: v.effective, rawCount: v.raw, multiplierApplied: v.effective !== v.raw } : row;
  });
}
export function revisionDelta(previous = [], current = []) {
  const key = (m) => m.objectId || m.sourceObjectId || [m.sheet||1,m.typeCode||m.abbr||m.symbol,Number(m.x||0).toFixed(2),Number(m.y||0).toFixed(2)].join("|");
  const before = new Map(previous.map((m)=>[key(m),m])), after = new Map(current.map((m)=>[key(m),m]));
  return { added:[...after].filter(([k])=>!before.has(k)).map(([,m])=>m), removed:[...before].filter(([k])=>!after.has(k)).map(([,m])=>m), unchanged:[...after].filter(([k])=>before.has(k)).map(([,m])=>m) };
}
export function overlayBidMarks(marks = [], pageKinds = {}) {
  return (marks || []).filter((mark) => {
    if (mark?.type === "count" || mark?.type === "drop") {
      return isPersistedPlanDetection(mark, pageKinds);
    }
    const drawn = (mark?.tool === "conduit" || mark?.type === "homerun" || mark?.type === "route")
      && Array.isArray(mark.points)
      && mark.points.length >= 2;
    if (!drawn) return false;
    if (mark.source === "ai") return false;
    return !isNonPlanSheetKind(pageKinds[mark.sheet]);
  });
}

export function liveEstimateSourcesForRow(row, marks = []) {
  const key = String(row.category || "").toLowerCase()+"|"+String(row.symbol || "").toLowerCase();
  return marks.filter((m)=>String(m.category||"").toLowerCase()+"|"+String(m.symbolLabel||m.symbol||"").toLowerCase()===key)
    .map((m)=>({markId:m.id,objectId:m.objectId||m.sourceObjectId||"",assembly:assemblyBindingForMark(m),multiplier:takeoffMultiplier(m),context:takeoffContext(m)}));
}
