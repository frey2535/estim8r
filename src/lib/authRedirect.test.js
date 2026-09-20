import { authRedirectUrl, describeAuthError, readAuthCallbackError, trimAuthUrl } from "./authRedirect.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(trimAuthUrl("https://abc.supabase.co/") === "https://abc.supabase.co", "strip trailing slash from supabase url");
assert(
  authRedirectUrl("/login", { origin: "https://estim8r.currentflowconsulting.org" }, "/")
    === "https://estim8r.currentflowconsulting.org/login",
  "same-origin login redirect",
);
assert(
  authRedirectUrl("/login", { origin: "http://localhost:5177" }, "/")
    === "http://localhost:5177/login",
  "local vite port is preserved",
);
assert(
  readAuthCallbackError("?error=access_denied", "#error_description=redirect_to%20is%20not%20allowed")
    === "redirect_to is not allowed",
  "read oauth error from the callback url",
);
assert(
  describeAuthError({ message: "Unsupported provider: provider is not enabled" }).includes("Providers → Google"),
  "explain disabled google provider",
);
assert(
  describeAuthError({ status: 400, message: "Invalid login credentials" }).includes("Gmail"),
  "point gmail 400s at the google button",
);

if (!process.exitCode) console.log("auth redirect checks passed");
