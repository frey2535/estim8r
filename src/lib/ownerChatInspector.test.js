import { inspectOwnerEvidence, formatInspectionReply, wantsCorrection } from "./ownerChatInspector.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const empty = inspectOwnerEvidence({ pathname: "/takeoff", console: [], requests: [], visible: {} }, "what is wrong");
assert(empty.findings.length === 0, "no findings when there is no evidence");
assert(!/100%/.test(formatInspectionReply(empty)), "empty reply does not claim 100%");
assert(/will not invent/.test(formatInspectionReply(empty)), "empty reply refuses to invent");

const withError = inspectOwnerEvidence({
  pathname: "/takeoff",
  console: [{ level: "error", text: "TypeError: cannot read markers in src/pages/TakeoffWorkspace.jsx", at: 1 }],
  requests: [],
  visible: { heading: "Electrical takeoff workspace" },
}, "what's wrong");
assert(withError.findings.length === 1 && withError.findings[0].confirmed, "console error is confirmed");
assert(withError.findings[0].file.includes("TakeoffWorkspace"), "maps to takeoff file");
const reply = formatInspectionReply(withError);
assert(reply.includes("TypeError: cannot read markers"), "reply quotes the observed error");
assert(!reply.includes("100% of the app") || reply.includes("not 100%"), "does not claim 100% coverage");

const failed = inspectOwnerEvidence({
  pathname: "/estimates/new",
  requests: [{ url: "/estim8r/save-project-docs", status: 500, ok: false, at: 2 }],
  visible: { alerts: ["Could not save the estimate."] },
}, "fix the save error");
assert(failed.wantsFix, "fix intent");
assert(failed.findings.some((f) => f.what.includes("500")), "records the 500");
assert(failed.findings.some((f) => f.what.includes("Could not save")), "records on-screen alert");
assert(wantsCorrection("please fix this") && !wantsCorrection("what is on this screen"), "fix detector");

const noGuess = inspectOwnerEvidence({ pathname: "/markup" }, "is the conduit math wrong?");
assert(noGuess.findings.length === 0, "does not invent a conduit bug");

if (!process.exitCode) console.log("owner chat inspector checks passed");
