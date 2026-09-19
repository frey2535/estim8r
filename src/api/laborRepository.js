import { listBundledLaborCategories, listBundledLaborLibrary, listBundledLaborTaxonomy, verificationSummary } from '../domain/labor/auditedLibrary';
import { CUSTOM_LABOR_KEY, normalizeCustomLabor, upsertCustomLabor } from '../domain/labor/customLabor';
import { NAMED_CREWS_KEY, upsertNamedCrew } from '../domain/labor/crews';
import { LABOR_RATES_KEY, defaultLaborRates, mergeLaborRates } from '../domain/labor/rates';
import { PRODUCTIVITY_FACTOR_CATALOG } from '../domain/labor/productivity';
import { asExperimentalLaborItem } from '../domain/labor/sources';
import { isSupabaseConfigured, requireSupabase } from './supabaseClient';

function readLocal(key, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  if (typeof localStorage === 'undefined') return value;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
  return value;
}

async function currentOrgId() {
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('org_id').single();
  if (error) throw error;
  return data?.org_id || null;
}

export async function listLaborLibrary({ search = '', category = '', subcategory = '', limit = 2500 } = {}) {
  const bundled = listBundledLaborLibrary({ search, category, limit }).filter((row) => !subcategory || row.subcategory === subcategory);
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
    if (subcategory) query = query.eq('subcategory', subcategory);
    if (search.trim()) {
      const q = search.trim().replaceAll(',', ' ');
      query = query.or(`item_name.ilike.%${q}%,description.ilike.%${q}%,subcategory.ilike.%${q}%,material_type.ilike.%${q}%,size.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if ((data?.length || 0) >= bundled.length) return data.map(asExperimentalLaborItem);
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

export async function listLaborTaxonomy() {
  return listBundledLaborTaxonomy();
}

export async function getLaborVerificationSummary(rows) {
  return verificationSummary(rows);
}

export async function listCompanyLaborUnits() {
  if (!isSupabaseConfigured) return [];
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('company_labor_units')
      .select('*, labor_items(*)')
      .eq('active', true)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

export async function listCustomLabor() {
  const local = (readLocal(CUSTOM_LABOR_KEY, []) || []).map(normalizeCustomLabor);
  if (!isSupabaseConfigured) return local;
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('custom_labor_units')
      .select('*')
      .eq('active', true)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(normalizeCustomLabor);
  } catch {
    return local;
  }
}

export async function saveCustomLabor(input) {
  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();
      const orgId = await currentOrgId();
      const payload = {
        org_id: orgId,
        labor_item_id: input.laborItemId || null,
        item_name: input.itemName || input.item_name,
        category: input.category || null,
        subcategory: input.subcategory || null,
        size: input.size || null,
        unit: input.unit || 'EA',
        normal_mh: input.normal_mh ?? input.normalMh,
        notes: input.notes || null,
        active: true,
        updated_at: new Date().toISOString(),
      };
      const query = input.id
        ? client.from('custom_labor_units').update(payload).eq('id', input.id).select().single()
        : client.from('custom_labor_units').insert(payload).select().single();
      const { data, error } = await query;
      if (error) throw error;
      return normalizeCustomLabor(data);
    } catch {
      // Fall through to local storage when the org table is unavailable.
    }
  }
  const current = readLocal(CUSTOM_LABOR_KEY, []);
  const { rows, saved } = upsertCustomLabor(current, input);
  writeLocal(CUSTOM_LABOR_KEY, rows);
  return saved;
}

export async function listLaborRates(wageBook = {}) {
  const local = mergeLaborRates(readLocal(LABOR_RATES_KEY, []), wageBook);
  if (!isSupabaseConfigured) return local;
  try {
    const client = requireSupabase();
    const { data, error } = await client.from('labor_rates').select('*').order('label');
    if (error) throw error;
    if (!data?.length) return local;
    return mergeLaborRates(data.map((row) => ({
      classId: row.class_id,
      label: row.label,
      hourlyRate: Number(row.hourly_rate),
    })), wageBook);
  } catch {
    return local;
  }
}

export async function saveLaborRates(rates) {
  writeLocal(LABOR_RATES_KEY, rates);
  if (!isSupabaseConfigured) return rates;
  try {
    const client = requireSupabase();
    const orgId = await currentOrgId();
    const rows = rates.map((row) => ({
      org_id: orgId,
      class_id: row.classId,
      label: row.label,
      hourly_rate: Number(row.hourlyRate) || 0,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client.from('labor_rates').upsert(rows, { onConflict: 'org_id,class_id' });
    if (error) throw error;
  } catch {
    // Local wage book remains the fallback.
  }
  return rates;
}

export async function listNamedCrews() {
  const local = readLocal(NAMED_CREWS_KEY, []) || [];
  if (!isSupabaseConfigured) return local;
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('crews')
      .select('*, crew_members(*)')
      .eq('active', true)
      .order('name');
    if (error) throw error;
    return (data ?? []).map((crew) => ({
      id: crew.id,
      name: crew.name,
      notes: crew.notes || '',
      members: (crew.crew_members || []).map((member) => ({
        classId: member.class_id,
        label: member.label,
        hourlyRate: Number(member.hourly_rate),
        headcount: Number(member.headcount),
      })),
      active: true,
    }));
  } catch {
    return local;
  }
}

export async function saveNamedCrew(named) {
  const current = readLocal(NAMED_CREWS_KEY, []) || [];
  const next = upsertNamedCrew(current, named);
  writeLocal(NAMED_CREWS_KEY, next);
  if (!isSupabaseConfigured) return named;
  try {
    const client = requireSupabase();
    const orgId = await currentOrgId();
    const { data, error } = await client.from('crews').upsert({
      id: named.id,
      org_id: orgId,
      name: named.name,
      notes: named.notes || null,
      active: true,
      updated_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    await client.from('crew_members').delete().eq('crew_id', data.id);
    if (named.members?.length) {
      const { error: memberError } = await client.from('crew_members').insert(
        named.members.map((member) => ({
          crew_id: data.id,
          class_id: member.classId,
          label: member.label,
          hourly_rate: Number(member.hourlyRate) || 0,
          headcount: Number(member.headcount) || 0,
        })),
      );
      if (memberError) throw memberError;
    }
    return { ...named, id: data.id };
  } catch {
    return named;
  }
}

export async function listProductivityFactorDefinitions() {
  if (!isSupabaseConfigured) return PRODUCTIVITY_FACTOR_CATALOG;
  try {
    const client = requireSupabase();
    const { data, error } = await client.from('productivity_factor_definitions').select('*').order('label');
    if (error) throw error;
    if (!data?.length) return PRODUCTIVITY_FACTOR_CATALOG;
    return data.map((row) => ({
      code: row.code,
      label: row.label,
      category: row.category,
      multiplier: Number(row.default_multiplier) || 1,
      description: row.description || '',
    }));
  } catch {
    return PRODUCTIVITY_FACTOR_CATALOG;
  }
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
    crew_id: snapshot.crewId || null,
    labor_rate_snapshot: snapshot.laborRate ?? null,
    acknowledged_unverified: Boolean(snapshot.acknowledgedUnverified),
  }).select().single();
  if (error) throw error;
  return data;
}

export { defaultLaborRates };
