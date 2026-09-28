import {
  buildrFamilyAccessCopy,
  clearBuildrFamilyAccess,
  hasBuildrCompanyGrant,
  readBuildrFamilyAccess,
  writeBuildrFamilyAccess,
} from "./buildrFamilyAccess.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const store = new Map();
const memory = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, value) => { store.set(key, value); },
  removeItem: (key) => { store.delete(key); },
};

assert(!/app store|install app|view .*access/i.test(buildrFamilyAccessCopy("not_purchased").body), "purchase copy is not an install prompt");
assert(!/app store|install app|view .*access/i.test(buildrFamilyAccessCopy("access_denied").body), "grant copy is not an install prompt");
assert(buildrFamilyAccessCopy("not_purchased").title.includes("not on this company"), "purchase title");
assert(buildrFamilyAccessCopy("access_denied").title.includes("not granted"), "grant title");

assert(readBuildrFamilyAccess(memory) === null, "empty store");
const saved = writeBuildrFamilyAccess({ email: " Estimator@Example.com ", companyId: " co_1 " }, memory, 1_000);
assert(saved.email === "estimator@example.com", "email is normalized");
assert(saved.companyId === "co_1", "company id is trimmed");
assert(hasBuildrCompanyGrant({ email: "estimator@example.com" }, memory, 2_000) === true, "matching email is granted");
assert(hasBuildrCompanyGrant({ email: "other@example.com" }, memory, 2_000) === false, "other email stays blocked");
assert(hasBuildrCompanyGrant({ email: "estimator@example.com" }, memory, saved.expiresAt + 1) === false, "expired handoff is cleared");
clearBuildrFamilyAccess(memory);
assert(readBuildrFamilyAccess(memory) === null, "clear removes the handoff");

if (!process.exitCode) console.log("buildr family access checks passed");
