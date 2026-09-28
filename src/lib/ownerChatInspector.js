import { screenForPath } from "./ownerChatEvidence.js";

export function wantsCorrection(text) {
  return /\b(fix|correct|repair|patch|apply|change the code|make the change)\b/i.test(String(text || ""));
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
      confirmed: true,
      screen: screen.screen,
      file,
      what: `Console error on ${screen.screen}: ${row.text}`,
      fix: `Open ${file} and address this exact console error. Do not guess a different bug.`,
    });
  }

  for (const row of evidence.requests || []) {
    if (row.ok) continue;
    const detail = row.failed
      ? `request to ${row.url || "unknown URL"} failed (${row.message || "network error"})`
      : `request to ${row.url || "unknown URL"} returned HTTP ${row.status}`;
    findings.push({
      id: `req-${row.at || findings.length}`,
      confirmed: true,
      screen: screen.screen,
      file: screen.file,
      what: `Failed request on ${screen.screen}: ${detail}`,
      fix: `Inspect the handler that calls ${row.url || "that URL"} from ${screen.file}.`,
    });
  }

  for (const alert of evidence.visible?.alerts || []) {
    findings.push({
      id: `alert-${alert.slice(0, 24)}`,
      confirmed: true,
      screen: screen.screen,
      file: screen.file,
      what: `On-screen error on ${screen.screen}: ${alert}`,
      fix: `Clear this validation/error in ${screen.file}. The text above is what the UI actually showed.`,
    });
  }

  for (const field of evidence.visible?.invalid || []) {
    findings.push({
      id: `invalid-${field}`,
      confirmed: true,
      screen: screen.screen,
      file: screen.file,
      what: `Invalid field on ${screen.screen}: ${field}`,
      fix: `Fix validation for "${field}" in ${screen.file}.`,
    });
  }

  if (evidence.estimate?.hasError && evidence.estimate.error) {
    findings.push({
      id: "estimate-error",
      confirmed: true,
      screen: "Estimate builder",
      file: "src/pages/EstimateBuilder.jsx",
      what: `Stored estimate error: ${evidence.estimate.error}`,
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
    wantsFix: wantsCorrection(message),
    invented: false,
  };
}

export function formatInspectionReply(inspection, { sessionAttached = false, queued = false } = {}) {
  const lines = [];
  lines.push(`${inspection.screen} (${inspection.file}).`);
  if (inspection.heading) lines.push(`Visible heading: ${inspection.heading}.`);

  if (!inspection.findings.length) {
    lines.push("No console errors, failed requests, or validation failures are on this screen right now. I will not invent issues.");
  } else {
    lines.push(`${inspection.findings.length} confirmed finding${inspection.findings.length === 1 ? "" : "s"} from this tab:`);
    for (const finding of inspection.findings) {
      lines.push(`• ${finding.file} — ${finding.what}`);
      lines.push(`  Fix: ${finding.fix}`);
      lines.push("  Confirmed from observed evidence (not 100% of the app — only what this tab recorded).");
    }
  }

  if (inspection.wantsFix) {
    if (queued && sessionAttached) {
      lines.push("Correction is queued on this Cursor Project session so it can edit Estim8r the same way Cursor chat does. No API key and no Cloud Agents billing.");
    } else if (!sessionAttached) {
      lines.push("I can name the confirmed issue, but this tab is not attached to a Cursor Project session, so I cannot edit Estim8r from here. Open the Estim8r Project in Cursor and run the app from that session.");
    }
  }

  return lines.join("\n");
}
