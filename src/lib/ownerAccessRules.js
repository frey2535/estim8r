import { isBackupAdmin, isPlatformOwner, isPlatformStaff } from "./platformIdentity.js";

export function canManageEstim8rAccess(user) {
  return isPlatformStaff(user);
}

export function canRevokeAccess(row) {
  return Boolean(row?.email) && !isPlatformOwner(row.email) && !isBackupAdmin(row.email);
}

export function accessStatusLabel(row) {
  if (isPlatformOwner(row?.email) || row?.is_platform_owner) return "Platform owner";
  if (isBackupAdmin(row?.email) || row?.is_backup_admin) return "Backup admin";
  if (row?.row_kind === "invite" || row?.access_status === "invited") return "Invited";
  const status = String(row?.entitlement_status || row?.access_status || "").toLowerCase();
  if (status === "active") return "Active";
  if (status === "trial") return "Trial";
  if (status === "revoked") return "Revoked";
  if (status === "expired") return "Expired";
  return "No access";
}
