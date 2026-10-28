import { requireSupabase } from "./supabaseClient";
import { normalizeEmail } from "@/lib/platformIdentity";
import {
  canDeleteAccess,
  isProtectedAccessEmail,
} from "@/lib/ownerAccessRules";
import { describeAccessRpcError } from "@/lib/ownerAccessRpc";

export {
  accessStatusLabel,
  canDeleteAccess,
  canManageEstim8rAccess,
  canReinstateAccess,
  canRevokeAccess,
  isProtectedAccessEmail,
} from "@/lib/ownerAccessRules";

export { describeAccessRpcError, isMissingRpcError } from "@/lib/ownerAccessRpc";

export async function listEstim8rAccess() {
  const client = requireSupabase();
  const { data, error } = await client.rpc("list_estim8r_access");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function grantEstim8rAccess(email) {
  const target = normalizeEmail(email);
  if (!target || !target.includes("@")) throw new Error("Enter a valid email to grant access.");
  const client = requireSupabase();
  const { data, error } = await client.rpc("grant_estim8r_access", { target_email: target });
  if (error) throw error;
  return data;
}

export async function revokeEstim8rAccess(email) {
  const target = normalizeEmail(email);
  if (isProtectedAccessEmail(target)) {
    throw new Error("Cannot revoke platform owner or backup admin access.");
  }
  const client = requireSupabase();
  const { data, error } = await client.rpc("revoke_estim8r_access", { target_email: target });
  if (error) throw error;
  return data;
}

export async function deleteEstim8rAccess(email) {
  const target = normalizeEmail(email);
  if (!canDeleteAccess({ email: target })) {
    throw new Error("Cannot delete platform owner or backup admin access.");
  }
  const client = requireSupabase();
  const { data, error } = await client.rpc("delete_estim8r_access", { target_email: target });
  if (error) {
    const err = new Error(describeAccessRpcError(error, "delete"));
    /** @type {any} */ (err).cause = error;
    /** @type {any} */ (err).code = error?.code || "delete_failed";
    throw err;
  }
  return data;
}

/**
 * Restore Estim8r access for a revoked/disabled/expired user.
 * Prefer the live grant_estim8r_access RPC (already deployed) so Reinstate
 * works even before reinstate_estim8r_access is applied. Fall through to the
 * dedicated reinstate RPC only if grant unexpectedly fails as missing.
 */
export async function reinstateEstim8rAccess(email) {
  const target = normalizeEmail(email);
  if (isProtectedAccessEmail(target)) {
    throw new Error("Cannot reinstate platform owner or backup admin access.");
  }
  if (!target || !target.includes("@")) throw new Error("Enter a valid email to reinstate access.");

  try {
    const granted = await grantEstim8rAccess(target);
    return { ok: true, email: target, action: "reinstated", grant: granted, via: "grant" };
  } catch (grantError) {
    const client = requireSupabase();
    const { data, error } = await client.rpc("reinstate_estim8r_access", { target_email: target });
    if (!error) return data;
    const err = new Error(describeAccessRpcError(error || grantError, "reinstate"));
    /** @type {any} */ (err).cause = error || grantError;
    /** @type {any} */ (err).code = error?.code || grantError?.code || "reinstate_failed";
    throw err;
  }
}
