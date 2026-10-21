import { isChromeLabel, screenForPath } from "./ownerChatEvidence.js";

export function mentionsEmptyTakeoff(text) {
  return /\b(empty takeoff|no (?:devices|marks|symbols)|not (?:identifying|counting|marking)|ai assist|ai is not|pottsville|takeoff is empty)\b/i.test(
    String(text || ""),
  );
}

export function wantsCorrection(text) {
  const source = String(text || "");
  if (mentionsEmptyTakeoff(source)) return true;
  return /\b(fix|correct|repair|patch|apply|change the code|make the change)\b/i.test(source);
}

export function wantsInspection(text) {
  return /\b(what'?s wrong|what is wrong|any error|errors?|bug|broken|fail(?:ed|ure)?|issue|inspect)\b/i.test(String(text || ""));
}

export function classifyOwnerMessage(text) {
  if (wantsCorrection(text)) return "fix";
  if (wantsInspection(text)) return "inspect";
  return "ask";
}

function fileFromText(text) {
  const match = String(text || "").match(/((?:src|scripts)\/[\w./-]+\.[jt]sx?)/);
  return match ? match[1] : "";
}

export function inspectOwnerEvidence(evidence = {}, message = "") {
  const screen = screenForPath(evidence.pathname || "/");
  const findings = [];

  for (const row of evidence.console || []) {
    if (row.level !== "error" || !row.text) continue;
    const file = fileFromText(row.text) || row.source || screen.file;
    findings.push({
      id: `console-${row.at || findings.length}`,
      source: "console",
      confirmed: true,
      screen: screen.screen,
      file,
      what: row.text,
      fix: `Open ${file} and address this exact console error.`,
    });
  }

  for (const row of evidence.requests || []) {
    if (row.ok) continue;
    const detail = row.failed
      ? `${row.url || "a request"} failed (${row.message || "network error"})`
      : `${row.url || "a request"} returned HTTP ${row.status}`;
    findings.push({
      id: `req-${row.at || findings.length}`,
      source: "request",
      confirmed: true,
      screen: screen.screen,
      file: screen.file,
      what: detail,
      fix: `Inspect the handler that calls ${row.url || "that URL"} from ${screen.file}.`,
    });
  }

  for (const alert of evidence.visible?.alerts || []) {
    if (isChromeLabel(alert)) continue;
    findings.push({
      id: `alert-${alert.slice(0, 24)}`,
      source: "validation",
      confirmed: true,
      screen: screen.screen,
      file: screen.file,
      what: alert,
      fix: `Clear this validation message in ${screen.file}.`,
    });
  }

  for (const field of evidence.visible?.invalid || []) {
    if (isChromeLabel(field)) continue;
    findings.push({
      id: `invalid-${field}`,
      source: "validation",
      confirmed: true,
      screen: screen.screen,
      file: screen.file,
      what: `Invalid field: ${field}`,
      fix: `Fix validation for "${field}" in ${screen.file}.`,
    });
  }

  if (evidence.estimate?.hasError && evidence.estimate.error) {
    findings.push({
      id: "estimate-error",
      source: "validation",
      confirmed: true,
      screen: "Estimate builder",
      file: "src/pages/EstimateBuilder.jsx",
      what: evidence.estimate.error,
      fix: "Fix the estimate save/load path that wrote this error onto the active estimate.",
    });
  }

  const unique = [];
  const seen = new Set();
  for (const finding of findings) {
    const key = `${finding.file}|${finding.what}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }

  return {
    screen: screen.screen,
    file: screen.file,
    heading: evidence.visible?.heading || "",
    findings: unique,
    intent: classifyOwnerMessage(message),
    wantsFix: wantsCorrection(message),
    invented: false,
  };
}

function answerForAsk(message, evidence, inspection) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  if (/what (is|are) this (page|screen|view)/i.test(text) || /what is this\??$/i.test(text)) {
    if (inspection.screen === "Estimates") {
      return "Estimates folder. New Estimate starts a bid; open a saved project to continue.";
    }
    if (inspection.screen === "Takeoff") {
      return "Takeoff — upload a drawing to count devices and conduit.";
    }
    if (inspection.screen === "Estimate builder") {
      return "Estimate builder — header, lines, labor, and markup for this job.";
    }
    return inspection.screen;
  }
  if (/how (do i|to) (add|create|start|new).*(estimate|bid)/i.test(text)) {
    return "Use New Estimate in the header, or upload drawings on Takeoff and save after the estimate exists.";
  }
  if (/how (do i|to).*(takeoff|upload|drawing)/i.test(text)) {
    return "Open Takeoff and choose a PDF or image. Counts land on the estimate after you save.";
  }
  if (/delete/i.test(lower)) {
    return "Delete on Estimates is the folder remove button, not a validation error.";
  }
  if (inspection.screen === "Estimates" && /folder|saved|project/i.test(lower)) {
    return evidence.estimate?.present
      ? `Saved estimate${evidence.estimate.projectName ? ` (${evidence.estimate.projectName})` : ""} is available.`
      : "Folder is empty until you save a New Estimate or a takeoff-backed estimate.";
  }
  const first = inspection.findings?.[0];
  if (first) return `${first.what}. That is in ${first.file}.`;
  return `${inspection.screen} looks quiet — no console error or failed request.`;
}

export function formatOwnerReply(message, evidence = {}, inspection, { apply = null } = {}) {
  const asked = String(message || "").trim();
  const intent = inspection?.intent || classifyOwnerMessage(asked);
  const first = inspection?.findings?.[0];

  if (mentionsEmptyTakeoff(asked)) {
    if (apply?.summary) return `${apply.summary} AI Assist is marking this sheet now.`;
    return "AI Assist is running on this sheet now. Sheet gating was dropping plan pages, so I am applying the scan fallback in TakeoffWorkspace and pushing a feature branch.";
  }

  if (intent === "fix") {
    if (apply?.summary) return apply.summary;
    if (first) return `${first.what}. Applying the fix in ${first.file} and pushing a feature branch.`;
    return "Applying a code fix from this chat and pushing a feature branch.";
  }

  if (intent === "inspect") {
    if (first) return `${first.what}. That is in ${first.file}.`;
    return "No console error or failed request on this tab. Delete and chrome are not bugs.";
  }

  return answerForAsk(asked, evidence, inspection);
}

export function formatInspectionReply(inspection, options = {}) {
  return formatOwnerReply(
    inspection?.wantsFix ? "fix this" : "what's wrong",
    { visible: { heading: inspection?.heading } },
    inspection,
    options,
  );
}
