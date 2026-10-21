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

assert(canUseOwnerCursorChat(PLATFORM_OWNER_EMAIL), "owner can open in-app agent");
assert(canUseOwnerCursorChat(BACKUP_ADMIN_EMAIL), "backup admin can open in-app agent");
assert(!canUseOwnerCursorChat(FIRST_CUSTOMER_ADMIN_EMAIL), "Day One admin cannot open in-app agent");
assert(!canUseOwnerCursorChat("local@localhost"), "local estimator cannot open in-app agent");

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
assert(/Connected/.test(ready), "ready copy is connected");
assert(!/open the project in Cursor|Stay in Estim8r — no Cursor window/i.test(ready), "ready copy does not send Marcus to Cursor");
assert(!/paste/i.test(ready), "ready copy does not ask for a paste");
assert(!/open Cursor|Cursor Project|Stay in Estim8r — no Cursor window/i.test(describeCursorSession({ state: "detached" })), "detached copy does not send Marcus to Cursor");

if (!process.exitCode) console.log("owner cursor chat checks passed");
