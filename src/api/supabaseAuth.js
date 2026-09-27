import { requireSupabase } from "./supabaseClient";
import { applyPlatformIdentity, normalizeEmail } from "@/lib/platformIdentity";
import { authRedirectUrl, describeAuthError } from "@/lib/authRedirect";

async function organizationForProfile(client, profile) {
  if (!profile?.org_id) return null;
  const { data, error } = await client
    .from("organizations")
    .select("id,name,invite_code,access_status,purchase_source,seat_limit")
    .eq("id", profile.org_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function mapProfile(profile, org, authUser) {
  return applyPlatformIdentity({
    ...profile,
    email: normalizeEmail(profile.email || authUser?.email),
    full_name: profile.full_name || normalizeEmail(profile.email || authUser?.email).split("@")[0],
    org_id: profile.org_id || null,
    org_name: org?.name || null,
    org_role: profile.org_role || (profile.org_id ? "member" : "individual"),
    invite_code: profile.org_role === "owner" ? org?.invite_code || null : null,
    access_type: profile.access_type || "trial",
    access_status: profile.access_status || org?.access_status || "trial",
    purchase_source: profile.purchase_source || org?.purchase_source || "manual",
    seat_limit: org?.seat_limit || null,
    buildr_company_id: profile.buildr_company_id || null,
    is_platform_admin: Boolean(profile.is_platform_admin),
    authUser,
  });
}

async function profileForUser(user) {
  const client = requireSupabase();
  const { data: profile, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("Your Current Flow profile has not been provisioned yet.");
  const org = await organizationForProfile(client, profile);
  return mapProfile(profile, org, user);
}

export const supabaseAuth = {
  async me() {
    const client = requireSupabase();
    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    if (!user) {
      const authError = new Error("Authentication required");
      authError.status = 401;
      throw authError;
    }
    return profileForUser(user);
  },

  async loginViaEmailPassword(email, password) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error) {
      error.message = describeAuthError(error);
      throw error;
    }
    return profileForUser(data.user);
  },

  async loginWithGoogle() {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authRedirectUrl("/"),
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "online",
          prompt: "select_account",
        },
        scopes: "email profile",
      },
    });
    if (error) {
      error.message = describeAuthError(error, { google: true });
      throw error;
    }
    if (!data?.url) throw new Error("Google sign-in did not return an authorization URL.");
    window.location.assign(data.url);
  },

  async register({ email, password, fullName, organizationName, companyName, inviteCode }) {
    const client = requireSupabase();
    const normalized = normalizeEmail(email);
    if (!normalized || !password) throw new Error("Email and password are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");

    const orgName = String(organizationName || companyName || "").trim() || null;
    const invite = String(inviteCode || "").trim().toUpperCase() || null;
    const { data, error } = await client.auth.signUp({
      email: normalized,
      password,
      options: {
        data: {
          full_name: String(fullName || "").trim() || null,
          organization_name: invite ? null : orgName,
          company_name: invite ? null : orgName,
          invite_code: invite,
        },
      },
    });
    if (error) throw error;
    return {
      access_token: data.session?.access_token || null,
      pendingEmailConfirmation: !data.session,
      user: data.session && data.user ? await profileForUser(data.user) : { email: normalized },
    };
  },

  async logout() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  async resetPasswordRequest(email) {
    const client = requireSupabase();
    const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: authRedirectUrl("/reset-password"),
    });
    if (error) throw error;
    return { ok: true };
  },

  async resetPassword({ newPassword }) {
    if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
    const client = requireSupabase();
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { ok: true };
  },

  setToken() {
    // Supabase persists its own session.
  },
};
