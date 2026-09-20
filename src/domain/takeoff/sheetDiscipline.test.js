import {
  classifySheetDiscipline,
  pageMatchesTrade,
  parseSheetId,
  tradeFromSheetId,
} from "./sheetDiscipline.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(parseSheetId("P1.01") === "P1.01", "P1.01 sheet id");
assert(parseSheetId("C0.04") === "C0.04", "C0.04 sheet id");
assert(parseSheetId("E-2.01") === "E2.01", "E-2.01 sheet id");
assert(tradeFromSheetId("P1.01") === "plumbing", "P prefix is plumbing");
assert(tradeFromSheetId("S1.01") === "structural", "S prefix is structural");
assert(tradeFromSheetId("C0.04") === "civil", "C prefix is civil");
assert(tradeFromSheetId("E0.02") === "electrical", "E prefix is electrical");
assert(tradeFromSheetId("M0.01") === "mechanical", "M prefix is mechanical");

assert(
  classifySheetDiscipline("UNDERGROUND FLOOR PLAN - PLUMBING", [{ text: "P1.01", x: 92, y: 94 }]) === "plumbing",
  "P1.01 plumbing plan",
);
assert(
  classifySheetDiscipline("PLUMBING GENERAL NOTES AND LEGENDS", [{ text: "P0.01", x: 90, y: 93 }]) === "plumbing",
  "P0.01 plumbing legend",
);
assert(
  classifySheetDiscipline("FOUNDATION AND ROOF FRAMING PLAN", [{ text: "S1.01", x: 91, y: 94 }]) === "structural",
  "S1.01 structural",
);
assert(
  classifySheetDiscipline("CONSTRUCTION MANAGEMENT PLAN", [{ text: "C0.04", x: 90, y: 94 }]) === "civil",
  "C0.04 construction management is civil",
);
assert(
  classifySheetDiscipline("ELECTRICAL SITE PLAN", [{ text: "E0.02", x: 90, y: 94 }]) === "electrical",
  "E0.02 electrical site",
);
assert(
  classifySheetDiscipline("LIGHTING PLAN SEE P1.01", [{ text: "E1.01", x: 92, y: 94 }, { text: "SEE P1.01", x: 20, y: 20 }]) === "electrical",
  "title-block E1.01 wins over a plumbing reference",
);
assert(classifySheetDiscipline("GFI LP 1x4 TRANSFORMER") === "unknown", "device callouts alone stay unknown");

assert(pageMatchesTrade({ discipline: "plumbing" }, "electrical") === false, "plumbing is not electrical");
assert(pageMatchesTrade({ discipline: "structural" }, "electrical") === false, "structural is not electrical");
assert(pageMatchesTrade({ discipline: "civil" }, "electrical") === false, "civil is not electrical");
assert(pageMatchesTrade({ discipline: "mechanical" }, "electrical") === false, "mechanical is not electrical");
assert(pageMatchesTrade({ discipline: "electrical" }, "electrical") === true, "electrical matches electrical");
assert(pageMatchesTrade({ discipline: "unknown" }, "electrical") === true, "unknown sheets still scan");
assert(pageMatchesTrade({ discipline: "mechanical" }, "hvac") === true, "hvac can read mechanical sheets");

if (!process.exitCode) console.log("sheet discipline checks passed");
