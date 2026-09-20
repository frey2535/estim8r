export const PLATFORM_OWNER_EMAIL = "currentflowconsultingllc@gmail.com";
export const BACKUP_ADMIN_EMAIL = "marcus.a.frey@gmail.com";
export const FIRST_CUSTOMER_COMPANY = "Day One Electric";
export const FIRST_CUSTOMER_ADMIN_EMAIL = "mfrey@dayoneelectric.com";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function emailOf(userOrEmail) {
  if (typeof userOrEmail === "string") return normalizeEmail(userOrEmail);
  return normalizeEmail(userOrEmail?.email);
}

export function isPlatformOwner(userOrEmail) {
  return emailOf(userOrEmail) === PLATFORM_OWNER_EMAIL;
}

export function isBackupAdmin(userOrEmail) {
  return emailOf(userOrEmail) === BACKUP_ADMIN_EMAIL;
}

export function isPlatformStaff(userOrEmail) {
  return isPlatformOwner(userOrEmail) || isBackupAdmin(userOrEmail);
}

export function isDayOneElectricCompany(userOrOrgName) {
  const name = typeof userOrOrgName === "string"
    ? userOrOrgName
    : userOrOrgName?.org_name;
  return String(name || "").trim().toLowerCase() === FIRST_CUSTOMER_COMPANY.toLowerCase();
}

export function isCompanyAdmin(userOrEmail) {
  if (isPlatformStaff(userOrEmail)) return false;
  if (emailOf(userOrEmail) === FIRST_CUSTOMER_ADMIN_EMAIL) return true;
  if (userOrEmail && typeof userOrEmail === "object") {
    if (userOrEmail.is_company_admin) return true;
    const role = String(userOrEmail.org_role || "").toLowerCase();
    return isDayOneElectricCompany(userOrEmail) && (role === "owner" || role === "admin");
  }
  return false;
}

export function platformRoleLabel(userOrEmail) {
  if (isPlatformOwner(userOrEmail)) return "Platform owner";
  if (isBackupAdmin(userOrEmail)) return "Current Flow backup admin";
  if (isCompanyAdmin(userOrEmail)) return "Company admin";
  return null;
}

export function applyPlatformIdentity(profile) {
  const email = emailOf(profile);
  const owner = isPlatformOwner(email);
  const backup = isBackupAdmin(email);
  const companyAdmin = !owner && !backup && (
    email === FIRST_CUSTOMER_ADMIN_EMAIL
    || Boolean(profile?.is_company_admin)
    || (isDayOneElectricCompany(profile) && ["owner", "admin"].includes(String(profile?.org_role || "").toLowerCase()))
  );
  return {
    ...profile,
    email,
    is_platform_owner: owner,
    is_backup_admin: backup && !owner,
    is_company_admin: companyAdmin,
    is_platform_admin: owner || backup,
  };
}

export function hasPlatformAccess(userOrEmail) {
  return isPlatformStaff(userOrEmail);
}

export function needsProductEntitlementGate(userOrEmail, hasProductAccess) {
  if (hasPlatformAccess(userOrEmail)) return false;
  return !hasProductAccess;
}
