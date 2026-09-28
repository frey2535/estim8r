const MAX_EVENTS = 40;
const ACTIVE_DRAWING_KEY = "estim8r.activeDrawing.v1";
const ACTIVE_ESTIMATE_KEY = "estim8r.estimate.active";

export const SCREEN_FILES = {
  "/takeoff": { screen: "Takeoff", file: "src/pages/TakeoffWorkspace.jsx" },
  "/markup": { screen: "Markup pages", file: "src/pages/MarkupPages.jsx" },
  "/estimates/new": { screen: "Estimate builder", file: "src/pages/EstimateBuilder.jsx" },
  "/admin": { screen: "Estim8r access", file: "src/pages/OwnerAdmin.jsx" },
  "/labor": { screen: "Labor library", file: "src/pages/LaborLibrary.jsx" },
  "/production": { screen: "Production", file: "src/pages/Production.jsx" },
  "/settings": { screen: "Settings", file: "src/pages/Settings.jsx" },
  "/profile": { screen: "Settings", file: "src/pages/Settings.jsx" },
  "/": { screen: "Estimates", file: "src/pages/Dashboard.jsx" },
};

function store() {
  if (typeof window === "undefined") return null;
  if (!window.__estim8rOwnerEvidence) {
    window.__estim8rOwnerEvidence = { console: [], requests: [] };
  }
  return window.__estim8rOwnerEvidence;
}

function push(list, item) {
  list.push(item);
  if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
}

function asText(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function screenForPath(pathname = "/") {
  const path = String(pathname || "/");
  const hit = Object.keys(SCREEN_FILES)
    .filter((key) => key !== "/" && path.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return SCREEN_FILES[hit || "/"];
}

export function installOwnerChatEvidence() {
  const bag = store();
  if (!bag || bag.installed) return bag;
  bag.installed = true;

  const wrap = (level) => {
    const original = console[level];
    console[level] = (...args) => {
      push(bag.console, {
        level,
        text: args.map(asText).join(" ").slice(0, 800),
        at: Date.now(),
      });
      original.apply(console, args);
    };
  };
  wrap("error");
  wrap("warn");

  window.addEventListener("error", (event) => {
    push(bag.console, {
      level: "error",
      text: String(event.message || event.error?.message || "window error").slice(0, 800),
      source: event.filename || "",
      at: Date.now(),
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    push(bag.console, {
      level: "error",
      text: asText(event.reason).slice(0, 800),
      at: Date.now(),
    });
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    try {
      const response = await originalFetch(input, init);
      if (!response.ok && !url.includes("/api/cursor-session")) {
        push(bag.requests, {
          url: url.slice(0, 300),
          status: response.status,
          ok: false,
          at: Date.now(),
        });
      }
      return response;
    } catch (error) {
      if (!url.includes("/api/cursor-session")) {
        push(bag.requests, {
          url: url.slice(0, 300),
          failed: true,
          message: error?.message || "network error",
          at: Date.now(),
        });
      }
      throw error;
    }
  };

  return bag;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function snapshotEstimate() {
  if (typeof localStorage === "undefined") return null;
  const activeKey = localStorage.getItem(ACTIVE_ESTIMATE_KEY);
  const estimate = activeKey ? readJson(activeKey) : null;
  if (!estimate) return { present: false };
  return {
    present: true,
    projectName: estimate.projectName || estimate.header?.projectName || "",
    lineCount: Array.isArray(estimate.lines) ? estimate.lines.length : 0,
    hasError: Boolean(estimate.error || estimate.saveError),
    error: estimate.error || estimate.saveError || "",
  };
}

function snapshotTakeoff() {
  if (typeof localStorage === "undefined") return null;
  const drawing = readJson(ACTIVE_DRAWING_KEY);
  return drawing
    ? { present: true, name: drawing.name || "", page: drawing.page || 1 }
    : { present: false };
}

function snapshotVisible() {
  if (typeof document === "undefined") return { alerts: [], invalid: [] };
  const alerts = [...document.querySelectorAll("[role='alert'], .text-destructive")]
    .map((el) => (el.textContent || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const invalid = [...document.querySelectorAll("[aria-invalid='true']")]
    .map((el) => el.getAttribute("name") || el.getAttribute("aria-label") || el.id || "field")
    .slice(0, 8);
  const heading = document.querySelector("main h1")?.textContent?.trim()
    || document.querySelector("h1")?.textContent?.trim()
    || "";
  return { heading, alerts, invalid };
}

export function collectOwnerChatEvidence(pathname = "/") {
  const bag = store() || { console: [], requests: [] };
  const screen = screenForPath(pathname);
  return {
    capturedAt: Date.now(),
    pathname: pathname || "/",
    screen: screen.screen,
    file: screen.file,
    console: bag.console.slice(-12),
    requests: bag.requests.slice(-12),
    estimate: snapshotEstimate(),
    takeoff: snapshotTakeoff(),
    visible: snapshotVisible(),
  };
}
