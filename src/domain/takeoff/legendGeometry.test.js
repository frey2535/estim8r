import { clusterSymbolGeometry, geometrySimilarity, scanPageByLegendGeometry } from "./legendGeometry.js";
function assert(v,m){if(!v){console.error("FAIL",m);process.exitCode=1;}}
const part=(cx,cy,w,h,kind="rect")=>({cx,cy,w,h,kind,source:"vector",outline:{kind,source:"vector",w,h,points:[]}});
const legendParts=[part(10,10,.5,.5,"circle"),part(10.45,10,.3,.12)];
const proto=clusterSymbolGeometry(legendParts[0],legendParts,{maxSpan:2});
const planParts=[part(40,30,.5,.5,"circle"),part(40.45,30,.3,.12)];
const match=clusterSymbolGeometry(planParts[0],planParts,{maxSpan:2});
assert(proto.outline.kind==="composite","composite outline retained");
assert(proto.outline.parts.length===2,"all symbol primitives retained");
assert(geometrySimilarity(proto,match)>.9,"translated identical symbol matches");
const dictionary={entries:[{code:"R",symbol:{id:"duplex",label:"Duplex receptacle",category:"Receptacles"},prototype:proto}]};
const hits=scanPageByLegendGeometry({paths:planParts},dictionary,{threshold:.8});
assert(hits.length===1,"unlabeled plan symbol found from legend geometry");
if(!process.exitCode)console.log("legend geometry checks passed");
