import { applyTypicalMultiplier, assemblyBindingForMark, buildLiveTakeoffIndex, revisionDelta } from "./liveLinkedTakeoff.js";
function assert(v,m){ if(!v){ console.error("FAIL",m); process.exitCode=1; } }
const marks=[
 {id:"a",sheet:1,category:"Receptacles",symbolLabel:"Duplex receptacle",typicalMultiplier:4,x:10,y:10},
 {id:"b",sheet:1,category:"Receptacles",symbolLabel:"Duplex receptacle",x:20,y:20},
];
const rows=applyTypicalMultiplier([{category:"Receptacles",symbol:"Duplex receptacle",count:2}],marks);
assert(rows[0].count===5,"typical multiplier produces effective quantity");
assert(rows[0].rawCount===2,"raw count retained");
assert(assemblyBindingForMark(marks[0]).assemblyId==="device-duplex-receptacle","duplex assembly binding");
const index=buildLiveTakeoffIndex(marks);
assert(index.byMarkId.a.multiplier===4,"live index stores multiplier");
const delta=revisionDelta([marks[0]],[marks[0],marks[1]]);
assert(delta.added.length===1 && delta.removed.length===0,"revision delta detects added mark");
if(!process.exitCode) console.log("live linked takeoff checks passed");
