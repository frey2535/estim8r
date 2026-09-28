import { isChromeLabel, screenForPath } from "./ownerChatEvidence.js";

export function wantsCorrection(text) {
  return /\b(fix|correct|repair|patch|apply|change the code|make the change)\b/i.test(String(text || ""));
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

function screenContext(evidence, inspection) {
  const bits = [];
  if (inspection.heading) bits.push(`You're on ${inspection.screen}: “${inspection.heading}”.`);
  else bits.push(`You're on ${inspection.screen}.`);
  if (evidence.estimate?.present) {
    const name = evidence.estimate.projectName ? ` “${evidence.estimate.projectName}”` : "";
    bits.push(`The active estimate${name} has ${evidence.estimate.lineCount} line${evidence.estimate.lineCount === 1 ? "" : "s"}.`);
  } else if (inspection.screen === "Estimates") {
    bits.push("This is the Estimates folder for saved jobs.");
  }
  if (evidence.takeoff?.present) {
    bits.push(`A takeoff drawing is open (${evidence.takeoff.name}).`);
  } else if (inspection.screen === "Takeoff") {
    bits.push("No drawing is loaded on Takeoff yet.");
  }
  return bits.join(" ");
}

function answerForAsk(message, evidence, inspection) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  if (/what (is|are) this (page|screen|view)/i.test(text) || /what is this\??$/i.test(text)) {
    if (inspection.screen === "Estimates") {
      return `This page is the Estimates folder. Use New Estimate to start a bid, or open a saved project.`;
    }
    if (inspection.screen === "Takeoff") {
      return `This page is Takeoff — upload a drawing to count devices and conduit.`;
    }
    if (inspection.screen === "Estimate builder") {
      return `This page is the estimate builder — header, lines, labor, and markup for the current job.`;
    }
    return `This page is ${inspection.screen}.`;
  }
  if (/how (do i|to) (add|create|start|new).*(estimate|bid)/i.test(text)) {
    return "Use New Estimate in the header, or upload drawings on Takeoff and save after the estimate exists.";
  }
  if (/how (do i|to).*(takeoff|upload|drawing)/i.test(text)) {
    return "Open Takeoff and choose a PDF or image. Counts land on the estimate after you save.";
  }
  if (/delete/i.test(lower)) {
    return "Delete on Estimates is the folder remove button. It is not a validation error.";
  }
  if (inspection.screen === "Estimates" && /folder|saved|project/i.test(lower)) {
    return evidence.estimate?.present
      ? `A saved estimate is available${evidence.estimate.projectName ? ` (${evidence.estimate.projectName})` : ""}.`
      : "The folder is empty until you save a New Estimate or a takeoff-backed estimate.";
  }
  return `I can work from this ${inspection.screen} tab — ask about the page, a real error, or a correction.`;
}

function formatFindings(findings) {
  return findings.map((finding) => `• ${finding.file} — ${finding.what}`).join("\n");
}

export function formatOwnerReply(message, evidence = {}, inspection, { sessionAttached = false, queued = false } = {}) {
  const asked = String(message || "").trim();
  const intent = inspection?.intent || classifyOwnerMessage(asked);
  const context = screenContext(evidence, inspection);
  const lines = [];
  lines.push(`You asked: “${asked || "…"}”.`);
  lines.push(context);

  if (intent === "inspect") {
    if (!inspection.findings.length) {
      lines.push("I don't see a console error, failed request, or validation failure on this tab. I will not treat Delete, headings, or other chrome as errors.");
    } else {
      lines.push("Confirmed from this tab (console, failed request, or validation — not chrome):");
      lines.push(formatFindings(inspection.findings));
    }
  } else if (intent === "fix") {
    lines.push(answerForAsk(asked, evidence, inspection));
    if (inspection.findings.length) {
      lines.push("Related confirmed signals:");
      lines.push(formatFindings(inspection.findings));
    }
    if (queued && sessionAttached) {
      lines.push("That correction is queued on this Cursor Project session. No API key and no Cloud Agents billing.");
    } else if (!sessionAttached) {
      lines.push("I can talk through the change, but this tab is not attached to a Cursor Project session so I cannot edit Estim8r from here.");
    }
  } else {
    lines.push(answerForAsk(asked, evidence, inspection));
  }

  return lines.join("\n");
}

export function formatInspectionReply(inspection, options = {}) {
  return formatOwnerReply(
    inspection?.wantsFix ? "fix this" : "what's wrong",
    { visible: { heading: inspection?.heading } },
    inspection,
    options,
  );
}
