import { requireSupabase } from "@/api/supabaseClient";
import { writeEstimate, readEstimate, registerCloudEstimateSnapshot } from "@/domain/estimate/estimateStore";

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

/** Diagnostic metadata only; does not expose another company's records. */
export async function getCompanySyncDiagnostics() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth?.user) throw new Error("Sign in to inspect company synchronization.");
  const orgId = await currentOrg();
  const { data, error } = await client.from("estim8r_estimate_snapshots")
    .select("id,updated_at").eq("org_id", orgId);
  if (error) throw error;
  return { userId: auth.user.id, orgId, cloudCount: (data || []).length };
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

export async function deleteCloudEstimate(id) {
  if (!id) throw new Error("Estimate ID required for deletion.");
  const client = requireSupabase();
  const orgId = await currentOrg();
  const { error } = await client.from("estim8r_estimate_snapshots")
    .delete().eq("id", id).eq("org_id", orgId);
  if (error) throw error;
}

/** A per-company, per-estimate last-imported baseline, never a source of truth. */
function baselineKey(orgId, id) {
  return `estim8r.cloudBaseline.v1:${orgId}:${id}`;
}

function readBaseline(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); }
  catch { return null; }
}

export function decideCloudRefresh(local, baseline, remote) {
  if (!local) return "import";
  if (local.id !== remote.id) return "conflict";
  if (JSON.stringify(local) === JSON.stringify(remote)) return "unchanged";
  if (!baseline || JSON.stringify(local) !== JSON.stringify(baseline)) return "conflict";
  return "refresh";
}

/**
 * Refresh unchanged local copies from the shared company database.
 * If a device has edited a copy since its last cloud import, preserve it
 * and report a conflict rather than silently discarding work.
 */
export async function importCloudEstimates(rows) {
  const orgId = await currentOrg();
  const imported = [];
  const conflicts = [];
  for (const row of rows || []) {
    const estimate = row.payload;
    if (!estimate?.fileName || !estimate?.id) continue;
    const key = baselineKey(orgId, estimate.id);
    const local = readEstimate(estimate.fileName, estimate.fileSize);
    const baseline = readBaseline(key);
    const decision = decideCloudRefresh(local, baseline, estimate);
    if (decision === "conflict") {
      conflicts.push(estimate.id);
      continue;
    }
    if (!local || JSON.stringify(local) !== JSON.stringify(estimate)) {
      writeEstimate(estimate, { skipCloud: true });
      imported.push(estimate);
    }
    localStorage.setItem(key, JSON.stringify(estimate));
    registerCloudEstimateSnapshot(estimate, row.revision);
  }
  if (conflicts.length && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("estim8r-cloud-sync-conflict", {
      detail: { estimateIds: conflicts },
    }));
  }
  return imported;
}

/** Subscribe to company snapshot changes; RLS restricts payload access to the signed-in company. */
export async function subscribeCompanyEstimates(onChange) {
  const client = requireSupabase();
  const orgId = await currentOrg();
  const channel = client.channel(`estim8r-company-estimates-${orgId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "estim8r_estimate_snapshots", filter: `org_id=eq.${orgId}` }, () => onChange())
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
