import { normalizeEmail } from "../lib/platformIdentity.js";
import { bootstrapBuildrFamilyAppSso, verifyBuildrFamilyAppSso, writeBuildrSessionToken } from "./buildrBridge.js";

async function resolveSupabaseClient(explicit) {
  if (explicit) return explicit;
  const { requireSupabase, supabase } = await import("./supabaseClient.js");
  return supabase ? requireSupabase() : null;
}

/**
 * @param {any} error
 */
export function isInvalidLoginError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return /invalid login|invalid credentials|invalid email or password|user not found/.test(message);
}

/**
 * @param {any} error
 */
export function isAlreadyRegisteredError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return /already registered|already been registered|user already exists/.test(message);
}

/**
 * Sign into Supabase with the Buildr email/password from SSO bootstrap.
 * Creates the Current Flow auth user on first family-app open when needed.
 *
 * @param {any} client
 * @param {Record<string, any>} bootstrap
 */
export async function signInWithBuildrPassword(client, bootstrap) {
  const email = normalizeEmail(bootstrap?.email);
  const password = String(bootstrap?.password || "");
  const fullName = String(bootstrap?.name || "").trim() || email.split("@")[0];
  if (!email || !password) {
    const err = new Error("Buildr did not return sign-in credentials for this user.");
    /** @type {any} */ (err).code = "password_handoff_unavailable";
    throw err;
  }

  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (!signedIn.error && signedIn.data?.user) {
    return { user: signedIn.data.user, session: signedIn.data.session, created: false };
  }

  if (!isInvalidLoginError(signedIn.error)) {
    throw signedIn.error;
  }

  const signedUp = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        organization_name: null,
        company_name: null,
      },
    },
  });
  if (signedUp.error && !isAlreadyRegisteredError(signedUp.error)) {
    throw signedUp.error;
  }
  if (signedUp.data?.session && signedUp.data?.user) {
    return { user: signedUp.data.user, session: signedUp.data.session, created: true };
  }

  const retry = await client.auth.signInWithPassword({ email, password });
  if (retry.error || !retry.data?.user) {
    const err = retry.error || signedIn.error || new Error("Unable to sign in with Buildr credentials.");
    /** @type {any} */ (err).code = "buildr_password_sign_in_failed";
    throw err;
  }
  return { user: retry.data.user, session: retry.data.session, created: Boolean(signedUp.data?.user) };
}

/**
 * Fallback when Buildr cannot hand off a password (for example Google-only
 * Buildr accounts): mint a one-time Supabase session via Edge Function.
 *
 * @param {any} client
 * @param {any} token
 * @param {any} audience
 */
export async function signInWithBuildrSsoEdge(client, token, audience = "estim8r") {
  const { data, error } = await client.functions.invoke("buildr-family-sso", {
    body: { token, audience },
  });
  if (error) {
    const err = new Error(error.message || "Buildr SSO edge sign-in failed.");
    /** @type {any} */ (err).code = "buildr_sso_edge_failed";
    /** @type {any} */ (err).cause = error;
    throw err;
  }
  if (!data?.valid || !data?.token_hash) {
    const err = new Error(data?.error || "Buildr SSO edge sign-in was rejected.");
    /** @type {any} */ (err).code = data?.error || "buildr_sso_edge_rejected";
    throw err;
  }
  const verified = await client.auth.verifyOtp({
    type: "email",
    token_hash: data.token_hash,
  });
  if (verified.error || !verified.data?.user) {
    const err = verified.error || new Error("Could not establish an Estim8r session from Buildr.");
    /** @type {any} */ (err).code = "buildr_sso_otp_failed";
    throw err;
  }
  return {
    user: verified.data.user,
    session: verified.data.session,
    companyId: data.company_id || "",
    email: normalizeEmail(data.email || verified.data.user.email),
    name: data.name || "",
    role: data.role || "",
    buildrToken: data.buildr_token || "",
    via: "edge",
  };
}

/**
 * Full sidebar auto sign-in: verify grant, bootstrap Buildr credentials, open
 * an Estim8r Supabase session without a second login screen.
 *
 * @param {any} token
 * @param {Record<string, any>} options
 */
export async function autoSignInFromBuildrSidebar(token, options = {}) {
  const audience = options.audience || "estim8r";
  const client = await resolveSupabaseClient(options.client);
  const verify = options.verify || verifyBuildrFamilyAppSso;
  const bootstrapFn = options.bootstrap || bootstrapBuildrFamilyAppSso;
  if (!client) {
    const err = new Error("Estim8r authentication is not configured.");
    /** @type {any} */ (err).code = "auth_not_configured";
    throw err;
  }

  const verified = await verify(token, audience);
  if (!verified?.valid) {
    const err = new Error(verified?.error || "invalid_token");
    /** @type {any} */ (err).code = verified?.error || "invalid_token";
    throw err;
  }

  const bootstrap = await bootstrapFn(token, audience);
  const email = normalizeEmail(bootstrap?.email || verified.email);
  const companyId = String(bootstrap?.company_id || verified.company_id || "").trim();
  if (!email || !companyId) {
    const err = new Error("Buildr SSO did not include email and company.");
    /** @type {any} */ (err).code = "invalid_claims";
    throw err;
  }

  if (verified.buildr_token) writeBuildrSessionToken(email, verified.buildr_token);

  if (bootstrap?.valid && bootstrap?.password) {
    try {
      const signed = await signInWithBuildrPassword(client, {
        ...bootstrap,
        email,
        name: bootstrap.name || verified.name,
      });
      return {
        email,
        companyId,
        name: bootstrap.name || verified.name || "",
        role: bootstrap.role || verified.role || "",
        buildrToken: verified.buildr_token || "",
        user: signed.user,
        session: signed.session,
        via: "password",
        created: signed.created,
      };
    } catch (passwordError) {
      // Password out of sync with Supabase — fall through to edge mint.
      if (!options.allowEdgeFallback) throw passwordError;
    }
  }

  if (options.allowEdgeFallback !== false) {
    try {
      const edged = await signInWithBuildrSsoEdge(client, token, audience);
      return {
        email: edged.email || email,
        companyId: edged.companyId || companyId,
        name: edged.name || bootstrap?.name || verified.name || "",
        role: edged.role || bootstrap?.role || verified.role || "",
        buildrToken: edged.buildrToken || verified.buildr_token || "",
        user: edged.user,
        session: edged.session,
        via: "edge",
        created: false,
      };
    } catch (edgeError) {
      if (bootstrap?.error === "password_handoff_unavailable") {
        const err = new Error("password_handoff_unavailable");
        /** @type {any} */ (err).code = "password_handoff_unavailable";
        /** @type {any} */ (err).cause = edgeError;
        throw err;
      }
      throw edgeError;
    }
  }

  const err = new Error(bootstrap?.error || "password_handoff_unavailable");
  /** @type {any} */ (err).code = bootstrap?.error || "password_handoff_unavailable";
  throw err;
}
