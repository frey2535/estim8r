import { laborItemLabel } from "./manualLineLabor.js";

export function estimateLineTitle(row, laborItem) {
  const pick = laborItemLabel(laborItem);
  const description = String(row?.description || "").trim();
  return pick || description || "New line";
}

export function estimateLineLaborNotice(row) {
  if (row?.laborMatchStatus === "unmatched") {
    return {
      tone: "unmatched",
      badge: "No library match",
      text: "Nothing in the labor library fits this pick. MH/unit left at 0. Not a NECA rate.",
    };
  }
  if (row?.laborMatchStatus === "overridden") {
    return {
      tone: "overridden",
      badge: "Override",
      text: "Estimator override. Labor $ still follows the selected class unless you edit Labor $/hr.",
    };
  }
  if (row?.laborMatchStatus === "matched" && row.laborSource) {
    const verification = row.laborSelection?.verificationStatus || "";
    return {
      tone: verification && verification !== "verified" ? "unverified" : "matched",
      badge: verification || "Matched",
      text: `${row.laborSource}${verification ? ` · ${verification}` : ""}`,
    };
  }
  if (!row?.laborItemId) {
    return {
      tone: "empty",
      badge: "No labor pick",
      text: "Pick a Labor tab item to fill MH/unit. Job descriptions do not invent hours.",
    };
  }
  return null;
}
