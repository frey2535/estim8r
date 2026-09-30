import { catalogEnvFromProcess, searchLiveSupplierCatalogs } from "../src/domain/estimate/liveSupplierCatalogSearch.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(`${JSON.stringify(body)}\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export async function handleSupplierCatalogProxy(req, res) {
  if (req.method === "GET") {
    const configured = Object.entries(catalogEnvFromProcess())
      .filter(([key, value]) => key !== "DIGIKEY_SANDBOX" && key !== "ELEMENT14_STORE_ID" && value)
      .map(([key]) => key);
    sendJson(res, 200, {
      ok: true,
      configured,
      message: configured.length
        ? "Live catalog proxy is ready."
        : "No supplier API secrets in the server environment.",
    });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "Use POST to search live catalogs." });
    return;
  }
  const body = await readBody(req);
  const result = await searchLiveSupplierCatalogs(body.query, {
    env: catalogEnvFromProcess(),
    quantity: body.quantity,
    limit: body.limit,
  });
  sendJson(res, 200, result);
}

export function supplierCatalogProxyPlugin() {
  const attach = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const pathName = req.url?.split("?")[0] || "";
      if (pathName !== "/api/live-supplier-catalog") {
        next();
        return;
      }
      try {
        await handleSupplierCatalogProxy(req, res);
      } catch (error) {
        if (!res.headersSent) {
          sendJson(res, 502, {
            configured: [],
            results: [],
            errors: [{ message: error?.message || "Live catalog proxy failed." }],
            message: error?.message || "Live catalog proxy failed.",
          });
        }
      }
    });
  };

  return {
    name: "estim8r-supplier-catalog-proxy",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
