import { supabase } from "@/api/supabaseClient";
const lastReported = new Map();
const FIVE_MINUTES = 300000;

/** Passive diagnostics: fixed categories only; never sends screenshots, stacks, user text or tokens. */
export async function reportEstim8rIssue(category, pathname = "/") {
  if (!supabase || !["render_crash", "server_error", "unhandled_error"].includes(category)) return false;
  const route = String(pathname).split("?")[0].split("#")[0].slice(0, 200);
  if (!route.startsWith("/") || route.startsWith("//")) return false;
  const key = category + ":" + route;
  const now = Date.now();
  if (now - (lastReported.get(key) || 0) < FIVE_MINUTES) return false;
  lastReported.set(key, now);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return false;
  const { error } = await supabase.from("estim8r_issue_reports").insert({
    reporter_id: session.user.id, route, category,
  });
  return !error;
}

/** Explicit owner-triggered smoke test. Returns the inserted row ID for verification. */
export async function createOwnerTestIssue() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (authError || !session?.user?.id) throw new Error("Sign in before testing notifications.");
  const route = "/admin";
  const { data, error } = await supabase.from("estim8r_issue_reports")
    .insert({ reporter_id: session.user.id, route, category: "owner_test" })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

export async function listEstim8rIssues() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("estim8r_issue_reports")
    .select("id,route,category,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}
