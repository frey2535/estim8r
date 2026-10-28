import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const DEFAULT_BUILDR = "https://buildrpm.com";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function bootstrapFromBuildr(api: string, token: string, audience: string) {
  const response = await fetch(`${api}/functions/bootstrapFamilyAppSSO`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, audience }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    return { valid: false, error: data.error || "bootstrap_failed", status: response.status, ...data };
  }
  return data;
}

async function verifyFromBuildr(api: string, token: string, audience: string) {
  const response = await fetch(`${api}/functions/verifyFamilyAppSSOToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, audience }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    return { valid: false, error: data.error || "verify_failed", status: response.status, ...data };
  }
  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json(405, { valid: false, error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const buildrApi = String(Deno.env.get("BUILDR_API_URL") || Deno.env.get("VITE_BUILDR_API_URL") || DEFAULT_BUILDR)
    .trim()
    .replace(/\/$/, "");
  if (!supabaseUrl || !serviceKey) {
    return json(503, { valid: false, error: "auth_not_configured" });
  }

  let body: { token?: string; audience?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { valid: false, error: "invalid_json" });
  }

  const token = String(body.token || "").trim();
  const audience = String(body.audience || "estim8r").trim().toLowerCase() || "estim8r";
  if (!token) return json(400, { valid: false, error: "token_required" });

  const verified = await verifyFromBuildr(buildrApi, token, audience);
  if (!verified?.valid) {
    return json(verified?.status === 503 ? 503 : 403, {
      valid: false,
      error: verified?.error || "invalid_token",
    });
  }

  const bootstrap = await bootstrapFromBuildr(buildrApi, token, audience);
  const email = normalizeEmail(bootstrap?.email || verified.email);
  const companyId = String(bootstrap?.company_id || verified.company_id || "").trim();
  const name = String(bootstrap?.name || verified.name || "").trim() || email.split("@")[0];
  const role = String(bootstrap?.role || verified.role || "employee");
  const password = String(bootstrap?.password || "");
  if (!email || !companyId) {
    return json(403, { valid: false, error: "invalid_claims" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ensure a confirmed auth user exists. Prefer the Buildr password when the
  // vault handoff is available so later direct sign-ins stay in sync.
  const createPassword = password || `Buildr-${crypto.randomUUID()}!aA1`;
  const created = await admin.auth.admin.createUser({
    email,
    password: createPassword,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      buildr_company_id: companyId,
    },
  });
  if (created.error && !/already|registered|exists/i.test(String(created.error.message || ""))) {
    return json(500, { valid: false, error: "user_provision_failed", message: created.error.message });
  }

  if (password && created.error) {
    // Existing user: keep Buildr password authoritative for family-app SSO.
    const lookup = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      },
    );
    const lookupBody = await readJson(lookup);
    const existingId = String(lookupBody?.users?.[0]?.id || lookupBody?.id || "").trim();
    if (existingId) {
      await admin.auth.admin.updateUserById(existingId, { password, email_confirm: true });
    }
  }

  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    return json(500, {
      valid: false,
      error: "session_mint_failed",
      message: link.error?.message || "missing token hash",
    });
  }

  return json(200, {
    valid: true,
    email,
    company_id: companyId,
    name,
    role,
    token_hash: tokenHash,
    buildr_token: verified.buildr_token || null,
  });
});
