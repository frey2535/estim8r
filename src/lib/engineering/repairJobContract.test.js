import test from "node:test";
import assert from "node:assert/strict";
import { validateRepairJob, transitionRepairJob, TERMINAL_STATES } from "./repairJobContract.js";
const base = { id: "job-1", app: "estim8r", reporterId: "owner-1", status: "queued" };
test("validates identity and status", () => {
  assert.equal(validateRepairJob(base), true);
  assert.throws(() => validateRepairJob({ ...base, reporterId: "" }), /reporter/);
  assert.throws(() => validateRepairJob({ ...base, status: "unknown" }), /status/);
});
test("rejects illegal transitions", () => {
  assert.throws(() => transitionRepairJob(base, "resolved"), /transition/);
  assert.throws(() => transitionRepairJob(base, "deploying"), /transition/);
});
test("records a valid state change without mutating original", () => {
  const next = transitionRepairJob(base, "reproducing");
  assert.equal(next.status, "reproducing");
  assert.equal(next.history.length, 1);
  assert.equal(base.status, "queued");
});
test("requires verification evidence before resolving", () => {
  const verifying = { ...base, status: "verifying" };
  assert.throws(() => transitionRepairJob(verifying, "resolved", { acceptancePassed: true }), /Resolution/);
  assert.throws(() => transitionRepairJob(verifying, "resolved", { browserVerified: true }), /Resolution/);
  assert.equal(transitionRepairJob(verifying, "resolved", { acceptancePassed: true, browserVerified: true }).status, "resolved");
  assert.deepEqual(TERMINAL_STATES, ["resolved", "blocked", "rolled_back"]);
});
