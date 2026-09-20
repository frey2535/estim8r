export const PLATFORM_OWNER_EMAIL = "currentflowconsultingllc@gmail.com";
export const BACKUP_ADMIN_EMAIL = "marcus.a.frey@gmail.com";

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

export function platformRoleLabel(userOrEmail) {
  if (isPlatformOwner(userOrEmail)) return "Platform owner";
  if (isBackupAdmin(userOrEmail)) return "Backup admin";
  return null;
}

export function applyPlatformIdentity(profile) {
  const email = emailOf(profile);
  const owner = isPlatformOwner(email);
  const backup = isBackupAdmin(email);
  return {
    ...profile,
    email,
    is_platform_owner: owner,
    is_backup_admin: backup && !owner,
    is_platform_admin: Boolean(profile?.is_platform_admin) || owner || backup,
  };
}

export function hasPlatformAccess(userOrEmail) {
  if (userOrEmail && typeof userOrEmail === "object" && userOrEmail.is_platform_admin) return true;
  return isPlatformStaff(userOrEmail);
}

export function needsProductEntitlementGate(userOrEmail, hasProductAccess) {
  if (hasPlatformAccess(userOrEmail)) return false;
  return !hasProductAccess;
}
