import { ownerAgentBases, wantsAiTakeoff } from "./cursorSession.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(
  ownerAgentBases("https://buildrpm.com")[0] === "https://buildrpm.com/estim8r/owner",
  "live overlay hits the proxied /estim8r/owner path first",
);
assert(
  ownerAgentBases("https://buildrpm.com")[1] === "https://buildrpm.com/owner",
  "live overlay still tries /owner after nginx adds it",
);
assert(wantsAiTakeoff("AI is not identifying, counting, or marking symbols"), "empty takeoff language runs AI Assist");
assert(wantsAiTakeoff("the Pottsville takeoff is empty"), "Pottsville empty takeoff is recognized");
assert(!wantsAiTakeoff("what is this page?"), "page question is not an AI takeoff command");

if (!process.exitCode) console.log("cursor session checks passed");
