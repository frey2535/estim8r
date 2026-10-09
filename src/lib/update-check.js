const EVENT = "estim8r-update-available";
const APPLIED_KEY = "estim8r_applied_sha";
const UPDATE_INTENT_KEY = "estim8r_update_intent_v1";
const CHECK_MS = 30 * 1000;
const FETCH_TIMEOUT_MS = 2000;
const FETCH_TRIES = 2;

export function currentBuildSha() {
  const viteSha = typeof import.meta.env === "undefined" ? "" : import.meta.env.VITE_APP_BUILD_SHA;
  return viteSha || (typeof window !== "undefined" ? window.__ESTIM8R_BUILD_SHA__ : "") || "";
}

function forceFromQuery() {
  try { return new URL(window.location.href).searchParams.get("update") === "1"; } catch { return false; }
}

function readAppliedSha() {
  try { return localStorage.getItem(APPLIED_KEY) || ""; } catch { return ""; }
}

export function shouldPromptForRemoteSha(currentSha, remoteSha) {
  const current = String(currentSha || "").trim();
  const remote = String(remoteSha || "").trim();
  if (!remote || !current) return false;
  if (current === "local" || current.startsWith("%ESTIM8R")) return false;
  return remote !== current;
}

export function decideUpdatePrompt({ currentSha, remoteSha, appliedSha, force = false, promptedSha = "" } = {}) {
  const current = String(currentSha || "").trim();
  const remote = String(remoteSha || "").trim();
  if (shouldPromptForRemoteSha(current, remote)) {
    if (remote === promptedSha) return { prompt: false, targetSha: "", reason: "" };
    return { prompt: true, targetSha: remote, reason: "newer-build" };
  }
  const announce = Boolean(force || (current && current !== "local" && !current.startsWith("%ESTIM8R") && appliedSha !== current));
  if (announce && promptedSha !== current) {
    return { prompt: true, targetSha: current || remote || "latest", reason: force ? "forced" : "this-build" };
  }
  return { prompt: false, targetSha: "", reason: "" };
}

export function buildVersionUrls(now = Date.now(), nonce = Math.random().toString(36).slice(2)) {
  const bust = `t=${now}&n=${nonce}`;
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  return [`/build-version.json?${bust}`, origin ? `${origin}/build-version.json?${bust}&abs=1` : null].filter(Boolean);
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function clearStaleClientCaches() {
  await withTimeout((async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister().catch(() => false)));
      }
    } catch { /* leftover workers are best effort */ }
    try {
      if (typeof window !== "undefined" && "caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
      }
    } catch { /* leftover Cache API is best effort */ }
  })(), 1500);
}

function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  if (typeof AbortController === "undefined") return fetchImpl(url, options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetchImpl(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function readSha(fetchImpl, url) {
  const response = await fetchWithTimeout(fetchImpl, url, {
    cache: "reload",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  }, FETCH_TIMEOUT_MS).catch(() => fetchWithTimeout(fetchImpl, url, { cache: "no-store" }, FETCH_TIMEOUT_MS));
  if (!response?.ok) return "";
  const data = await response.json();
  return String(data?.sha || "").trim();
}

export async function fetchRemoteBuildSha(fetchImpl = typeof fetch === "function" ? fetch : undefined) {
  if (typeof fetchImpl !== "function") return "";
  const urls = buildVersionUrls();
  for (let attempt = 0; attempt < FETCH_TRIES; attempt += 1) {
    for (const url of urls) {
      try {
        const sha = await readSha(fetchImpl, url);
        if (sha) return sha;
      } catch { /* next url or retry */ }
    }
  }
  return "";
}

export function markUpdateIntent(targetSha) {
  try {
    sessionStorage.setItem(UPDATE_INTENT_KEY, JSON.stringify({
      targetSha: targetSha || "",
      route: window.location.pathname + window.location.search + window.location.hash,
      savedAt: new Date().toISOString(),
    }));
  } catch { /* best effort */ }
}

export function consumeUpdateIntent() {
  try {
    const raw = sessionStorage.getItem(UPDATE_INTENT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(UPDATE_INTENT_KEY);
    return JSON.parse(raw);
  } catch { return null; }
}

export async function applyEstim8rUpdate(targetSha) {
  const sha = targetSha || currentBuildSha();
  markUpdateIntent(sha);
  try { if (sha && sha !== "local") localStorage.setItem(APPLIED_KEY, sha); } catch { /* private mode */ }
  await clearStaleClientCaches();
  const next = new URL(window.location.href);
  next.searchParams.set("t", String(Date.now()));
  if (sha && sha !== "local") next.searchParams.set("build", sha);
  next.searchParams.delete("update");
  window.location.replace(next.toString());
}

function promptUpdate(detail) {
  window.__estim8rPendingUpdate = detail;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export async function checkForEstim8rUpdate({
  currentSha,
  appliedSha,
  force = false,
  promptedSha = "",
  fetchImpl,
  clearCaches = false,
} = {}) {
  if (clearCaches) await clearStaleClientCaches();
  const remoteSha = await fetchRemoteBuildSha(fetchImpl);
  return { ...decideUpdatePrompt({ currentSha, remoteSha, appliedSha, force, promptedSha }), remoteSha };
}

export function startUpdateChecks() {
  if (typeof window === "undefined") return;
  if (window.__estim8rUpdateChecksStarted) return;
  window.__estim8rUpdateChecksStarted = true;

  const currentSha = currentBuildSha();
  const force = forceFromQuery();
  let promptedSha = "";
  let inFlight = false;
  let cleared = false;

  const check = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      if (!cleared) {
        await clearStaleClientCaches();
        cleared = true;
      }
      const decision = await checkForEstim8rUpdate({
        currentSha,
        appliedSha: readAppliedSha(),
        force,
        promptedSha,
        fetchImpl: fetch,
      });
      if (!decision.prompt) return;
      promptedSha = decision.targetSha;
      promptUpdate({
        targetSha: decision.targetSha,
        required: true,
        reason: decision.reason,
        applyUpdate: () => applyEstim8rUpdate(decision.targetSha),
      });
    } finally {
      inFlight = false;
    }
  };

  void check();
  window.setInterval(check, CHECK_MS);
  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
}
