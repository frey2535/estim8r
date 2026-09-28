import {
  BACKUP_ADMIN_EMAIL,
  FIRST_CUSTOMER_ADMIN_EMAIL,
  PLATFORM_OWNER_EMAIL,
  canUseOwnerCursorChat,
} from "./platformIdentity.js";
import {
  buildOwnerPrompt,
  cursorApiErrorMessage,
  describeCursorConnection,
  localFallbackIdentity,
  readLocalEmailOverride,
  screenLabel,
} from "./ownerCursorChat.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(canUseOwnerCursorChat(PLATFORM_OWNER_EMAIL), "owner can open Cursor chat");
assert(canUseOwnerCursorChat(BACKUP_ADMIN_EMAIL), "backup admin can open Cursor chat");
assert(!canUseOwnerCursorChat(FIRST_CUSTOMER_ADMIN_EMAIL), "Day One admin cannot open Cursor chat");
assert(!canUseOwnerCursorChat("estimator@example.com"), "ordinary users cannot open Cursor chat");
assert(!canUseOwnerCursorChat("local@localhost"), "local estimator cannot open Cursor chat");

const storage = new Map();
const mem = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
};
assert(readLocalEmailOverride(`?localEmail=${PLATFORM_OWNER_EMAIL}`, mem) === PLATFORM_OWNER_EMAIL, "query sets owner email");
assert(readLocalEmailOverride("", mem) === PLATFORM_OWNER_EMAIL, "session remembers local owner email");

const owner = localFallbackIdentity(PLATFORM_OWNER_EMAIL);
assert(owner.email === PLATFORM_OWNER_EMAIL && owner.org_name === "Currentflow Consulting", "local owner identity");
const dayOne = localFallbackIdentity(FIRST_CUSTOMER_ADMIN_EMAIL);
assert(dayOne.email === FIRST_CUSTOMER_ADMIN_EMAIL && dayOne.org_name === "Local", "local Day One stays non-staff");

assert(screenLabel("/takeoff") === "Takeoff", "takeoff screen");
assert(screenLabel("/markup") === "Markup pages", "markup screen");
assert(screenLabel("/estimates/new") === "Estimate builder", "estimate screen");
assert(screenLabel("/admin") === "Estim8r access", "admin screen");

const prompt = buildOwnerPrompt("Count the receptacles", "/takeoff");
assert(prompt.startsWith("Count the receptacles"), "prompt keeps owner text");
assert(prompt.includes("Current screen: Takeoff (/takeoff)"), "prompt names the open screen");
assert(prompt.includes("https://github.com/frey2535/estim8r"), "prompt names the repo");

assert(/API Keys/.test(describeCursorConnection({ state: "needs_key" })), "needs-key copy mentions API keys");
assert(/Vite proxy/.test(describeCursorConnection({ state: "ready", via: "proxy", hasEnvKey: true })), "proxy ready copy");
assert(/CORS|reverse proxy|GitHub Pages|API key/.test(cursorApiErrorMessage({ status: 404 })), "missing proxy copy is real");
assert(/rejected the API key/.test(cursorApiErrorMessage({ status: 401, message: "Invalid User API Key" })), "401 copy");

if (!process.exitCode) console.log("owner cursor chat checks passed");
