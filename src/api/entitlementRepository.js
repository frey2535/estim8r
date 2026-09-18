import { requireSupabase } from "./supabaseClient";

export const ESTIM8R_PRODUCT_KEY = "estim8r";

export async function getProductEntitlement(productKey = ESTIM8R_PRODUCT_KEY) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("current_product_entitlement", {
    requested_product: productKey,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
}

export function entitlementGrantsAccess(entitlement) {
  if (!entitlement) return false;
  if (!["active", "trial"].includes(entitlement.status)) return false;
  if (!entitlement.expires_at) return true;
  return new Date(entitlement.expires_at).getTime() >= Date.now();
}
