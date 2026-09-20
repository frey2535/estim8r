import {
  BACKUP_ADMIN_EMAIL,
  FIRST_CUSTOMER_ADMIN_EMAIL,
  FIRST_CUSTOMER_COMPANY,
  PLATFORM_OWNER_EMAIL,
  applyPlatformIdentity,
  hasPlatformAccess,
  isBackupAdmin,
  isCompanyAdmin,
  isPlatformOwner,
  isPlatformStaff,
  needsProductEntitlementGate,
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
assert(!isPlatformOwner(FIRST_CUSTOMER_ADMIN_EMAIL), "Day One company admin is not the platform owner");
assert(isBackupAdmin(BACKUP_ADMIN_EMAIL), "marcus is Current Flow backup admin");
assert(!isBackupAdmin(PLATFORM_OWNER_EMAIL), "owner is not backup admin");
assert(!isBackupAdmin(FIRST_CUSTOMER_ADMIN_EMAIL), "company admin is not backup admin");
assert(isPlatformStaff(PLATFORM_OWNER_EMAIL) && isPlatformStaff(BACKUP_ADMIN_EMAIL), "owner and backup are platform staff");
assert(!isPlatformStaff(FIRST_CUSTOMER_ADMIN_EMAIL), "company admin is not platform staff");
assert(platformRoleLabel(PLATFORM_OWNER_EMAIL) === "Platform owner", "owner label");
assert(platformRoleLabel(BACKUP_ADMIN_EMAIL) === "Current Flow backup admin", "backup label");
assert(platformRoleLabel(FIRST_CUSTOMER_ADMIN_EMAIL) === "Company admin", "company admin label");
assert(platformRoleLabel("user@example.com") === null, "no label for ordinary users");

const owner = applyPlatformIdentity({ email: PLATFORM_OWNER_EMAIL, is_platform_admin: false, role: "user" });
assert(owner.is_platform_owner && owner.is_platform_admin && !owner.is_backup_admin && !owner.is_company_admin, "owner overlay grants platform admin without calling them backup or company admin");

const backup = applyPlatformIdentity({ email: BACKUP_ADMIN_EMAIL, is_platform_admin: false });
assert(backup.is_backup_admin && backup.is_platform_admin && !backup.is_platform_owner && !backup.is_company_admin, "backup overlay is Current Flow admin, not a second owner");

const dayOne = applyPlatformIdentity({
  email: FIRST_CUSTOMER_ADMIN_EMAIL,
  is_platform_admin: true,
  org_name: FIRST_CUSTOMER_COMPANY,
  org_role: "owner",
});
assert(dayOne.is_company_admin && !dayOne.is_platform_owner && !dayOne.is_backup_admin && !dayOne.is_platform_admin, "Day One admin is company admin only");

assert(isCompanyAdmin(dayOne) && isCompanyAdmin(FIRST_CUSTOMER_ADMIN_EMAIL), "Day One email is company admin");
assert(!isCompanyAdmin(owner) && !isCompanyAdmin(backup), "platform staff are not company admins");

assert(hasPlatformAccess(owner) && hasPlatformAccess(backup), "staff have platform access");
assert(!hasPlatformAccess({ email: "x@y.com", is_platform_admin: true }), "a DB platform-admin flag is not a second owner ID");
assert(!hasPlatformAccess(dayOne), "company admin does not get platform-owner access");
assert(!needsProductEntitlementGate(owner, false), "owner never sees the product gate");
assert(!needsProductEntitlementGate(backup, false), "backup admin never sees the product gate");
assert(needsProductEntitlementGate(dayOne, false), "company admin still needs an Estim8r entitlement");
assert(!needsProductEntitlementGate(dayOne, true), "entitled company admin uses the app");

if (!process.exitCode) console.log("platform identity checks passed");
