import { CURSOR_SESSION_PROXY } from "../lib/ownerCursorChat.js";

export async function probeCursorSession() {
  try {
    const response = await fetch(`${CURSOR_SESSION_PROXY}/health`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { state: "detached", message: "The Cursor session hook is not on this host." };
    }
    const body = await response.json();
    if (body?.session?.attached) {
      return { state: "ready", session: body.session };
    }
    return { state: "detached", session: body.session || null };
  } catch {
    return {
      state: "detached",
      message: "This host has no Cursor Project session hook. Inspection still runs in this tab. Code edits need the Estim8r Project open in Cursor.",
    };
  }
}

export async function postCursorSessionTurn(payload) {
  const response = await fetch(`${CURSOR_SESSION_PROXY}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || "Could not queue that turn on the Cursor session.");
    error.status = response.status;
    throw error;
  }
  return response.json();
}
