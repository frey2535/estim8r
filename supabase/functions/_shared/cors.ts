export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(`${JSON.stringify(body)}\n`, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...extra,
    },
  });
}
