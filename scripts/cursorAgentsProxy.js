const CURSOR_API = "https://api.cursor.com/v1";

function readHeaderKey(req) {
  const raw = req.headers["x-cursor-api-key"];
  return String(Array.isArray(raw) ? raw[0] : raw || "").trim();
}

function envKey() {
  return String(process.env.CURSOR_API_KEY || "").trim();
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(`${JSON.stringify(body)}\n`);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export async function handleCursorAgentsProxy(req, res) {
  const incoming = new URL(req.url, "http://localhost");
  const suffix = incoming.pathname.replace(/^\/api\/cursor-agents/, "") || "/";

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (suffix === "/health" || suffix === "/health/") {
    sendJson(res, 200, {
      ok: true,
      proxy: true,
      hasEnvKey: Boolean(envKey()),
    });
    return;
  }

  const apiKey = readHeaderKey(req) || envKey();
  if (!apiKey) {
    sendJson(res, 401, {
      code: "missing_api_key",
      message: "Set CURSOR_API_KEY for this Vite proxy, or send x-cursor-api-key from the owner overlay.",
    });
    return;
  }

  const target = `${CURSOR_API}${suffix}${incoming.search}`;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      Accept: req.headers.accept || "application/json",
      ...(body ? { "Content-Type": req.headers["content-type"] || "application/json" } : {}),
    },
    body,
  });

  res.statusCode = upstream.status;
  const contentType = upstream.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  const retention = upstream.headers.get("x-cursor-stream-retention-seconds");
  if (retention) res.setHeader("X-Cursor-Stream-Retention-Seconds", retention);

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    res.end();
  }
}

export function cursorAgentsProxyPlugin() {
  const attach = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const path = req.url?.split("?")[0] || "";
      if (!path.startsWith("/api/cursor-agents")) {
        next();
        return;
      }
      try {
        await handleCursorAgentsProxy(req, res);
      } catch (error) {
        if (!res.headersSent) {
          sendJson(res, 502, {
            code: "proxy_error",
            message: error?.message || "The Cursor Cloud Agents proxy failed.",
          });
        }
      }
    });
  };

  return {
    name: "estim8r-cursor-agents-proxy",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
