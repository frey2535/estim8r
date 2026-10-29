export const DEFAULT_APP_ORIGIN = "https://estim8r.currentflowconsulting.org";
export const DEFAULT_OWNER_EMAILS = Object.freeze([
  "currentflowconsultingllc@gmail.com",
  "marcus.a.frey@gmail.com",
]);

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOrigin(value) {
  try {
    return new URL(String(value || "")).origin;
  } catch {
    return "";
  }
}

export function ownerEmailAllowlist(extraEmails = "") {
  return [...new Set([
    ...DEFAULT_OWNER_EMAILS,
    ...splitCsv(extraEmails).map(normalizeEmail),
  ].filter(Boolean))];
}

export function isOwnerEmailAllowed(email, extraEmails = "") {
  return ownerEmailAllowlist(extraEmails).includes(normalizeEmail(email));
}

export function allowedOrigins({ appOrigin = "", appOrigins = "" } = {}) {
  return [...new Set([
    normalizeOrigin(appOrigin),
    ...splitCsv(appOrigins).map(normalizeOrigin),
    DEFAULT_APP_ORIGIN,
  ].filter(Boolean))];
}

export function responseHeadersForOrigin(origin, env = {}) {
  const allowed = allowedOrigins(env);
  const requested = normalizeOrigin(origin);
  const allowOrigin = requested && allowed.includes(requested) ? requested : allowed[0];
  return {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": allowOrigin,
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function appendContent(contents, item) {
  const text = item?.parts?.[0]?.text || "";
  if (!text) return contents;
  const previous = contents[contents.length - 1];
  if (previous?.role === item.role) {
    previous.parts[0].text = `${previous.parts[0].text}\n\n${text}`;
    return contents;
  }
  contents.push(item);
  return contents;
}

export function normalizeGeminiHistory(history = []) {
  const contents = [];
  const rows = Array.isArray(history) ? history.slice(-8) : [];
  for (const row of rows) {
    if (!row || (row.role !== "user" && row.role !== "assistant")) continue;
    const text = typeof row.text === "string" ? row.text.trim().slice(0, 2000) : "";
    if (!text) continue;
    const role = row.role === "assistant" ? "model" : "user";
    if (!contents.length && role === "model") continue;
    appendContent(contents, { role, parts: [{ text }] });
  }
  return contents;
}

export function buildGeminiContents({ question, context, history }) {
  const contents = normalizeGeminiHistory(history);
  return appendContent(contents, {
    role: "user",
    parts: [{ text: `Question: ${question}\n\nOptional application context (untrusted): ${context}` }],
  });
}
