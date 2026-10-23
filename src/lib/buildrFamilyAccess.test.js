import {
  buildrFamilyEntitlement,
  buildrFamilyAccessCopy,
  buildrFamilyStatusGrantsAccess,
  buildrFamilyVerifiedHandoffGrantsAccess,
  buildrFamilyUserFromAccess,
  canEnterCompanyEstim8r,
  clearBuildrFamilyAccess,
  hasBuildrCompanyGrant,
  readActiveBuildrFamilyAccess,
  readBuildrFamilyAccess,
  readBuildrHandoffParams,
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
assert(readActiveBuildrFamilyAccess(memory, saved.expiresAt + 1) === null, "expired active handoff is not reused");
clearBuildrFamilyAccess(memory);
assert(readBuildrFamilyAccess(memory) === null, "clear removes the handoff");

const active = writeBuildrFamilyAccess({ email: "matt@dayone.test", companyId: "co_day_one" }, memory, 5_000);
assert(readActiveBuildrFamilyAccess(memory, 6_000)?.companyId === "co_day_one", "active handoff is readable");
assert(buildrFamilyStatusGrantsAccess(active, { canUseBuildr: true, companyId: "co_day_one" }) === true, "matching Buildr status grants access");
assert(buildrFamilyStatusGrantsAccess(active, { canUseBuildr: false, companyId: "co_day_one" }) === false, "Buildr-denied status blocks access");
assert(buildrFamilyStatusGrantsAccess(active, { canUseBuildr: true, companyId: "co_other" }) === false, "company mismatch blocks access");
assert(buildrFamilyVerifiedHandoffGrantsAccess(active, { valid: true, email: "matt@dayone.test", company_id: "co_day_one" }) === true, "verified handoff activates access");
assert(buildrFamilyVerifiedHandoffGrantsAccess(active, { valid: true, email: "other@dayone.test", company_id: "co_day_one" }) === false, "verified handoff email mismatch blocks access");
const familyUser = buildrFamilyUserFromAccess(active, { companyName: "Day One Electric" });
assert(familyUser.email === "matt@dayone.test", "Buildr family user keeps verified email");
assert(familyUser.buildr_company_id === "co_day_one", "Buildr family user is company-scoped");
assert(familyUser.auth_provider === "buildr_family_app", "Buildr family user records auth provider");
assert(familyUser.is_platform_admin === false && familyUser.is_company_admin === false, "Buildr family user does not gain admin flags");
assert(buildrFamilyEntitlement(active).status === "buildr_family_access", "Buildr family entitlement marks source");
clearBuildrFamilyAccess(memory);

const queryHandoff = readBuildrHandoffParams(
  "?sso_token=tok_1&company_id=co_1&email=Estimator%40Example.com",
);
assert(queryHandoff.token === "tok_1", "query token");
assert(queryHandoff.companyId === "co_1", "query company id");
assert(queryHandoff.email === "estimator@example.com", "query email is normalized");

const aliasHandoff = readBuildrHandoffParams(
  "?token=tok_2&app_tenant_binding_company_id=co_2",
  "#sso_token=ignored",
);
assert(aliasHandoff.token === "tok_2", "token alias wins from query");
assert(aliasHandoff.companyId === "co_2", "tenant binding company id alias");

const hashHandoff = readBuildrHandoffParams("", "#sso_token=tok_3&company_id=co_3");
assert(hashHandoff.token === "tok_3", "hash token survives a query-dropping redirect");
assert(hashHandoff.companyId === "co_3", "hash company id");

assert(
  canEnterCompanyEstim8r({
    isAuthenticated: true,
    hasProductAccess: true,
    user: { email: "owner@example.com" },
  }) === true,
  "owner with purchase/access enters the company app",
);
assert(
  canEnterCompanyEstim8r({
    isAuthenticated: true,
    hasPlatformAccess: true,
    user: { email: "currentflowconsultingllc@gmail.com" },
  }) === true,
  "platform owner does not hit the company gate",
);
assert(
  canEnterCompanyEstim8r({
    isAuthenticated: true,
    hasProductAccess: false,
    user: { email: "other@example.com" },
  }) === false,
  "signed-in user without a grant stays gated",
);
assert(
  canEnterCompanyEstim8r({ isAuthenticated: false, hasProductAccess: true, user: { email: "a@b.com" } }) === false,
  "signed-out users still use standalone sign-in",
);

if (!process.exitCode) console.log("buildr family access checks passed");
