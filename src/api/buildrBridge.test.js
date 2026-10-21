import {
  DEFAULT_BUILDR_PRODUCTION_URL,
  buildBuildrEstimatesUrl,
  buildrAuthHeaders,
  buildrSessionStorageKey,
  fetchBuildrEstimates,
  isLoopbackBuildrUrl,
  normalizeBuildrEstimateRow,
  readBuildrSessionToken,
  resolveBuildrApiUrl,
  resolveBuildrAppUrl,
  writeBuildrSessionToken,
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

assert(buildrSessionStorageKey("Estimator@DayOne.test") === "estim8r.buildrSession.v1:estimator@dayone.test", "session key is email-scoped");
assert(buildrAuthHeaders("tok_1").Authorization === "Bearer tok_1", "Buildr calls send the stored session");
assert(Object.keys(buildrAuthHeaders("")).length === 0, "no Authorization header without a session");

const memory = new Map();
const store = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)); },
  removeItem: (key) => { memory.delete(key); },
};
writeBuildrSessionToken("estimator@dayone.test", "sess_1", store);
assert(readBuildrSessionToken("Estimator@DayOne.test", store) === "sess_1", "stored Buildr session is reused");
assert(readBuildrSessionToken("estimator@dayone.test", store, Date.now() + 8 * 24 * 60 * 60 * 1000) === "", "expired Buildr session is dropped");

assert(
  buildBuildrEstimatesUrl("https://buildrpm.com/", { companyId: "co_dayoneelectric" })
    === "https://buildrpm.com/estim8r/estimates?companyId=co_dayoneelectric",
  "estimates URL includes companyId",
);
assert(
  buildBuildrEstimatesUrl("https://buildrpm.com", { companyId: "co_1", projectId: "proj_9" })
    === "https://buildrpm.com/estim8r/estimates?companyId=co_1&projectId=proj_9",
  "estimates URL can scope to a project",
);

const normalized = normalizeBuildrEstimateRow({
  id: "inv_1",
  invoice_id: "inv_1",
  estim8r_estimate_id: "est_abc",
  project_id: "proj_1",
  project_name: "Hospital Wing",
  project_address: "9 Oak",
  total: "1250.5",
  documents: [{ id: "d1", doc_type: "estim8r_estimate", file_url: "https://files.example/est.json" }],
});
assert(normalized?.project_name === "Hospital Wing", "normalize keeps project name");
assert(normalized?.total === 1250.5, "normalize coerces total");
assert(normalized?.documents[0].file_url === "https://files.example/est.json", "normalize keeps estimate file url");

const noSession = await fetchBuildrEstimates({
  email: "matt@dayoneelectric.com",
  companyId: "co_dayoneelectric",
  apiUrl: "https://buildrpm.com",
  token: "",
  fetchImpl: async () => { throw new Error("should not fetch without a session"); },
});
assert(noSession.ok === false && noSession.error === "auth_required", "estimates require a Buildr session token");

let seenUrl = "";
let seenAuth = "";
const listed = await fetchBuildrEstimates({
  email: "matt@dayoneelectric.com",
  companyId: "co_dayoneelectric",
  apiUrl: "https://buildrpm.com",
  token: "sess_company",
  fetchImpl: async (url, options) => {
    seenUrl = String(url);
    seenAuth = options?.headers?.Authorization || "";
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          companyId: "co_dayoneelectric",
          estimates: [{
            id: "inv_2",
            project_name: "Shop Reno",
            project_id: "proj_2",
            estim8r_estimate_id: "est_2",
            total: 400,
            documents: [{ doc_type: "estim8r_estimate", file_url: "https://files.example/2.json" }],
          }],
        };
      },
    };
  },
});
assert(seenUrl.includes("/estim8r/estimates?companyId=co_dayoneelectric"), "lists estimates with company query");
assert(seenAuth === "Bearer sess_company", "lists estimates with the Buildr bearer token");
assert(listed.ok && listed.estimates.length === 1 && listed.estimates[0].project_name === "Shop Reno", "returns normalized company estimates");

if (!process.exitCode) console.log("buildr bridge checks passed");
