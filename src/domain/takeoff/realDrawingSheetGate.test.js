import { shouldScanWithDictionary } from "./aiTakeoff.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const dictionary = {
  entries: [
    { code: "L1", symbol: { abbr: "L1", category: "Lighting" } },
    { code: "GFI", symbol: { abbr: "GFI", category: "Receptacles" } },
  ],
};

const weakTitleRealPlan = {
  page: 7,
  kind: "other",
  sheetId: "",
  title: "",
  tokens: [
    { text: "L1", x: 30, y: 30 },
    { text: "ROOM", x: 40, y: 40 },
  ],
  paths: Array.from({ length: 30 }, (_, index) => ({
    cx: 20 + (index % 6),
    cy: 20 + Math.floor(index / 6),
    w: 0.5,
    h: 0.5,
    kind: "rect",
  })),
};

assert(
  shouldScanWithDictionary(weakTitleRealPlan, "electrical", dictionary),
  "known project legend code on a geometry-bearing plan must prevent silent sheet exclusion",
);

const architectural = {
  ...weakTitleRealPlan,
  sheetId: "A101",
};
assert(
  !shouldScanWithDictionary(architectural, "electrical", dictionary),
  "explicit non-electrical sheet IDs must remain excluded",
);

if (!process.exitCode) console.log("dictionary-aware sheet gating checks passed");
