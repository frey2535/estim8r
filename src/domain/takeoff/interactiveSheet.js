/**
 * @param {any} saved
 * @param {any} pageCount
 */
export function normalizePageTakeoff(saved, pageCount = 1) {
  const count = Math.max(1, Number(pageCount) || 1);
  const next = {};
  for (let page = 1; page <= count; page += 1) {
    const value = saved?.[page] ?? saved?.[String(page)];
    next[page] = value === false ? false : true;
  }
  return next;
}

/**
 * @param {any} state
 * @param {any} page
 */
export function isPageTakeoffEnabled(state, page) {
  const value = state?.[page] ?? state?.[String(page)];
  return value !== false;
}

/**
 * @param {any} state
 * @param {any} page
 * @param {any} enabled
 */
export function setPageTakeoff(state, page, enabled) {
  return { ...(state || {}), [Number(page) || 1]: Boolean(enabled) };
}

/**
 * @param {any} pages
 * @param {any} includePage
 */
export function pagesIncludedInTakeoff(pages, includePage) {
  return (pages || []).filter((page) => (
    page
    && page.takeoffDisabled !== true
    && (typeof includePage !== "function" || includePage(page))
  ));
}

/**
 * @param {any} objects
 */
export function countInteractiveObjects(objects = []) {
  let symbols = 0;
  let circuits = 0;
  let rooms = 0;
  for (const object of objects) {
    if (object?.objectKind === "unclassified-vector" || object?.objectKind === "recognized-device") symbols += 1;
    else if (object?.objectKind === "circuit") circuits += 1;
    else if (object?.objectKind === "room") rooms += 1;
  }
  return { symbols, circuits, rooms };
}

/**
 * @param {any} fileName
 * @param {any} counts
 * @param {any} options
 */
export function interactiveOpenMessage(fileName, counts = {}, options = {}) {
  const name = fileName || "Drawing";
  if (options.image) {
    return `${name} is open. Pan, zoom, and the takeoff tools work now. Printed symbol, line, and room selection needs a PDF vector layer.`;
  }
  const symbols = Number(counts.symbols) || 0;
  const circuits = Number(counts.circuits) || 0;
  const rooms = Number(counts.rooms) || 0;
  if (!symbols && !circuits && !rooms) {
    return `${name} is open and interactive. Pan, zoom, and takeoff tools are ready. Symbol, line, and room selection appears when the vector layer is read.`;
  }
  const symbolLabel = `${symbols} symbol${symbols === 1 ? "" : "s"}`;
  const lineLabel = `${circuits} line${circuits === 1 ? "" : "s"}`;
  const roomLabel = `${rooms} room${rooms === 1 ? "" : "s"}`;
  return `${name} is interactive. Select ${symbolLabel}, ${lineLabel}, and ${roomLabel}. Name a line or room before it is used in the bid. Takeoff can be turned on or off for each page.`;
}

/**
 * @param {any} areaSf
 * @param {any} heightFeet
 */
