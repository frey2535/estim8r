import {
  BEFORE_REFRESH_EVENT,
  REDIRECT_KEY,
  RESET_ERRORS_EVENT,
  RESTORE_JOB_KEY,
  clearStaleAppErrors,
  preserveOpenJob,
  refreshCurrentFlowApp,
  restoreRefreshRoute,
} from "./appRefresh.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

function mem() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => store.clear(),
  };
}

const events = [];
const unregistered = [];
const deletedCaches = [];
const replaced = [];
const local = mem();
const session = mem();

local.setItem("estim8r.estimate.active", "estim8r.estimate.v1:soccer.pdf:99");
local.setItem("estim8r.estimate.v1:soccer.pdf:99", JSON.stringify({ header: { projectName: "Soccer Pavilion" } }));
local.setItem("estim8r.activeDrawing.v1", JSON.stringify({ name: "soccer.pdf", size: 99, page: 2 }));

globalThis.window = {
  location: {
    href: "https://estim8r.currentflowconsulting.org/takeoff?file=soccer.pdf",
    pathname: "/takeoff",
    search: "?file=soccer.pdf",
    hash: "",
    origin: "https://estim8r.currentflowconsulting.org",
    replace: (url) => { replaced.push(String(url)); },
  },
  sessionStorage: session,
  localStorage: local,
  __estim8rOwnerEvidence: {
    console: [{ text: "stale crash" }],
    requests: [{ url: "/api/fail", status: 500 }],
  },
  dispatchEvent: (event) => { events.push(event); return true; },
  CustomEvent: class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
};
globalThis.sessionStorage = session;
globalThis.localStorage = local;
const serviceWorker = {
  getRegistrations: async () => [
    {
      waiting: { postMessage: (msg) => { unregistered.push(msg); } },
      unregister: async () => { unregistered.push("unregistered"); return true; },
    },
  ],
};
const cacheStore = {
  keys: async () => ["estim8r-old", "workbox-precache"],
  delete: async (key) => { deletedCaches.push(key); return true; },
};

preserveOpenJob("abc123");
assert(events.some((event) => event.type === BEFORE_REFRESH_EVENT), "preserve dispatches before-update so takeoff can save");
assert(session.getItem(REDIRECT_KEY) === "/takeoff?file=soccer.pdf", "open takeoff route is remembered");
assert(session.getItem(RESTORE_JOB_KEY) === "/takeoff?file=soccer.pdf", "refresh flags the open job route to restore after reload");
assert(local.getItem("estim8r.estimate.v1:soccer.pdf:99"), "preserve does not wipe the saved estimate");
assert(local.getItem("estim8r.activeDrawing.v1"), "preserve does not wipe the active drawing");

clearStaleAppErrors();
assert(events.some((event) => event.type === RESET_ERRORS_EVENT), "reset-errors is dispatched for banners and crash boundaries");
assert(window.__estim8rOwnerEvidence.requests.length === 0, "failed-request evidence is cleared");
assert(window.__estim8rOwnerEvidence.console.length === 0, "stale console errors are cleared");

replaced.length = 0;
unregistered.length = 0;
deletedCaches.length = 0;

const result = await refreshCurrentFlowApp({
  waitMs: 0,
  fetchImpl: async (url) => {
    assert(String(url).includes("build-version.json"), "refresh fetches build-version.json");
    assert(String(url).includes("t="), "build-version.json fetch is cache-busted");
    return { ok: true, json: async () => ({ sha: "live-sha-from-host" }) };
  },
  locationImpl: window.location,
  serviceWorker,
  cacheStore,
});

assert(result.remoteSha === "live-sha-from-host", "refresh reads the live SHA");
assert(result.sha === "live-sha-from-host", "reload targets the live SHA even when no popup appeared");
assert(unregistered.includes("unregistered"), "stale service workers are unregistered");
assert(unregistered.some((item) => item?.type === "SKIP_WAITING"), "waiting workers are told to skip waiting");
assert(deletedCaches.includes("estim8r-old") && deletedCaches.includes("workbox-precache"), "Cache API stores are deleted");
assert(replaced.length === 1, "refresh reloads once onto the new build");
assert(replaced[0].includes("build=live-sha-from-host"), "reload URL carries the live SHA");
assert(replaced[0].includes("/takeoff"), "reload keeps the open takeoff route");
assert(local.getItem("estim8r.estimate.v1:soccer.pdf:99"), "refresh does not wipe the open estimate");
assert(local.getItem("estim8r.activeDrawing.v1"), "refresh does not wipe the open takeoff drawing");

window.location.pathname = "/";
window.location.search = "";
window.location.hash = "";
session.setItem(REDIRECT_KEY, "/estimates/new?file=soccer.pdf&size=99");
const restored = [];
globalThis.window.history = { replaceState: (_s, _t, url) => restored.push(String(url)) };
assert(restoreRefreshRoute(window.location) === "/estimates/new?file=soccer.pdf&size=99", "SPA fallback restores the open estimate route");
assert(restored[0] === "/estimates/new?file=soccer.pdf&size=99", "history is rewritten to the saved job");

if (!process.exitCode) console.log("appRefresh ok");
