import { requireSupabase } from "./supabaseClient";
import { normalizeEmail } from "@/lib/platformIdentity";
import { canRevokeAccess } from "@/lib/ownerAccessRules";

export { accessStatusLabel, canManageEstim8rAccess, canRevokeAccess } from "@/lib/ownerAccessRules";

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
  if (!canRevokeAccess({ email: target })) throw new Error("Cannot revoke platform owner or backup admin access.");
  const client = requireSupabase();
  const { data, error } = await client.rpc("revoke_estim8r_access", { target_email: target });
  if (error) throw error;
  return data;
}
