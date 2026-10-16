import { collectTakeoffBaseline, formatBaselineMarkdown } from "./takeoffBaseline.js";
import { LABEL_AUTHORITY } from "./labeledTruth.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const baseline = collectTakeoffBaseline();
console.log(formatBaselineMarkdown(baseline));

const soccer = baseline.cases.find((item) => item.name === "soccer-pavilion-independent");
const pottsville = baseline.cases.find((item) => item.name === "pottsville-os-wp-derived-tokens");
const stub = baseline.cases.find((item) => item.name === "synthetic-wp-stub");

assert(soccer, "Soccer independent corpus is in the baseline");
assert(soccer.labelAuthority === LABEL_AUTHORITY.INDEPENDENT, "Soccer is the independently labeled commercial set");
assert(soccer.truth === 129, `Soccer labeled quantity stays 129, got ${soccer.truth}`);
assert(soccer.found === 129, `Phase 2 Soccer recall lock is 129/129, got ${soccer.found}/${soccer.truth}`);
assert(soccer.falsePositives === 0, `Phase 2 Soccer extras lock is 0, got ${soccer.falsePositives}`);
assert(soccer.worstTypeRecall === 1, `Phase 2 worst-type lock is 100%, got ${(soccer.worstTypeRecall * 100).toFixed(2)}%`);
assert(soccer.markerAccuracy >= 0.99, `Phase 2 marker lock is ≥99%, got ${(soccer.markerAccuracy * 100).toFixed(2)}%`);
assert(soccer.canClaimThreshold === true, "independently labeled Soccer 129/129 with ≥99% markers may claim the threshold");
assert(soccer.meetsDetection === true, "Soccer now meets the professional detection gate");

assert(pottsville, "Pottsville derived-token OS/WP regression is in the baseline");
assert(pottsville.labelAuthority === LABEL_AUTHORITY.DERIVED_TOKENS, "Pottsville OS/WP tokens are not independently labeled bodies");
assert(pottsville.found === 15 && pottsville.truth === 15, `Pottsville typed recall lock is 15/15, got ${pottsville.found}/${pottsville.truth}`);
assert(pottsville.canClaimThreshold === false, "derived-token 15/15 cannot claim 99%");

assert(stub.labelAuthority === LABEL_AUTHORITY.SYNTHETIC, "one-device WP fixture is a synthetic stub");
assert(stub.truth === 1, "stub remains a single labeled WP");
assert(stub.canClaimThreshold === false, "stub 1.00/1.00 cannot claim 99%");

assert(baseline.anyThresholdClaim === true, "independently labeled Soccer now supports a 99% claim");
assert(baseline.zoom.ok, "zoom/pan/pinch budget regressions stay green");
assert(baseline.independent.length === 1, "only Soccer is treated as independently labeled in Phase 1");

if (!process.exitCode) console.log("phase 2 takeoff baseline recorded");
