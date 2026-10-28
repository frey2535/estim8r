import {
  BACKUP_ADMIN_EMAIL,
  FIRST_CUSTOMER_ADMIN_EMAIL,
  FIRST_CUSTOMER_COMPANY,
  PLATFORM_OWNER_EMAIL,
} from "./platformIdentity.js";
import {
  accessStatusLabel,
  canDeleteAccess,
  canManageEstim8rAccess,
  canReinstateAccess,
  canRevokeAccess,
  isProtectedAccessEmail,
} from "./ownerAccessRules.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(canManageEstim8rAccess({ email: PLATFORM_OWNER_EMAIL }), "owner can open access admin");
assert(canManageEstim8rAccess({ email: BACKUP_ADMIN_EMAIL }), "backup admin can open access admin");
assert(!canManageEstim8rAccess({ email: FIRST_CUSTOMER_ADMIN_EMAIL }), "company admin cannot grant platform access");
assert(!canManageEstim8rAccess({ email: "estimator@example.com" }), "ordinary users cannot manage access");

assert(isProtectedAccessEmail({ email: PLATFORM_OWNER_EMAIL }), "owner email is protected");
assert(isProtectedAccessEmail(BACKUP_ADMIN_EMAIL), "backup admin email is protected");
assert(!isProtectedAccessEmail({ email: "estimator@example.com" }), "ordinary email is not protected");

assert(!canRevokeAccess({ email: PLATFORM_OWNER_EMAIL, is_platform_owner: true }), "cannot revoke owner");
assert(!canRevokeAccess({ email: BACKUP_ADMIN_EMAIL, is_backup_admin: true }), "cannot revoke backup admin");
assert(canRevokeAccess({ email: FIRST_CUSTOMER_ADMIN_EMAIL, entitlement_status: "active" }), "owner can revoke a company admin entitlement");
assert(canRevokeAccess({ email: "estimator@example.com", entitlement_status: "active" }), "can revoke a granted user");
assert(canRevokeAccess({ email: "new@example.com", row_kind: "invite" }), "can revoke a pending invite");
assert(canRevokeAccess({ email: "trial@example.com", entitlement_status: "trial" }), "can revoke a trial user");
assert(!canRevokeAccess({ email: "old@example.com", entitlement_status: "revoked" }), "revoked users use reinstate, not revoke");
assert(!canRevokeAccess({ email: "off@example.com", access_status: "disabled" }), "disabled users use reinstate, not revoke");

assert(!canDeleteAccess({ email: PLATFORM_OWNER_EMAIL }), "cannot delete owner from access list");
assert(!canDeleteAccess({ email: BACKUP_ADMIN_EMAIL }), "cannot delete backup admin from access list");
assert(canDeleteAccess({ email: "estimator@example.com", entitlement_status: "active" }), "can delete a granted user from access list");
assert(canDeleteAccess({ email: "old@example.com", entitlement_status: "revoked" }), "can delete a revoked user from access list");
assert(canDeleteAccess({ email: "new@example.com", row_kind: "invite" }), "can delete a pending invite");

assert(!canReinstateAccess({ email: PLATFORM_OWNER_EMAIL }), "cannot reinstate owner");
assert(!canReinstateAccess({ email: "ok@example.com", entitlement_status: "active" }), "active users are not reinstated");
assert(!canReinstateAccess({ email: "new@example.com", row_kind: "invite" }), "invites are not reinstated");
assert(canReinstateAccess({ email: "old@example.com", entitlement_status: "revoked" }), "can reinstate revoked");
assert(canReinstateAccess({ email: "off@example.com", access_status: "disabled" }), "can reinstate disabled");
assert(canReinstateAccess({ email: "late@example.com", entitlement_status: "expired" }), "can reinstate expired");
assert(canReinstateAccess({ email: "none@example.com" }), "can reinstate no-access profile");

assert(accessStatusLabel({ email: PLATFORM_OWNER_EMAIL, is_platform_owner: true }) === "Platform owner", "owner status");
assert(accessStatusLabel({ email: BACKUP_ADMIN_EMAIL, is_backup_admin: true }) === "Current Flow backup admin", "backup status");
assert(accessStatusLabel({ email: FIRST_CUSTOMER_ADMIN_EMAIL, org_name: FIRST_CUSTOMER_COMPANY }) === "Company admin", "company admin status");
assert(accessStatusLabel({ row_kind: "invite", email: "new@example.com" }) === "Invited", "invite status");
assert(accessStatusLabel({ entitlement_status: "revoked", email: "old@example.com" }) === "Revoked", "revoked status");
assert(accessStatusLabel({ access_status: "disabled", email: "off@example.com" }) === "Disabled", "disabled status");
assert(accessStatusLabel({ entitlement_status: "active", email: "ok@example.com" }) === "Active", "active status");

assert(
  canReinstateAccess({ email: "old@example.com", entitlement_status: "revoked", access_status: "disabled" }) === true,
  "revoked+disabled row can be reinstated",
);
assert(
  canDeleteAccess({ email: "old@example.com", entitlement_status: "revoked" }) === true,
  "revoked row can be deleted from the access list",
);

if (!process.exitCode) console.log("owner access checks passed");
