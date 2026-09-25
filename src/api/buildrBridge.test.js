import { DEFAULT_BUILDR_PRODUCTION_URL, resolveBuildrApiUrl, resolveBuildrAppUrl } from "./buildrBridge.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(resolveBuildrApiUrl("", "", { isProd: false }) === "", "local builds stay unconfigured without env");
assert(resolveBuildrAppUrl("", { isProd: false }) === "", "local app URL stays empty without env");
assert(
  resolveBuildrApiUrl("", "", { isProd: true }) === DEFAULT_BUILDR_PRODUCTION_URL,
  "production falls back to the live Buildr host",
);
assert(
  resolveBuildrApiUrl("", "https://buildrpm.com/", { isProd: false }) === "https://buildrpm.com",
  "API URL falls back to the app URL",
);
assert(
  resolveBuildrApiUrl("https://api.example.test/", "https://buildrpm.com", { isProd: true }) === "https://api.example.test",
  "an explicit API URL wins",
);

if (!process.exitCode) console.log("buildr bridge checks passed");
