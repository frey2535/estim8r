export function trimAuthUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function authRedirectUrl(path = "/login", location = globalThis.location, base) {
  const envBase = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.BASE_URL : "";
  const resolvedBase = base || envBase || "/";
  const origin = trimAuthUrl(location?.origin || "");
  const root = `${origin}${String(resolvedBase || "/").replace(/\/+$/, "")}`;
  const suffix = String(path || "/login");
  return `${root}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

export function readAuthCallbackError(search = "", hash = "") {
  const query = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const fragment = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  const error = query.get("error") || fragment.get("error") || "";
  const description = query.get("error_description") || fragment.get("error_description") || "";
  if (!error && !description) return "";
  return decodeURIComponent((description || error).replace(/\+/g, " "));
}

export function describeAuthError(error, { google = false } = {}) {
  const message = String(error?.message || error || "").trim();
  const status = Number(error?.status || error?.code) || null;
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return "Google sign-in is not enabled on this Supabase project. Enable Authentication → Providers → Google.";
  }
  if (/redirect/i.test(message) && /not allowed|invalid/i.test(message)) {
    return "This Estim8r URL is not in Supabase Redirect URLs. Add https://estim8r.currentflowconsulting.org/** and http://localhost:5177/**.";
  }
  if (google) return message || "Google sign-in failed.";
  if (status === 400 || /invalid login|invalid credentials/i.test(message)) {
    const detail = message || "Invalid email or password.";
    return /google/i.test(detail) ? detail : `${detail} If this is a Gmail account, use Sign in with Google.`;
  }
  return message || "Sign in failed.";
}
