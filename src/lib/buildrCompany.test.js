import { persistBuildrCompanyId, readLinkedBuildrCompanyId } from "./buildrCompany.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const user = { email: "estimator@example.com" };
assert(readLinkedBuildrCompanyId(user) === "", "no company id until one is applied");
assert(readLinkedBuildrCompanyId({ ...user, buildr_company_id: "co_from_profile" }) === "co_from_profile", "profile company id wins");

const saved = await persistBuildrCompanyId("  co_linked  ", user);
assert(saved.ok && saved.companyId === "co_linked", "apply trims and stores the company id");
assert(readLinkedBuildrCompanyId(user) === "co_linked", "linked id is readable after apply");

const cleared = await persistBuildrCompanyId("", user);
assert(cleared.companyId === null, "clear unlinks the company id");
assert(readLinkedBuildrCompanyId(user) === "", "unlinked user has no stored company id");

if (!process.exitCode) console.log("buildr company checks passed");
