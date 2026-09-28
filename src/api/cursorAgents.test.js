import { parseSseBlock } from "./cursorAgents.js";
import { cursorApiErrorMessage } from "../lib/ownerCursorChat.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const assistant = parseSseBlock('event: assistant\ndata: {"text":"Hello from Cursor"}');
assert(assistant.event === "assistant" && assistant.data.text === "Hello from Cursor", "parses assistant SSE");

const result = parseSseBlock('event: result\ndata: {"runId":"run-1","status":"FINISHED","text":"Done"}');
assert(result.event === "result" && result.data.status === "FINISHED", "parses result SSE");

const empty = parseSseBlock("event: heartbeat\ndata: {}");
assert(empty.event === "heartbeat", "parses heartbeat");

assert(/Dashboard/.test(cursorApiErrorMessage({ code: "missing_api_key" })), "missing key mentions dashboard");

if (!process.exitCode) console.log("cursor agents checks passed");
