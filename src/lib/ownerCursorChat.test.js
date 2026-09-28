import {
  BACKUP_ADMIN_EMAIL,
  FIRST_CUSTOMER_ADMIN_EMAIL,
  PLATFORM_OWNER_EMAIL,
  canUseOwnerCursorChat,
} from "./platformIdentity.js";
import {
  describeCursorSession,
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
assert(!canUseOwnerCursorChat("local@localhost"), "local estimator cannot open Cursor chat");

const storage = new Map();
const mem = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
};
assert(readLocalEmailOverride(`?localEmail=${PLATFORM_OWNER_EMAIL}`, mem) === PLATFORM_OWNER_EMAIL, "query sets owner email");

const owner = localFallbackIdentity(PLATFORM_OWNER_EMAIL);
assert(owner.org_name === "Currentflow Consulting", "local owner identity");
assert(screenLabel("/takeoff") === "Takeoff", "takeoff screen");
assert(screenLabel("/markup") === "Markup pages", "markup screen");

const ready = describeCursorSession({
  state: "ready",
  session: { ownerEmail: "marcus.a.frey@gmail.com" },
});
assert(/No API key/.test(ready) && /Cloud Agents billing/.test(ready), "ready copy has no billing");
assert(!/paste/i.test(ready), "ready copy does not ask for a paste");
assert(/not attached/.test(describeCursorSession({ state: "detached" })), "detached copy is honest");

if (!process.exitCode) console.log("owner cursor chat checks passed");
