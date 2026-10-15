import {
  applyEstim8rUpdate,
  consumeUpdateIntent,
  currentBuildSha,
  fetchRemoteBuildSha,
  markUpdateIntent,
} from "./update-check.js";

export const BEFORE_REFRESH_EVENT = "estim8r-before-update";
export const RESET_ERRORS_EVENT = "estim8r-reset-errors";
export const REDIRECT_KEY = "estim8r_redirect";
export const RESTORE_JOB_KEY = "estim8r.restoreAfterRefresh";

function currentRoute() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search + window.location.hash;
}

export function preserveOpenJob(targetSha = "") {
  try {
    sessionStorage.setItem(REDIRECT_KEY, currentRoute());
    sessionStorage.setItem(RESTORE_JOB_KEY, currentRoute());
  } catch {
    /* private mode */
  }
  markUpdateIntent(targetSha);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BEFORE_REFRESH_EVENT, { detail: { targetSha: targetSha || "" } }));
  }
}

export function clearStaleAppErrors() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RESET_ERRORS_EVENT, { detail: { source: "refresh" } }));
  try {
    const bag = window.__estim8rOwnerEvidence;
    if (bag) {
      bag.console = [];
      bag.requests = [];
    }
  } catch {
    /* evidence bag is optional */
  }
}

export function restoreRefreshRoute(locationImpl = typeof window !== "undefined" ? window.location : null) {
  if (!locationImpl) return "";
  try {
    const redirect = sessionStorage.getItem(REDIRECT_KEY);
    if (redirect) sessionStorage.removeItem(REDIRECT_KEY);
    const intent = consumeUpdateIntent();
    const route = redirect || intent?.route || "";
    if (!route) return "";
    if (locationImpl.pathname === "/" && route !== "/" && !route.startsWith("/?")) {
      const here = `${locationImpl.pathname}${locationImpl.search || ""}${locationImpl.hash || ""}`;
      if (route !== here) window.history.replaceState(null, "", route);
      return route;
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * User-triggered refresh. Same work as "Update now", even if the popup never appeared:
 * save the open job, clear stale errors, drop leftover SW/Cache API, fetch the live SHA,
 * then reload onto that build.
 */
export async function refreshCurrentFlowApp({
  targetSha = "",
  fetchImpl,
  waitMs = 80,
  locationImpl,
  serviceWorker,
  cacheStore,
} = {}) {
  const remoteSha = await fetchRemoteBuildSha(fetchImpl);
  const sha = remoteSha || targetSha || currentBuildSha();
  preserveOpenJob(sha);
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  clearStaleAppErrors();
  await applyEstim8rUpdate(sha, { location: locationImpl, serviceWorker, cacheStore });
  return { sha, remoteSha };
}
