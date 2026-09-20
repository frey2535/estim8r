import {
  BACKUP_ADMIN_EMAIL,
  PLATFORM_OWNER_EMAIL,
  applyPlatformIdentity,
  hasPlatformAccess,
  needsProductEntitlementGate,
  isBackupAdmin,
  isPlatformOwner,
  isPlatformStaff,
  platformRoleLabel,
} from "./platformIdentity.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(isPlatformOwner(PLATFORM_OWNER_EMAIL), "owner email is the platform owner");
assert(isPlatformOwner({ email: "  CurrentFlowConsultingLLC@gmail.com " }), "owner match ignores case");
assert(!isPlatformOwner(BACKUP_ADMIN_EMAIL), "backup admin is not the platform owner");
assert(isBackupAdmin(BACKUP_ADMIN_EMAIL), "marcus is backup admin");
assert(!isBackupAdmin(PLATFORM_OWNER_EMAIL), "owner is not backup admin");
assert(isPlatformStaff(PLATFORM_OWNER_EMAIL) && isPlatformStaff(BACKUP_ADMIN_EMAIL), "both are platform staff");
assert(!isPlatformStaff("estimator@example.com"), "ordinary users are not staff");
assert(platformRoleLabel(PLATFORM_OWNER_EMAIL) === "Platform owner", "owner label");
assert(platformRoleLabel(BACKUP_ADMIN_EMAIL) === "Backup admin", "backup label");
assert(platformRoleLabel("user@example.com") === null, "no label for ordinary users");

const owner = applyPlatformIdentity({ email: PLATFORM_OWNER_EMAIL, is_platform_admin: false, role: "user" });
assert(owner.is_platform_owner && owner.is_platform_admin && !owner.is_backup_admin, "owner overlay grants admin without calling them backup");

const backup = applyPlatformIdentity({ email: BACKUP_ADMIN_EMAIL, is_platform_admin: false });
assert(backup.is_backup_admin && backup.is_platform_admin && !backup.is_platform_owner, "backup overlay is admin, not owner");

assert(hasPlatformAccess(owner) && hasPlatformAccess(backup), "staff have platform access");
assert(hasPlatformAccess({ email: "x@y.com", is_platform_admin: true }), "db platform admin still has access");
assert(!hasPlatformAccess({ email: "x@y.com", is_platform_admin: false }), "ordinary users do not");
assert(!needsProductEntitlementGate(owner, false), "owner never sees the product gate");
assert(!needsProductEntitlementGate(backup, false), "backup admin never sees the product gate");
assert(needsProductEntitlementGate({ email: "mfrey@dayoneelectric.com" }, false), "ungranted users see the product gate");
assert(!needsProductEntitlementGate({ email: "mfrey@dayoneelectric.com" }, true), "granted users skip the product gate");

if (!process.exitCode) console.log("platform identity checks passed");
