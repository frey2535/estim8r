const SUPABASE_CALLBACK_PATH = "/auth/v1/callback";
const PRODUCTION_ORIGIN = "https://estim8r.currentflowconsulting.org";

export function trimAuthUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function supabaseCallbackUrl(supabaseUrl) {
  const base = trimAuthUrl(supabaseUrl);
  return base ? `${base}${SUPABASE_CALLBACK_PATH}` : `https://<project-ref>.supabase.co${SUPABASE_CALLBACK_PATH}`;
}

function envSupabaseUrl() {
  return typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : "";
}

function locationParts(search = "", hash = "") {
  const query = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const fragment = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  return { query, fragment };
}

export function authRedirectUrl(path = "/", location = globalThis.location, base) {
  const envBase = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.BASE_URL : "";
  const resolvedBase = base || envBase || "/";
  const origin = trimAuthUrl(location?.origin || "");
  const root = `${origin}${String(resolvedBase || "/").replace(/\/+$/, "")}`;
  const suffix = String(path ?? "/");
  if (!suffix || suffix === "/") return `${root}/`;
  return `${root}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

export function readAuthCallbackError(search = "", hash = "") {
  const { query, fragment } = locationParts(search, hash);
  const error = query.get("error") || fragment.get("error") || "";
  const description = query.get("error_description") || fragment.get("error_description") || "";
  const code = query.get("error_code") || fragment.get("error_code") || "";
  if (!error && !description && !code) return "";
  return decodeURIComponent((description || code || error).replace(/\+/g, " "));
}

export function hasAuthCode(search = "", hash = "") {
  const { query, fragment } = locationParts(search, hash);
  return Boolean(query.get("code") || fragment.get("code"));
}

export function hasAuthCallbackParams(search = "", hash = "") {
  return Boolean(hasAuthCode(search, hash) || readAuthCallbackError(search, hash));
}

export function authCallbackSearch(search = "", hash = "") {
  const { query, fragment } = locationParts(search, hash);
  const next = new URLSearchParams();
  for (const key of ["code", "state", "error", "error_code", "error_description"]) {
    const value = query.get(key) || fragment.get(key);
    if (value) next.set(key, value);
  }
  const encoded = next.toString();
  return encoded ? `?${encoded}` : "";
}

export function describeAuthError(error, { google = false, supabaseUrl } = {}) {
  const message = String(error?.message || error || "").trim();
  const status = Number(error?.status || error?.code) || null;
  const callback = supabaseCallbackUrl(supabaseUrl || envSupabaseUrl());

  if (/redirect_uri_mismatch/i.test(message)) {
    return `Google rejected the OAuth redirect URI. In Google Cloud, the Web client's Authorized redirect URI must be exactly ${callback} — not the Estim8r site.`;
  }
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return "Google sign-in is not enabled on this Supabase project. Enable Authentication → Providers → Google and paste the real Google client ID and secret.";
  }
  if (/redirect/i.test(message) && /not allowed|invalid/i.test(message)) {
    return `This Estim8r URL is not in Supabase Redirect URLs. Site URL should be ${PRODUCTION_ORIGIN}. Add ${PRODUCTION_ORIGIN}/ and ${PRODUCTION_ORIGIN}/** plus http://localhost:5177/ and http://localhost:5177/**.`;
  }
  if (/bad_oauth_callback|oauth state/i.test(message)) {
    return "Google sign-in could not finish (OAuth callback or state was missing). Use Sign in with Google again from Estim8r. Do not bookmark the Google or Supabase URL.";
  }
  if (google && (status === 400 || /invalid request|\b400\b/i.test(message))) {
    const detail = message ? ` ${message}` : "";
    return `Google/Supabase rejected this sign-in (HTTP 400).${detail} Confirm the Google provider uses a real client ID/secret and that the Authorized redirect URI is the Supabase callback only.`;
  }
  if (google) {
    return message || `Google sign-in failed. If Google says the app does not comply with OAuth policy, the Authorized redirect URI must be ${callback}, not Estim8r.`;
  }
  if (status === 400 || /invalid login|invalid credentials/i.test(message)) {
    const detail = message || "Invalid email or password.";
    return /google/i.test(detail) ? detail : `${detail} If this is a Gmail account, use Sign in with Google.`;
  }
  return message || "Sign in failed.";
}

export async function waitForAuthCallbackSession(client, location = globalThis.location, timeoutMs = 10000) {
  if (!client?.auth) return null;
  const search = location?.search || "";
  const hash = location?.hash || "";
  if (readAuthCallbackError(search, hash)) return null;
  if (!hasAuthCode(search, hash)) {
    const { data } = await client.auth.getSession();
    return data?.session || null;
  }

  const { data: existing, error: existingError } = await client.auth.getSession();
  if (existingError) throw existingError;
  if (existing?.session) return existing.session;

  return new Promise((resolve, reject) => {
    let done = false;
    let subscription;
    const finish = (session, error) => {
      if (done) return;
      done = true;
      subscription?.unsubscribe?.();
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(session || null);
    };
    const timer = setTimeout(() => {
      finish(null, new Error("Google sign-in did not finish establishing a session. Try Sign in with Google again."));
    }, timeoutMs);

    const maybeSub = client.auth.onAuthStateChange?.((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION" || event === "USER_UPDATED")) {
        finish(session);
      }
    });
    subscription = maybeSub?.data?.subscription || maybeSub?.subscription;

    Promise.resolve(client.auth.getSession())
      .then(({ data, error }) => {
        if (error) finish(null, error);
        else if (data?.session) finish(data.session);
      })
      .catch((error) => finish(null, error));
  });
}
