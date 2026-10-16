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
assert(soccer.found === 20, `Phase 1 Soccer recall lock is 20/129, got ${soccer.found}/${soccer.truth}`);
assert(soccer.falsePositives === 25, `Phase 1 Soccer extras lock is 25, got ${soccer.falsePositives}`);
assert(soccer.canClaimThreshold === false, "Soccer 20/129 cannot claim 99%");
assert(soccer.meetsDetection === false, "Soccer does not pass the professional detection gate");

assert(pottsville, "Pottsville derived-token OS/WP regression is in the baseline");
assert(pottsville.labelAuthority === LABEL_AUTHORITY.DERIVED_TOKENS, "Pottsville OS/WP tokens are not independently labeled bodies");
assert(pottsville.found === 15 && pottsville.truth === 15, `Pottsville typed recall lock is 15/15, got ${pottsville.found}/${pottsville.truth}`);
assert(pottsville.canClaimThreshold === false, "derived-token 15/15 cannot claim 99%");

assert(stub.labelAuthority === LABEL_AUTHORITY.SYNTHETIC, "one-device WP fixture is a synthetic stub");
assert(stub.truth === 1, "stub remains a single labeled WP");
assert(stub.canClaimThreshold === false, "stub 1.00/1.00 cannot claim 99%");

assert(baseline.anyThresholdClaim === false, "no current fixture supports a 99% claim");
assert(baseline.zoom.ok, "zoom/pan/pinch budget regressions stay green");
assert(baseline.independent.length === 1, "only Soccer is treated as independently labeled in Phase 1");

if (!process.exitCode) console.log("phase 1 takeoff baseline recorded");
