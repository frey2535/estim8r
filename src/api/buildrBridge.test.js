import {
  DEFAULT_BUILDR_PRODUCTION_URL,
  isLoopbackBuildrUrl,
  resolveBuildrApiUrl,
  resolveBuildrAppUrl,
} from "./buildrBridge.js";

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
assert(isLoopbackBuildrUrl("http://localhost:3001") === true, "localhost API is loopback");
assert(isLoopbackBuildrUrl("http://127.0.0.1:5173") === true, "loopback host is loopback");
assert(isLoopbackBuildrUrl("https://buildrpm.com") === false, "production host is not loopback");
assert(
  resolveBuildrApiUrl("http://localhost:3001", "http://localhost:5173", { isProd: true }) ===
    DEFAULT_BUILDR_PRODUCTION_URL,
  "production ignores localhost GitHub Pages secrets",
);
assert(
  resolveBuildrAppUrl("http://localhost:5173", { isProd: true }) === DEFAULT_BUILDR_PRODUCTION_URL,
  "production ignores a localhost Buildr app URL",
);
assert(
  resolveBuildrApiUrl("http://localhost:3001", "http://localhost:5173", { isProd: false }) ===
    "http://localhost:3001",
  "local development still uses localhost",
);

if (!process.exitCode) console.log("buildr bridge checks passed");
