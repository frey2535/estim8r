import { listBundledLaborCategories, listBundledLaborLibrary } from '../domain/labor/auditedLibrary';
import { isSupabaseConfigured, requireSupabase } from './supabaseClient';

export async function listLaborLibrary({ search = '', category = '', limit = 2500 } = {}) {
  const bundled = listBundledLaborLibrary({ search, category, limit });
  if (!isSupabaseConfigured) return bundled;

  try {
    const client = requireSupabase();
    let query = client
      .from('labor_items')
      .select('*, labor_units(*)')
      .eq('active', true)
      .order('category')
      .order('item_name')
      .limit(limit);

    if (category) query = query.eq('category', category);
    if (search.trim()) {
      const q = search.trim().replaceAll(',', ' ');
      query = query.or(`item_name.ilike.%${q}%,description.ilike.%${q}%,subcategory.ilike.%${q}%,material_type.ilike.%${q}%,size.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if ((data?.length || 0) >= bundled.length) return data;
  } catch {
    // Keep the bundled 1,921-row workbook table when Supabase is empty or only partially seeded.
  }
  return bundled;
}

export async function listLaborCategories() {
  const bundled = listBundledLaborCategories();
  if (!isSupabaseConfigured) return bundled;
  try {
    const client = requireSupabase();
    const { data, error } = await client.from('labor_items').select('category').eq('active', true);
    if (error) throw error;
    const remote = [...new Set((data ?? []).map((row) => row.category))].sort();
    if (remote.length >= bundled.length) return remote;
  } catch {
    // Keep workbook categories when Supabase is only partially seeded.
  }
  return bundled;
}

export async function listCompanyLaborUnits() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('company_labor_units')
    .select('*, labor_items(*)')
    .eq('active', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listProductionHistory(laborItemId) {
  const client = requireSupabase();
  let query = client.from('labor_production_history').select('*').order('work_date', { ascending: false });
  if (laborItemId) query = query.eq('labor_item_id', laborItemId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function saveEstimateLaborSnapshot(snapshot) {
  const client = requireSupabase();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('org_id')
    .single();
  if (profileError) throw profileError;

  const { data, error } = await client.from('estimate_labor_snapshots').insert({
    org_id: profile.org_id,
    estimate_id: snapshot.estimateId,
    estimate_line_id: snapshot.estimateLineId,
    labor_item_id: snapshot.laborItemId,
    selected_source: snapshot.selectedSource,
    source_record_id: snapshot.sourceRecordId || null,
    condition: snapshot.condition,
    base_mh_per_unit: snapshot.baseMhPerUnit,
    factor_multiplier: snapshot.factorMultiplier,
    factors: snapshot.factors,
    calculated_mh_per_unit: snapshot.calculatedMhPerUnit,
    estimator_override_mh_per_unit: snapshot.estimatorOverrideMhPerUnit,
    effective_mh_per_unit: snapshot.effectiveMhPerUnit,
    override_reason: snapshot.overrideReason || null,
    source_name_snapshot: snapshot.sourceName || null,
    source_year_snapshot: snapshot.sourceYear || null,
    source_reference_snapshot: snapshot.sourceReference || null,
    verification_status_snapshot: snapshot.verificationStatus || 'unverified',
  }).select().single();
  if (error) throw error;
  return data;
}
