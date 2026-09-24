const EVENT = "estim8r-update-available";
const APPLIED_KEY = "estim8r_applied_sha";
const UPDATE_INTENT_KEY = "estim8r_update_intent_v1";
const CHECK_MS = 30 * 1000;

function currentBuildSha() {
  return import.meta.env.VITE_APP_BUILD_SHA || window.__ESTIM8R_BUILD_SHA__ || "";
}
function forceFromQuery() { try { return new URL(window.location.href).searchParams.get("update") === "1"; } catch { return false; } }
function readAppliedSha() { try { return localStorage.getItem(APPLIED_KEY) || ""; } catch { return ""; } }

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
export function applyEstim8rUpdate(targetSha) {
  const sha = targetSha || currentBuildSha();
  markUpdateIntent(sha);
  try { if (sha && sha !== "local") localStorage.setItem(APPLIED_KEY, sha); } catch { /* private mode */ }
  try { if ("caches" in window) caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => undefined); } catch { /* best effort */ }
  const next = new URL(window.location.href);
  next.searchParams.set("t", String(Date.now()));
  if (sha && sha !== "local") next.searchParams.set("build", sha);
  next.searchParams.delete("update");
  window.location.replace(next.toString());
}
function promptUpdate(detail) { window.__estim8rPendingUpdate = detail; window.dispatchEvent(new CustomEvent(EVENT, { detail })); }
export function startUpdateChecks() {
  if (typeof window === "undefined") return;
  const currentSha = currentBuildSha(); const force = forceFromQuery(); let promptedSha = "";
  const check = async () => {
    let remoteSha = "";
    try { const response = await fetch(`/build-version.json?t=${Date.now()}`, { cache: "no-store" }); if (response.ok) remoteSha = (await response.json())?.sha || ""; } catch { /* baked SHA */ }
    if (remoteSha && currentSha && remoteSha !== currentSha && remoteSha !== promptedSha) {
      promptedSha = remoteSha; promptUpdate({ targetSha: remoteSha, required: true, reason: "newer-build", applyUpdate: () => applyEstim8rUpdate(remoteSha) }); return;
    }
    const applied = readAppliedSha(); const announce = force || (currentSha && currentSha !== "local" && applied !== currentSha);
    if (announce && promptedSha !== currentSha) {
      promptedSha = currentSha || "forced"; promptUpdate({ targetSha: currentSha || remoteSha || "latest", required: true, reason: force ? "forced" : "this-build", applyUpdate: () => applyEstim8rUpdate(currentSha || remoteSha) });
    }
  };
  window.setTimeout(check, 200); window.setInterval(check, CHECK_MS); window.addEventListener("focus", check); window.addEventListener("pageshow", check);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
}
