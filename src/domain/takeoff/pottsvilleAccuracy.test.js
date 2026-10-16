import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatAccuracyReport, scoreTakeoffAccuracy } from "./accuracyHarness.js";
import { LABEL_AUTHORITY, pottsvilleTokenTruth } from "./labeledTruth.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

export function pottsvilleGroundTruth(pages = []) {
  return pottsvilleTokenTruth(pages, ALLOWED);
}

const raw = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/pottsville-electrical.json"),
  "utf8",
));
const fixture = {
  ...raw,
  groundTruth: pottsvilleGroundTruth(raw.pages),
  labelAuthority: LABEL_AUTHORITY.DERIVED_TOKENS,
};

assert(fixture.groundTruth.length >= 8, `Pottsville fixture must include real plan devices, got ${fixture.groundTruth.length}`);
assert(!fixture.pages.some((page) => /legend|schedule|oneline|riser|detail/i.test(page.kind) && page.kind === "drawing"), "P/S/C and legend sheets stay out of the plan count");
assert(fixture.groundTruth.every((device) => device.sheet !== 48), "legend sheet tokens are not ground truth");

const score = scoreTakeoffAccuracy(fixture, { scoreTypes: ALLOWED });
console.log(formatAccuracyReport(score));
if (score.unmatchedTruth.length) {
  console.log("missed", score.unmatchedTruth.slice(0, 16).map((item) => `${item.type}@${item.sheet}:${item.x},${item.y}`).join(" "));
}
if (score.typedExtraMarks.length) {
  console.log("typed extra", score.typedExtraMarks.slice(0, 16).map((item) => `${item.typeCode || item.symbol}@${item.sheet}:${Number(item.x).toFixed(1)},${Number(item.y).toFixed(1)}`).join(" "));
}

assert(score.labelAuthority === LABEL_AUTHORITY.DERIVED_TOKENS, "Pottsville OS/WP labels come from printed tokens, not independent body labels");
assert(score.found === 15 && score.truth === 15, `typed OS/WP recall lock is 15/15, got ${score.found}/${score.truth}`);
assert(score.typedFalsePositives === 0, `typed OS/WP extras must stay 0, got ${score.typedFalsePositives}`);
assert(score.markerAccuracy === 1, `typed OS/WP markers must sit on the token/body, got ${(score.markerAccuracy * 100).toFixed(2)}%`);
assert(score.canClaimThreshold === false, "derived-token 15/15 is a regression, not a 99% claim");
assert(score.falsePositives > 0, "unfiltered bid extras must stay visible so precision is not laundered");

if (!process.exitCode) console.log("pottsville derived-token regression recorded");
