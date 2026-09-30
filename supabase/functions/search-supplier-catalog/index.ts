import { corsHeaders, json } from "../_shared/cors.ts";
import { catalogEnvFromProcess, searchLiveSupplierCatalogs } from "../_shared/live-catalog.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { message: "Use POST to search live catalogs." });
  }
  if (!req.headers.get("Authorization")) {
    return json(401, {
      configured: [],
      results: [],
      errors: [],
      message: "Sign in to search live catalogs.",
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await searchLiveSupplierCatalogs(String(body.query || ""), {
      env: catalogEnvFromProcess(Deno.env.toObject()),
      quantity: body.quantity,
      limit: body.limit,
    });
    return json(200, result);
  } catch (error) {
    return json(502, {
      configured: [],
      results: [],
      errors: [{ message: error?.message || "Live catalog search failed." }],
      message: error?.message || "Live catalog search failed.",
    });
  }
});
