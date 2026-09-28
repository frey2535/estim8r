import { isChromeLabel } from "./ownerChatEvidence.js";
import {
  classifyOwnerMessage,
  formatOwnerReply,
  inspectOwnerEvidence,
  wantsCorrection,
} from "./ownerChatInspector.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(isChromeLabel("Delete"), "Delete is chrome");
assert(isChromeLabel("Delete Soccer Pavilion"), "Delete plus name is chrome");
assert(!isChromeLabel("Could not save the estimate."), "real error is not chrome");

const chromeDump = inspectOwnerEvidence({
  pathname: "/",
  visible: { heading: "Estim8r Command Center", alerts: ["Delete", "Access", "Cursor"] },
}, "hello");
assert(chromeDump.findings.length === 0, "Delete/Access/Cursor are not findings");

const empty = inspectOwnerEvidence({ pathname: "/takeoff", console: [], requests: [], visible: {} }, "what is wrong");
assert(empty.findings.length === 0, "no findings when there is no evidence");

const askA = formatOwnerReply("What is this page?", { pathname: "/", visible: { heading: "Estim8r Command Center" } }, {
  ...empty,
  screen: "Estimates",
  file: "src/pages/Dashboard.jsx",
  heading: "Estim8r Command Center",
  findings: [],
  intent: "ask",
});
const askB = formatOwnerReply("How do I add an estimate?", { pathname: "/", visible: { heading: "Estim8r Command Center" } }, {
  ...empty,
  screen: "Estimates",
  file: "src/pages/Dashboard.jsx",
  heading: "Estim8r Command Center",
  findings: [],
  intent: "ask",
});
assert(askA !== askB, "two different questions get two different replies");
assert(/You asked: “What is this page\?”/.test(askA), "reply quotes first question");
assert(/You asked: “How do I add an estimate\?”/.test(askB), "reply quotes second question");
assert(/Estimates folder/.test(askA), "describes the page");
assert(/New Estimate/.test(askB), "explains how to add an estimate");
assert(!/Delete/.test(askA) || /not a validation error/.test(askA), "does not report Delete as an error");
assert(!/1 confirmed finding/.test(askA), "ask path is not a findings dump");

const withError = inspectOwnerEvidence({
  pathname: "/takeoff",
  console: [{ level: "error", text: "TypeError: cannot read markers in src/pages/TakeoffWorkspace.jsx", at: 1 }],
  requests: [],
  visible: { heading: "Electrical takeoff workspace" },
}, "what's wrong");
assert(withError.findings.length === 1 && withError.findings[0].confirmed, "console error is confirmed");
const inspectReply = formatOwnerReply("what's wrong", {
  pathname: "/takeoff",
  visible: { heading: "Electrical takeoff workspace" },
}, withError);
assert(inspectReply.includes("cannot read markers"), "inspect reply quotes the observed error");
assert(!/100%/.test(inspectReply) || /not 100%/.test(inspectReply), "does not claim 100%");

const failed = inspectOwnerEvidence({
  pathname: "/estimates/new",
  requests: [{ url: "/estim8r/save-project-docs", status: 500, ok: false, at: 2 }],
  visible: { alerts: ["Could not save the estimate."] },
}, "fix the save error");
assert(failed.wantsFix, "fix intent");
assert(failed.findings.some((f) => f.what.includes("500")), "records the 500");
assert(failed.findings.some((f) => f.what.includes("Could not save")), "records on-screen alert");
assert(wantsCorrection("please fix this") && !wantsCorrection("what is on this screen"), "fix detector");
assert(classifyOwnerMessage("What is this page?") === "ask", "ask intent");

const noGuess = inspectOwnerEvidence({ pathname: "/markup" }, "is the conduit math wrong?");
assert(noGuess.findings.length === 0, "does not invent a conduit bug");

if (!process.exitCode) console.log("owner chat inspector checks passed");
