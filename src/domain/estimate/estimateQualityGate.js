import { auditEstimateCompleteness } from "./estimatingIntelligence.js";
import { materialPriceStatus } from "./materialPricing.js";

export function estimateQualityGate({ lines = [], checklist = [], itemized = false, trueTakeoff = null } = {}) {
  const included = lines.filter((line) => !itemized || line.included !== false);
  const issues = [];
  const completeness = auditEstimateCompleteness(checklist);
  if (!completeness.bidReady) issues.push({ severity: "block", code: "completeness", message: completeness.missing.length + " required bid-readiness items are not addressed." });

  const unmatchedLabor = included.filter((line) => Number(line.quantity) > 0 && !line.laborItemId && !(Number(line.laborMhPerUnit) > 0));
  if (unmatchedLabor.length) issues.push({ severity: "block", code: "labor", message: unmatchedLabor.length + " estimate lines have quantity but no labor basis." });

  const materialLines = included.filter((line) => Number(line.materialUnitCost) > 0);
  const stalePrices = materialLines.filter((line) => materialPriceStatus(line.materialPriceMeta).state === "stale");
  const undocumentedPrices = materialLines.filter((line) => ["missing-source", "missing-date"].includes(materialPriceStatus(line.materialPriceMeta).state));
  if (stalePrices.length) issues.push({ severity: "warn", code: "stale-prices", message: stalePrices.length + " material prices are older than the freshness threshold." });
  if (undocumentedPrices.length) issues.push({ severity: "warn", code: "price-provenance", message: undocumentedPrices.length + " material prices are missing source or date." });

  const unresolvedAi = included.reduce((sum, line) => sum + Number(line.sourceAudit?.unresolvedAi || 0), 0);
  if (unresolvedAi) issues.push({ severity: "block", code: "ai-review", message: unresolvedAi + " AI takeoff sources remain unresolved." });

  const takeoffWarnings = trueTakeoff?.analysis?.warnings || [];
  if (takeoffWarnings.length) issues.push({ severity: "block", code: "takeoff", message: takeoffWarnings.length + " takeoff bid-lock warnings remain." });

  const blockers = issues.filter((issue) => issue.severity === "block");
  return { ready: blockers.length === 0, issues, blockers, warnings: issues.filter((issue) => issue.severity === "warn"), counts: { lines: included.length, unmatchedLabor: unmatchedLabor.length, stalePrices: stalePrices.length, undocumentedPrices: undocumentedPrices.length, unresolvedAi, takeoffWarnings: takeoffWarnings.length } };
}
