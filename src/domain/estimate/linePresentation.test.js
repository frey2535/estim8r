import assert from "node:assert/strict";
import { estimateLineLaborNotice, estimateLineTitle } from "./linePresentation.js";

assert.equal(estimateLineTitle({}, null), "New line");
assert.equal(
  estimateLineTitle({ description: "Lights that shone upon a roadside sign" }, null),
  "Lights that shone upon a roadside sign",
);
assert.equal(
  estimateLineTitle(
    { description: "Lights that shone upon a roadside sign" },
    { item_name: "Flood light", size: "150W", unit: "EA" },
  ),
  "Flood light · 150W · EA",
);
assert.equal(
  estimateLineTitle({}, { item_name: '1/2" EMT', size: '1/2"', unit: "LF" }),
  '1/2" EMT · 1/2" · LF',
);

assert.equal(estimateLineLaborNotice({ laborItemId: "EL-00039", laborMatchStatus: "matched" }), null);
assert.equal(estimateLineLaborNotice({ laborMatchStatus: "unmatched" }).badge, "No library match");
assert.equal(estimateLineLaborNotice({}).badge, "No labor pick");
assert.equal(estimateLineLaborNotice({ laborMatchStatus: "overridden" }).badge, "Override");
assert.equal(
  estimateLineLaborNotice({
    laborMatchStatus: "matched",
    laborSource: "EL-01527",
    laborSelection: { verificationStatus: "unverified" },
  }).tone,
  "unverified",
);

console.log("linePresentation tests passed");
