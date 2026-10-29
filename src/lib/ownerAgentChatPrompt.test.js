import {
  DEFAULT_APP_ORIGIN,
  buildGeminiContents,
  isOwnerEmailAllowed,
  normalizeGeminiHistory,
  responseHeadersForOrigin,
} from "../../supabase/functions/owner-agent-chat/prompt.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(isOwnerEmailAllowed(" CurrentFlowConsultingLLC@gmail.com "), "platform owner works without a deployment allowlist secret");
assert(isOwnerEmailAllowed("marcus.a.frey@gmail.com"), "backup admin works without a deployment allowlist secret");
assert(isOwnerEmailAllowed("other@example.com", "other@example.com"), "explicit deployment allowlist can add owners");
assert(!isOwnerEmailAllowed("customer@example.com"), "ordinary users are not owners");

const headers = responseHeadersForOrigin("https://preview.example.com/path", {
  appOrigins: "https://preview.example.com, https://another.example.com",
});
assert(headers["Access-Control-Allow-Origin"] === "https://preview.example.com", "CORS reflects a configured app origin");
assert(
  responseHeadersForOrigin("https://evil.example.com", {})["Access-Control-Allow-Origin"] === DEFAULT_APP_ORIGIN,
  "CORS falls back to the production app for unknown origins",
);

const normalized = normalizeGeminiHistory([
  { role: "assistant", text: "Local inspection ran first" },
  { role: "user", text: "What is broken?" },
  { role: "assistant", text: "A request failed" },
  { role: "assistant", text: "Check the function logs" },
]);
assert(normalized[0].role === "user", "Gemini history never starts with a model message");
assert(normalized.length === 2, "adjacent assistant messages are merged");
assert(/A request failed/.test(normalized[1].parts[0].text), "merged assistant content is preserved");
assert(/Check the function logs/.test(normalized[1].parts[0].text), "second assistant content is preserved");

const contents = buildGeminiContents({
  question: "Can you answer now?",
  context: "{\"screen\":\"Takeoff\"}",
  history: [{ role: "assistant", text: "Inspection-only note" }],
});
assert(contents.length === 1, "assistant-only local history is dropped before the current user question");
assert(contents[0].role === "user", "current question is still sent as the user turn");
assert(contents[0].parts[0].text.includes("Can you answer now?"), "current question is preserved");

if (!process.exitCode) console.log("owner agent chat prompt checks passed");
