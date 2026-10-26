/** Shared, dependency-free repair job contract. No execution is performed in a browser. */
export const REPAIR_STATES = Object.freeze([
  "queued", "reproducing", "diagnosing", "implementing", "testing",
  "awaiting_approval", "deploying", "verifying", "resolved", "blocked", "rolled_back",
]);
export const TERMINAL_STATES = Object.freeze(["resolved", "blocked", "rolled_back"]);
const ALLOWED = Object.freeze({
  queued: ["reproducing", "blocked"],
  reproducing: ["diagnosing", "blocked"],
  diagnosing: ["implementing", "blocked"],
  implementing: ["testing", "blocked"],
  testing: ["implementing", "awaiting_approval", "blocked"],
  awaiting_approval: ["deploying", "blocked"],
  deploying: ["verifying", "rolled_back", "blocked"],
  verifying: ["resolved", "implementing", "rolled_back", "blocked"],
  resolved: [], blocked: [], rolled_back: [],
});
export function validateRepairJob(job) {
  if (!job || typeof job !== "object") throw new TypeError("Job required");
  if (!REPAIR_STATES.includes(job.status)) throw new Error("Invalid repair status");
  if (typeof job.id !== "string" || !job.id.trim()) throw new Error("Missing job ID");
  if (typeof job.app !== "string" || !job.app.trim()) throw new Error("Missing app");
  if (typeof job.reporterId !== "string" || !job.reporterId.trim()) throw new Error("Missing reporter");
  return true;
}
export function transitionRepairJob(job, nextStatus, evidence = {}) {
  validateRepairJob(job);
  if (!ALLOWED[job.status].includes(nextStatus)) throw new Error("Invalid repair transition");
  if (nextStatus === "resolved" && (!evidence.acceptancePassed || !evidence.browserVerified))
    throw new Error("Resolution requires passing acceptance tests and browser verification");
  return { ...job, status: nextStatus, updatedAt: new Date().toISOString(),
    history: [...(job.history || []), { from: job.status, to: nextStatus, at: new Date().toISOString() }] };
}
