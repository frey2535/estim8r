import {
  buildrApiUrl,
  buildrAuthHeaders,
  readBuildrSessionToken,
} from "./buildrBridge.js";

export function ownerAgentApiUrl() {
  return buildrApiUrl() || (import.meta.env.PROD ? "" : "http://127.0.0.1:3001");
}

export async function probeCursorSession(email) {
  const api = ownerAgentApiUrl();
  if (!api) {
    return { state: "detached", message: "Buildr API URL is not configured." };
  }
  try {
    const response = await fetch(`${api}/owner/runtime`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...buildrAuthHeaders(readBuildrSessionToken(email)),
      },
    });
    if (response.status === 401 || response.status === 403) {
      return {
        state: "ready",
        session: { attached: true, agent: "buildr-in-app" },
        message: "Same Buildr in-app agent. Sign in once through Buildr if a turn cannot ship.",
      };
    }
    if (!response.ok) {
      return { state: "detached", message: "Buildr in-app agent is not reachable from this tab." };
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
      message: "Buildr in-app agent is not reachable from this tab. Stay in Estim8r and retry — do not open Cursor.",
    };
  }
}

export async function postCursorSessionTurn(payload) {
  const api = ownerAgentApiUrl();
  if (!api) {
    throw new Error("Buildr API URL is not configured.");
  }
  const response = await fetch(`${api}/owner/runtime/turns`, {
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
  return response.json();
}
