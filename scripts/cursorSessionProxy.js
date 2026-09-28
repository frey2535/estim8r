import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const SOCKET = process.env.CURSOR_AGENT_SOCKET || "/run/cursor/api.sock";
const STORE_INBOX = [
  "/opt/cursor/project-storages/frey2535-estim8r/internal/owner-chat",
  "/cursor/stores/bc-2420d95f-c39f-426a-b160-1a7c151124fe/internal/owner-chat",
];

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(`${JSON.stringify(body)}\n`);
}

function readSocket(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath: SOCKET,
      path: pathname,
      method: "GET",
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          status: response.statusCode || 500,
          text: Buffer.concat(chunks).toString("utf8").trim(),
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function readMeta(key) {
  try {
    const result = await readSocket(`/v1/meta-data/${key}`);
    if (result.status !== 200 || !result.text) return "";
    return result.text.split("\n")[0].trim();
  } catch {
    return "";
  }
}

export async function readCursorSession() {
  if (!fs.existsSync(SOCKET)) {
    return { attached: false, reason: "no_socket" };
  }
  const [agentId, ownerEmail, repo, branch, model] = await Promise.all([
    readMeta("agent/id"),
    readMeta("owner/user-email"),
    readMeta("workspace/repo-url"),
    readMeta("workspace/branch-name"),
    readMeta("turn/model"),
  ]);
  if (!agentId) {
    return { attached: false, reason: "no_agent" };
  }
  return {
    attached: true,
    agentId,
    ownerEmail,
    repo,
    branch,
    model,
    url: `https://cursor.com/agents/${agentId}`,
  };
}

function inboxDir() {
  for (const dir of STORE_INBOX) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      /* try next */
    }
  }
  const fallback = path.join(os.tmpdir(), "estim8r-owner-chat");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export async function handleCursorSessionProxy(req, res) {
  const incoming = new URL(req.url, "http://localhost");
  const suffix = incoming.pathname.replace(/^\/api\/cursor-session/, "") || "/";

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if ((suffix === "/health" || suffix === "/health/") && req.method === "GET") {
    const session = await readCursorSession();
    sendJson(res, 200, {
      ok: true,
      proxy: "cursor-session",
      billedBot: false,
      apiKeyRequired: false,
      session,
    });
    return;
  }

  if ((suffix === "/turns" || suffix === "/turns/") && req.method === "POST") {
    const body = await readBody(req);
    const session = await readCursorSession();
    const turn = {
      id: `turn-${Date.now()}`,
      createdAt: new Date().toISOString(),
      text: String(body.text || "").trim(),
      pathname: body.pathname || "/",
      evidence: body.evidence || {},
      inspection: body.inspection || null,
      wantFix: Boolean(body.wantFix),
      session,
    };
    const dir = inboxDir();
    const file = path.join(dir, "inbox.jsonl");
    fs.appendFileSync(file, `${JSON.stringify(turn)}\n`);
    sendJson(res, 200, {
      id: turn.id,
      queued: Boolean(session.attached && turn.wantFix),
      inbox: file,
      session,
    });
    return;
  }

  sendJson(res, 404, { code: "not_found", message: "Unknown Cursor session route." });
}

export function cursorSessionProxyPlugin() {
  const attach = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const pathName = req.url?.split("?")[0] || "";
      if (!pathName.startsWith("/api/cursor-session")) {
        next();
        return;
      }
      try {
        await handleCursorSessionProxy(req, res);
      } catch (error) {
        if (!res.headersSent) {
          sendJson(res, 502, {
            code: "session_proxy_error",
            message: error?.message || "The Cursor session hook failed.",
          });
        }
      }
    });
  };

  return {
    name: "estim8r-cursor-session-proxy",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
