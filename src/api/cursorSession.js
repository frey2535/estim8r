import {
  buildrApiUrl,
  buildrAuthHeaders,
  readBuildrSessionToken,
} from "./buildrBridge.js";

export function ownerAgentApiUrl() {
  return buildrApiUrl() || (import.meta.env.PROD ? "" : "http://127.0.0.1:3001");
}

export function ownerAgentBases(api = ownerAgentApiUrl()) {
  const root = String(api || "").replace(/\/$/, "");
  if (!root) return [];
  return [`${root}/estim8r/owner`, `${root}/owner`];
}

export function wantsAiTakeoff(text) {
  return /\b(empty takeoff|no (?:devices|marks|symbols)|not (?:identifying|counting|marking)|ai assist|ai is not|pottsville|takeoff is empty|run ai|mark (?:the )?(?:symbols|devices)|count (?:the )?symbols)\b/i.test(
    String(text || ""),
  );
}

export function dispatchOwnerAiTakeoff() {
  if (typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent("estim8r-owner-run-ai-takeoff"));
  return true;
}

async function fetchOwnerJson(path, init) {
  const bases = ownerAgentBases();
  if (!bases.length) {
    const error = new Error("Buildr API URL is not configured.");
    error.status = 0;
    throw error;
  }
  let lastError = null;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}${path}`, init);
      const type = response.headers.get("content-type") || "";
      if (type.includes("text/html")) {
        lastError = new Error("Buildr in-app agent is not reachable from this tab.");
        lastError.status = response.status;
        continue;
      }
      // A missing route on the Estim8r-prefixed API must not prevent trying
      // the shared Buildr owner route. Keep auth errors as auth errors.
      if (response.status === 404 || response.status === 405) {
        lastError = new Error(`Owner agent route unavailable (${response.status}).`);
        lastError.status = response.status;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Buildr in-app agent is not reachable from this tab.");
}

export async function probeCursorSession(email) {
  const api = ownerAgentApiUrl();
  if (!api) {
    return { state: "detached", message: "Buildr API URL is not configured. Stay in Estim8r." };
  }
  try {
    const response = await fetchOwnerJson("/runtime", {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...buildrAuthHeaders(readBuildrSessionToken(email)),
      },
    });
    if (response.status === 401 || response.status === 403) {
      return {
        state: "detached",
        message: "Buildr agent authentication is required. Sign in through Buildr and try again.",
      };
    }
    if (!response.ok) {
      return { state: "detached", message: "Buildr in-app agent is not reachable from this tab. Stay in Estim8r." };
    }
    const body = await response.json();
    return {
      state: "ready",
      session: {
        attached: true,
        agent: "buildr-in-app",
        ownerEmail: email || "",
        ship: body.ship || null,
      },
      runtime: body,
    };
  } catch {
    return {
      state: "detached",
      message: "Buildr in-app agent is not reachable from this tab. Stay in Estim8r.",
    };
  }
}

export async function postCursorSessionTurn(payload) {
  if (wantsAiTakeoff(payload.text)) {
    dispatchOwnerAiTakeoff();
  }
  const response = await fetchOwnerJson("/runtime/turns", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...buildrAuthHeaders(readBuildrSessionToken(payload.email)),
    },
    body: JSON.stringify({
      text: payload.text,
      pathname: payload.pathname,
      evidence: payload.evidence,
      ssoToken: payload.ssoToken,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || "Buildr in-app agent could not apply that turn.");
    error.status = response.status;
    throw error;
  }
  const body = await response.json();
  if ((body.actions || []).some((action) => action.type === "run_ai_takeoff") || wantsAiTakeoff(payload.text)) {
    dispatchOwnerAiTakeoff();
  }
  return body;
}