export function volumeCubicFeet(areaSf, heightFeet) {
  const area = Number(areaSf);
  const height = Number(heightFeet);
  if (!Number.isFinite(area) || !Number.isFinite(height) || area <= 0 || height <= 0) return null;
  return area * height;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/**
 * @param {any} marks
 * @param {any} options
 */
export function quantityLinkCsv(marks = [], options = {}) {
  const header = ["Sheet", "Kind", "Name", "Circuit", "Count", "Length LF", "Area SF", "Height FT", "Volume CF", "Bid use", "Prediction"];
  const lines = [header.join(",")];
  for (const mark of marks || []) {
    const area = Number(mark?.areaSf ?? mark?.storedSf);
    const height = Number(mark?.heightFeet);
    const volume = volumeCubicFeet(area, height);
    lines.push([
      mark?.sheet || 1,
      mark?.objectKind || mark?.type || "",
      mark?.roomName || mark?.symbolLabel || "",
      mark?.circuit || mark?.circuitNumber || "",
      mark?.type === "count" || mark?.type === "drop" ? 1 : "",
      mark?.storedFeet ?? "",
      Number.isFinite(area) ? area : "",
      Number.isFinite(height) && height > 0 ? height : "",
      volume == null ? "" : volume.toFixed(2),
      mark?.bidUse === false ? "no" : "yes",
      mark?.prediction ? "yes" : "no",
    ].map(csvCell).join(","));
  }
  const slips = options.slips || [];
  if (slips.length) {
    lines.push("");
    lines.push("Slip sheets");
    for (const slip of slips) lines.push([slip.afterPage, "slip-sheet", slip.title || "Slip sheet"].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export async function quantityLinkChecksum(csv) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SHA-256 is not available in this runtime.");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(String(csv || "")));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return {
    algorithm: "SHA-256",
    digest: hex,
    purpose: "Integrity checksum for this quantity export. This is not a certificate-backed digital signature.",
  };
}

/**
 * @param {any} marks
 * @param {any} selected
 */
export function visualSearchCounts(marks = [], selected) {
  const key = String(selected?.typeCode || selected?.abbr || selected?.symbol || "").trim().toUpperCase();
  if (!key || key === "UNKNOWN" || key === "?") return [];
  const bySheet = new Map();
  for (const mark of marks) {
    if (mark?.bidUse === false) continue;
    const markKey = String(mark?.typeCode || mark?.abbr || mark?.symbol || "").trim().toUpperCase();
    if (markKey !== key) continue;
    const sheet = mark.sheet || 1;
    bySheet.set(sheet, (bySheet.get(sheet) || 0) + 1);
  }
  return [...bySheet.entries()]
    .map(([sheet, count]) => ({ sheet, count }))
    .sort((a, b) => a.sheet - b.sheet);
}

/**
 * @param {any} chest
 * @param {any} item
 */
export function addToolChestItem(chest = [], item = {}) {
  const name = String(item.name || "").trim();
  if (!name) return [...chest];
  const next = {
    id: item.id || `chest-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    tool: item.tool || "count",
    color: item.color || "#2563eb",
    symbolId: item.symbolId || "",
    category: item.category || "",
    lineSize: item.lineSize ?? null,
    markerSize: item.markerSize ?? null,
  };
  return [...chest.filter((row) => row.id !== next.id && row.name !== next.name), next];
}

/**
 * @param {any} slips
 * @param {any} afterPage
 * @param {any} title
 */
export function addSlipSheet(slips = [], afterPage, title) {
  const page = Number(afterPage) || 1;
  const name = String(title || "").trim() || "Slip sheet";
  return [...slips, { id: `slip-${page}-${slips.length + 1}`, afterPage: page, title: name, kind: "slip-sheet" }];
}

/**
 * @param {any} pageCount
 * @param {any} slips
 */
export function interleaveSlipSheets(pageCount, slips = []) {
  const count = Math.max(0, Number(pageCount) || 0);
  const rows = [];
  for (let page = 1; page <= count; page += 1) {
    rows.push({ kind: "sheet", page });
    for (const slip of slips) {
      if (Number(slip?.afterPage) === page) rows.push({ kind: "slip-sheet", title: slip.title || "Slip sheet", afterPage: page });
    }
  }
  return rows;
}

/**
 * @param {any} session
 */
export function studioPackage(session = {}) {
  return {
    version: 1,
    kind: "estim8r-studio-session",
    exportedAt: new Date().toISOString(),
    fileName: session.fileName || "",
    marks: session.marks || [],
    pageTakeoff: session.pageTakeoff || {},
    slips: session.slips || [],
    toolChest: session.toolChest || [],
  };
}

/**
 * @param {any} currentMarks
 * @param {any} incoming
 */
export function mergeStudioPackage(currentMarks = [], incoming) {
  if (!incoming || incoming.kind !== "estim8r-studio-session" || !Array.isArray(incoming.marks)) return currentMarks;
  const byId = new Map(currentMarks.filter((mark) => mark?.id).map((mark) => [mark.id, mark]));
  for (const mark of incoming.marks) {
    if (!mark?.id) continue;
    byId.set(mark.id, { ...(byId.get(mark.id) || {}), ...mark });
  }
  return [...byId.values()];
}
