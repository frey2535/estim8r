import {
  authCallbackSearch,
  authRedirectUrl,
  describeAuthError,
  hasAuthCallbackParams,
  hasAuthCode,
  readAuthCallbackError,
  supabaseCallbackUrl,
  trimAuthUrl,
  waitForAuthCallbackSession,
} from "./authRedirect.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(trimAuthUrl("https://abc.supabase.co/") === "https://abc.supabase.co", "strip trailing slash from supabase url");
assert(
  supabaseCallbackUrl("https://gqdxvctvufalunaaopyj.supabase.co/")
    === "https://gqdxvctvufalunaaopyj.supabase.co/auth/v1/callback",
  "supabase callback is the only google redirect uri",
);
assert(
  authRedirectUrl("/", { origin: "https://estim8r.currentflowconsulting.org" }, "/")
    === "https://estim8r.currentflowconsulting.org/",
  "google redirectTo is origin plus one trailing slash",
);
assert(
  authRedirectUrl("/", { origin: "http://localhost:5177" }, "/")
    === "http://localhost:5177/",
  "local vite origin keeps one trailing slash",
);
assert(
  authRedirectUrl("/login", { origin: "https://estim8r.currentflowconsulting.org" }, "/")
    === "https://estim8r.currentflowconsulting.org/login",
  "same-origin login path is unchanged",
);
assert(
  readAuthCallbackError("?error=access_denied", "#error_description=redirect_to%20is%20not%20allowed")
    === "redirect_to is not allowed",
  "read oauth error from the callback url",
);
assert(hasAuthCode("?code=abc&state=xyz"), "pkce code is detected");
assert(hasAuthCallbackParams("?error=redirect_uri_mismatch"), "google mismatch is a callback param");
assert(
  authCallbackSearch("?code=abc&state=xyz&utm=1", "") === "?code=abc&state=xyz",
  "login redirect keeps oauth query only",
);
assert(
  describeAuthError({ message: "Unsupported provider: provider is not enabled" }).includes("Providers → Google"),
  "explain disabled google provider",
);
assert(
  describeAuthError({ message: "redirect_uri_mismatch" }, {
    google: true,
    supabaseUrl: "https://gqdxvctvufalunaaopyj.supabase.co",
  }).includes("gqdxvctvufalunaaopyj.supabase.co/auth/v1/callback"),
  "explain google redirect_uri_mismatch",
);
assert(
  describeAuthError({ status: 400, message: "Invalid login credentials" }).includes("Gmail"),
  "point gmail 400s at the google button",
);
assert(
  describeAuthError({ status: 400, message: "Invalid request" }, { google: true }).includes("HTTP 400"),
  "google 400s stay visible",
);

const session = { access_token: "tok" };
const immediate = {
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};
assert(
  (await waitForAuthCallbackSession(immediate, { search: "?code=abc", hash: "" })) === session,
  "wait for an already-exchanged pkce session",
);

const rejected = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};
assert(
  (await waitForAuthCallbackSession(rejected, { search: "?error=redirect_uri_mismatch", hash: "" })) === null,
  "do not wait for a session when google already rejected",
);

if (!process.exitCode) console.log("auth redirect checks passed");
