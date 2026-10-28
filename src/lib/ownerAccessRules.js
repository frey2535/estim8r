import { isBackupAdmin, isCompanyAdmin, isPlatformOwner, isPlatformStaff } from "./platformIdentity.js";

/**
 * @param {any} user
 */
export function canManageEstim8rAccess(user) {
  return isPlatformStaff(user);
}

/**
 * @param {any} row
 */
export function isProtectedAccessEmail(row) {
  const email = row?.email || row;
  return isPlatformOwner(email) || isBackupAdmin(email);
}

/**
 * @param {any} row
 */
function entitlementOrAccessStatus(row) {
  if (row?.row_kind === "invite" || row?.access_status === "invited") return "invited";
  return String(row?.entitlement_status || row?.access_status || "").trim().toLowerCase();
}

/**
 * Soft-disable active/trial grants or cancel a pending invite.
 * @param {any} row
 */
export function canRevokeAccess(row) {
  if (!row?.email || isProtectedAccessEmail(row)) return false;
  const status = entitlementOrAccessStatus(row);
  return status === "active" || status === "trial" || status === "invited";
}

/**
 * Permanently remove Estim8r entitlement/invite rows from access management.
 * Does not delete auth.users or the shared Current Flow profile.
 * @param {any} row
 */
export function canDeleteAccess(row) {
  return Boolean(row?.email) && !isProtectedAccessEmail(row);
}

/**
 * Restore Estim8r access for revoked / disabled / expired / no-access rows.
 * @param {any} row
 */
export function canReinstateAccess(row) {
  if (!row?.email || isProtectedAccessEmail(row)) return false;
  if (row?.row_kind === "invite" || row?.access_status === "invited") return false;
  const status = entitlementOrAccessStatus(row);
  return status === "revoked" || status === "disabled" || status === "expired" || status === "";
}

/**
 * @param {any} row
 */
export function accessStatusLabel(row) {
  if (isPlatformOwner(row?.email) || row?.is_platform_owner) return "Platform owner";
  if (isBackupAdmin(row?.email) || row?.is_backup_admin) return "Current Flow backup admin";
  if (isCompanyAdmin(row) || row?.is_company_admin) return "Company admin";
  if (row?.row_kind === "invite" || row?.access_status === "invited") return "Invited";
  const status = String(row?.entitlement_status || row?.access_status || "").toLowerCase();
  if (status === "active") return "Active";
  if (status === "trial") return "Trial";
  if (status === "revoked") return "Revoked";
  if (status === "disabled") return "Disabled";
  if (status === "expired") return "Expired";
  return "No access";
}
