import { BACKUP_ADMIN_EMAIL, PLATFORM_OWNER_EMAIL } from "./platformIdentity.js";
import { accessStatusLabel, canManageEstim8rAccess, canRevokeAccess } from "./ownerAccessRules.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(canManageEstim8rAccess({ email: PLATFORM_OWNER_EMAIL }), "owner can open access admin");
assert(canManageEstim8rAccess({ email: BACKUP_ADMIN_EMAIL }), "backup admin can open access admin");
assert(!canManageEstim8rAccess({ email: "estimator@example.com" }), "ordinary users cannot manage access");

assert(!canRevokeAccess({ email: PLATFORM_OWNER_EMAIL, is_platform_owner: true }), "cannot revoke owner");
assert(!canRevokeAccess({ email: BACKUP_ADMIN_EMAIL, is_backup_admin: true }), "cannot revoke backup admin");
assert(canRevokeAccess({ email: "estimator@example.com", entitlement_status: "active" }), "can revoke a granted user");

assert(accessStatusLabel({ email: PLATFORM_OWNER_EMAIL, is_platform_owner: true }) === "Platform owner", "owner status");
assert(accessStatusLabel({ email: BACKUP_ADMIN_EMAIL, is_backup_admin: true }) === "Backup admin", "backup status");
assert(accessStatusLabel({ row_kind: "invite", email: "new@example.com" }) === "Invited", "invite status");
assert(accessStatusLabel({ entitlement_status: "revoked", email: "old@example.com" }) === "Revoked", "revoked status");
assert(accessStatusLabel({ entitlement_status: "active", email: "ok@example.com" }) === "Active", "active status");

if (!process.exitCode) console.log("owner access checks passed");
