import {
  CURSOR_AGENTS_API,
  CURSOR_AGENTS_PROXY,
  CURSOR_API_KEY_STORAGE,
  ESTIM8R_GITHUB_REPO,
  ESTIM8R_STARTING_REF,
  cursorApiErrorMessage,
} from "../lib/ownerCursorChat.js";

export class CursorAgentsError extends Error {
  constructor(message, { status, code, via } = {}) {
    super(message);
    this.name = "CursorAgentsError";
    this.status = status;
    this.code = code;
    this.via = via;
  }
}

export function readStoredCursorApiKey(storage = typeof window !== "undefined" ? window.sessionStorage : null) {
  if (!storage) return "";
  return String(storage.getItem(CURSOR_API_KEY_STORAGE) || "").trim();
}

export function storeCursorApiKey(key, storage = typeof window !== "undefined" ? window.sessionStorage : null) {
  if (!storage) return;
  const trimmed = String(key || "").trim();
  if (trimmed) storage.setItem(CURSOR_API_KEY_STORAGE, trimmed);
  else storage.removeItem(CURSOR_API_KEY_STORAGE);
}

export function parseSseBlock(block) {
  const lines = String(block || "").split(/\r?\n/);
  let event = "message";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return { event, data: null };
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

function basicAuthHeader(apiKey) {
  const token = typeof btoa === "function"
    ? btoa(`${apiKey}:`)
    : Buffer.from(`${apiKey}:`).toString("base64");
  return `Basic ${token}`;
}

function looksLikeHtml(text) {
  return /^\s*</.test(String(text || ""));
}

async function readError(response) {
  const text = await response.text();
  if (looksLikeHtml(text)) {
    throw new CursorAgentsError(cursorApiErrorMessage({ status: 404 }), {
      status: response.status || 404,
      code: "proxy_missing",
    });
  }
  try {
    const json = JSON.parse(text);
    throw new CursorAgentsError(cursorApiErrorMessage({
      message: json.message || json.error,
      code: json.code || response.status,
    }), {
      status: response.status,
      code: json.code || response.status,
    });
  } catch (error) {
    if (error instanceof CursorAgentsError) throw error;
    throw new CursorAgentsError(cursorApiErrorMessage({ message: text, code: response.status }), {
      status: response.status,
      code: response.status,
    });
  }
}

async function validateCursorAuth(apiKey, via, hasEnvKey) {
  try {
    await cursorFetch("/models", { apiKey });
    return { state: "ready", via, hasEnvKey };
  } catch (error) {
    if (error?.status === 401 || error?.code === 401 || /api key/i.test(error?.message || "")) {
      return {
        state: "error",
        via,
        message: cursorApiErrorMessage({ status: 401, message: error.message }),
      };
    }
    return {
      state: "error",
      via,
      message: cursorApiErrorMessage(error),
    };
  }
}

export async function probeCursorConnection(apiKey = "") {
  try {
    const proxy = await fetch(`${CURSOR_AGENTS_PROXY}/health`, { headers: { Accept: "application/json" } });
    if (proxy.ok) {
      const body = await proxy.json().catch(() => ({}));
      if (body?.proxy) {
        if (body.hasEnvKey || apiKey) {
          return validateCursorAuth(apiKey, "proxy", Boolean(body.hasEnvKey));
        }
        return { state: "needs_key", via: "proxy", hasEnvKey: false };
      }
    }
  } catch {
    // GitHub Pages and other static hosts have no proxy.
  }

  if (!apiKey) {
    return { state: "needs_key", via: null, hasEnvKey: false };
  }

  try {
    const direct = await fetch(`${CURSOR_AGENTS_API}/models`, {
      headers: {
        Accept: "application/json",
        Authorization: basicAuthHeader(apiKey),
      },
    });
    if (direct.ok) return { state: "ready", via: "direct", hasEnvKey: false };
    if (direct.status === 401) {
      return {
        state: "error",
        via: "direct",
        message: cursorApiErrorMessage({ status: 401, message: "Invalid User API Key" }),
      };
    }
  } catch (error) {
    return {
      state: "error",
      via: null,
      message: "The browser could not call api.cursor.com from this origin (CORS). Use the Vite proxy with CURSOR_API_KEY, or put a same-origin reverse proxy at /api/cursor-agents.",
      detail: error?.message,
    };
  }

  return { state: "needs_key", via: null, hasEnvKey: false };
}

function proxyLooksMissing(response) {
  if (!response) return true;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

async function cursorFetch(path, { method = "GET", body, apiKey, stream = false, signal } = {}) {
  const headers = { Accept: stream ? "text/event-stream" : "application/json" };
  if (apiKey) headers["x-cursor-api-key"] = apiKey;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  let response = null;
  try {
    response = await fetch(`${CURSOR_AGENTS_PROXY}${path}`, {
      method,
      headers,
      body: payload,
      signal,
    });
  } catch {
    response = null;
  }

  if (proxyLooksMissing(response)) {
    if (!apiKey) {
      throw new CursorAgentsError(cursorApiErrorMessage({ status: 404 }), { status: 404, code: "proxy_missing" });
    }
    response = await fetch(`${CURSOR_AGENTS_API}${path}`, {
      method,
      headers: {
        Accept: headers.Accept,
        Authorization: basicAuthHeader(apiKey),
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      body: payload,
      signal,
    });
  }

  if (!response.ok) await readError(response);
  return response;
}

export async function listCursorAgents(apiKey) {
  const response = await cursorFetch("/agents?limit=20", { apiKey });
  return response.json();
}

export async function createCursorAgent({ text, pathname, apiKey, name }) {
  const response = await cursorFetch("/agents", {
    method: "POST",
    apiKey,
    body: {
      prompt: { text },
      name: name || `Estim8r ${pathname || "owner"} chat`,
      repos: [{ url: ESTIM8R_GITHUB_REPO, startingRef: ESTIM8R_STARTING_REF }],
      autoCreatePR: false,
    },
  });
  return response.json();
}

export async function createCursorRun(agentId, { text, apiKey }) {
  const response = await cursorFetch(`/agents/${encodeURIComponent(agentId)}/runs`, {
    method: "POST",
    apiKey,
    body: { prompt: { text } },
  });
  return response.json();
}

export async function getCursorRun(agentId, runId, apiKey) {
  const response = await cursorFetch(
    `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
    { apiKey },
  );
  return response.json();
}

export async function cancelCursorRun(agentId, runId, apiKey) {
  const response = await cursorFetch(
    `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST", apiKey },
  );
  return response.json();
}

export async function streamCursorRun(agentId, runId, { apiKey, onEvent, signal } = {}) {
  const response = await cursorFetch(
    `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/stream`,
    { apiKey, stream: true, signal },
  );
  if (!response.body || typeof response.body.getReader !== "function") {
    return getCursorRun(agentId, runId, apiKey);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() || "";
    for (const part of parts) {
      const event = parseSseBlock(part);
      last = event;
      onEvent?.(event);
    }
  }
  return last;
}
