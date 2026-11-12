import { requireSupabase } from "@/api/supabaseClient";
import { writeEstimate } from "@/domain/estimate/estimateStore";

async function currentOrg() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth?.user) throw new Error("Sign in to synchronize estimates.");
  // Activate a preapproved, verified employee before resolving company data.
  const { error: activationError } = await client.rpc("estim8r_activate_invited_employee");
  if (activationError) throw activationError;
  const { data, error } = await client.from("profiles").select("org_id").eq("id", auth.user.id).single();
  if (error || !data?.org_id) throw new Error("No company linked to this account.");
  return data.org_id;
}

export async function listCloudEstimates() {
  const client = requireSupabase();
  const orgId = await currentOrg();
  const { data, error } = await client.from("estim8r_estimate_snapshots")
    .select("id,payload,revision,updated_at").eq("org_id", orgId).order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCloudEstimate(id) {
  const client = requireSupabase();
  const orgId = await currentOrg();
  const { data, error } = await client.from("estim8r_estimate_snapshots")
    .select("id,payload,revision,updated_at").eq("org_id", orgId).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveCloudEstimate(estimate, expectedRevision = null) {
  if (!estimate?.id) throw new Error("Estimate must have an ID.");
  await currentOrg();
  const client = requireSupabase();
  const { data, error } = await client.rpc("estim8r_save_snapshot", {
    p_id: estimate.id,
    p_payload: estimate,
    p_expected_revision: expectedRevision,
  });
  if (error) throw error;
  return data;
}

/** Import only records that do not already exist locally. Never overwrite unsaved device work. */
export async function importCloudEstimates(rows) {
  const imported = [];
  for (const row of rows) {
    const estimate = row.payload;
    if (!estimate?.fileName || !estimate?.id) continue;
    const { readEstimate } = await import("@/domain/estimate/estimateStore");
    if (readEstimate(estimate.fileName, estimate.fileSize)) continue;
    writeEstimate(estimate);
    imported.push(estimate);
  }
  return imported;
}
