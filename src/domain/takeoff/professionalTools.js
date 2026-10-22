import { areaFromPercent, feetFromPercent, polygonArea, polylineLength } from "./geometry.js";
import { volumeCubicFeet } from "./interactiveSheet.js";
import { revisionDelta } from "./liveLinkedTakeoff.js";

export const QUANTITY_LINK_CHANNEL = "estim8r-quantity-link";
export const QUANTITY_LINK_STORAGE = "estim8r-quantity-link-latest";
export const COLLAB_CHANNEL_PREFIX = "estim8r-takeoff-session:";

/**
 * @param {any} payload
 * @param {any} storage
 */
export function rememberLiveQuantity(payload, storage = globalThis.localStorage) {
  storage?.setItem?.(QUANTITY_LINK_STORAGE, JSON.stringify(payload));
}

/**
 * @param {any} storage
 */
export function readLiveQuantity(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(QUANTITY_LINK_STORAGE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const TRADE_PRESETS = [
  { id: "electrical-count", trade: "electrical", label: "Electrical count", tool: "count", unit: "EA" },
  { id: "electrical-conduit", trade: "electrical", label: "Conduit length", tool: "conduit", unit: "LF" },
  { id: "concrete-area", trade: "concrete", label: "Concrete area", tool: "area", unit: "SF" },
  { id: "concrete-volume", trade: "concrete", label: "Concrete volume", tool: "area", unit: "CF", asksHeight: true },
  { id: "drywall-area", trade: "drywall", label: "Drywall area", tool: "area", unit: "SF" },
  { id: "roofing-area", trade: "roofing", label: "Roofing area", tool: "area", unit: "SF" },
  { id: "landscaping-area", trade: "landscaping", label: "Landscape area", tool: "area", unit: "SF" },
];

function sizeOf(object) {
  const w = Number(object?.w || object?.outline?.w) || 0;
  const h = Number(object?.h || object?.outline?.h) || 0;
  return { long: Math.max(w, h), short: Math.min(w, h) };
}

/**
 * @param {any} objects
 * @param {any} seed
 * @param {any} tolerance
 */
export function visualSearchGeometry(objects = [], seed, tolerance = 0.22) {
  const base = sizeOf(seed);
  if (!base.long || !seed) return { total: 0, sheets: [], hits: [] };
  const limit = Math.max(0, Number(tolerance) || 0);
  const hits = [];
  for (const object of objects) {
    if (!object) continue;
    if (seed.objectKind && object.objectKind && object.objectKind !== seed.objectKind) continue;
    const next = sizeOf(object);
    if (!next.long) continue;
    const longGap = Math.abs(next.long - base.long) / base.long;
    const shortGap = Math.abs(next.short - base.short) / Math.max(base.short, 0.001);
    if (longGap > limit || shortGap > limit) continue;
    hits.push({
      sheet: object.sheet || 1,
      x: object.x,
      y: object.y,
      objectId: object.objectId || object.id || "",
      objectKind: object.objectKind || "",
    });
  }
  const bySheet = new Map();
  for (const hit of hits) bySheet.set(hit.sheet, (bySheet.get(hit.sheet) || 0) + 1);
  return {
    total: hits.length,
    sheets: [...bySheet.entries()].map(([sheet, count]) => ({ sheet, count })).sort((a, b) => a.sheet - b.sheet),
    hits,
  };
}

/**
 * @param {any} mark
 * @param {any} calibration
 * @param {any} aspect
 */
export function measureMark(mark, calibration, aspect = 1) {
  const points = Array.isArray(mark?.points) ? mark.points : [];
  const openLength = polylineLength(points, aspect);
  const closed = points.length >= 3;
  const perimeterPercent = closed ? polylineLength([...points, points[0]], aspect) : openLength;
  const areaPercent = closed ? polygonArea(points, aspect) : 0;
  const lengthLf = mark?.lengthEdited && mark.storedFeet != null && mark.storedFeet !== ""
    ? Number(mark.storedFeet)
    : feetFromPercent(openLength, calibration);
  const perimeterLf = feetFromPercent(perimeterPercent, calibration);
  const areaSf = mark?.areaSf != null && mark.areaSf !== ""
    ? Number(mark.areaSf)
    : areaFromPercent(areaPercent, calibration);
  return {
    lengthLf: Number.isFinite(lengthLf) ? lengthLf : null,
    perimeterLf: Number.isFinite(perimeterLf) ? perimeterLf : null,
    areaSf: Number.isFinite(areaSf) ? areaSf : null,
    volumeCf: volumeCubicFeet(areaSf, mark?.heightFeet),
  };
}

/**
 * @param {any} quantity
 * @param {any} wastePercent
 */
export function wasteQuantity(quantity, wastePercent) {
  const amount = Number(quantity);
  const waste = Number(wastePercent);
  if (!Number.isFinite(amount) || !Number.isFinite(waste) || waste < 0) return null;
  return amount * (1 + waste / 100);
}

/**
 * @param {any} expression
 * @param {any} variables
 */
export function evaluateFormula(expression, variables = {}) {
  const source = String(expression || "").replace(/\s+/g, "");
  if (!source) return { ok: false, error: "Enter a formula." };
  if (!/^[0-9a-zA-Z_+\-*/().]+$/.test(source)) return { ok: false, error: "Formula has an unsupported character." };
  let index = 0;
  const fail = (error) => ({ ok: false, error });
  function peek() { return source[index]; }
  function eat(char) {
    if (source[index] !== char) throw new Error(`Expected ${char}`);
    index += 1;
  }
  function readValue() {
    if (/[a-zA-Z_]/.test(peek() || "")) {
      let name = "";
      while (index < source.length && /[a-zA-Z0-9_]/.test(source[index])) name += source[index++];
      if (!Object.prototype.hasOwnProperty.call(variables, name)) throw new Error(`Unknown value ${name}`);
      const value = Number(variables[name]);
      if (!Number.isFinite(value)) throw new Error(`${name} is not a number`);
      return value;
    }
    let digits = "";
    while (index < source.length && /[0-9.]/.test(source[index])) digits += source[index++];
    if (!digits) throw new Error("Expected a number");
    const value = Number(digits);
    if (!Number.isFinite(value)) throw new Error("Invalid number");
    return value;
  }
  function factor() {
    if (peek() === "(") {
      eat("(");
      const value = addition();
      eat(")");
      return value;
    }
    if (peek() === "-") {
      eat("-");
      return -factor();
    }
    return readValue();
  }
  function term() {
    let value = factor();
    while (peek() === "*" || peek() === "/") {
      const op = source[index++];
      const right = factor();
      if (op === "/" && right === 0) throw new Error("Division by zero");
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }
  function addition() {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const op = source[index++];
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }
  try {
    const value = addition();
    if (index !== source.length) return fail("Could not read the whole formula");
    if (!Number.isFinite(value)) return fail("Formula did not produce a number");
    return { ok: true, value };
  } catch (error) {
    return fail(error.message || "Formula could not be calculated");
  }
}

/**
 * @param {any} assembly
 * @param {any} point
 * @param {any} sheet
 */
export function markFromAssembly(assembly, point, sheet = 1) {
  if (!assembly?.id || !point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  return {
    id: globalThis.crypto?.randomUUID?.() || `assembly-${assembly.id}-${point.x}-${point.y}`,
    type: "count",
    tool: "count",
    sheet: sheet || 1,
    x: Number(point.x),
    y: Number(point.y),
    assemblyId: assembly.id,
    symbolLabel: assembly.name || assembly.id,
    category: assembly.category || "Assembly",
    source: "assembly",
    reviewStatus: "accepted",
    bidUse: true,
    components: assembly.components || [],
  };
}

/**
 * @param {any} previous
 * @param {any} current
 */
export function revisionReport(previous = [], current = []) {
  const delta = revisionDelta(previous, current);
  return {
    added: delta.added.length,
    removed: delta.removed.length,
    unchanged: delta.unchanged.length,
    addedMarks: delta.added,
    removedMarks: delta.removed,
  };
}

/**
 * @param {Record<string, any>} object
 */
export function cropToObject({ object, viewWidth, viewHeight, sheetWidth, sheetHeight } = {}) {
  if (!object || !viewWidth || !viewHeight || !sheetWidth || !sheetHeight) return null;
  const w = Math.max(Number(object.w || object.outline?.w) || 8, 4);
  const h = Math.max(Number(object.h || object.outline?.h) || 8, 4);
  const zoom = Math.max(1, Math.min(8, Math.min(60 / w, 60 / h)));
  const fit = Math.min(
    Math.max(48, viewWidth - 16) / sheetWidth,
    Math.max(48, viewHeight - 16) / sheetHeight,
  );
  const displayW = sheetWidth * fit * zoom;
  const displayH = sheetHeight * fit * zoom;
  return {
    zoom,
    pan: {
      x: -((Number(object.x) - 50) / 100) * displayW,
      y: -((Number(object.y) - 50) / 100) * displayH,
    },
  };
}

/**
 * @param {any} a
 * @param {any} b
 */
export function haversineFeet(a, b) {
  if (!Number.isFinite(Number(a?.lat)) || !Number.isFinite(Number(a?.lng)) || !Number.isFinite(Number(b?.lat)) || !Number.isFinite(Number(b?.lng))) return null;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
  return meters * 3.280839895;
}

/**
 * @param {any} a
 * @param {any} b
 * @param {any} sheet
 */
export function aerialLengthMark(a, b, sheet = 1) {
  const feet = haversineFeet(a, b);
  if (feet == null) return null;
  return {
    id: globalThis.crypto?.randomUUID?.() || `aerial-${a.lat}-${b.lat}`,
    type: "line",
    tool: "linear",
    sheet,
    source: "aerial",
    symbolLabel: "Aerial length",
    category: "Site",
    points: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
    storedFeet: feet,
    lengthEdited: true,
    bidUse: true,
    aerial: { a, b },
  };
}

function xml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * @param {any} sheetName
 * @param {any} rows
 */
export function spreadsheetMl(sheetName, rows = []) {
  const table = rows.map((row) => {
    const cells = (row || []).map((cell) => {
      const text = cell == null ? "" : String(cell);
      const numeric = text.trim() !== "" && Number.isFinite(Number(text));
      const type = numeric ? "Number" : "String";
      return `<Cell><Data ss:Type="${type}">${xml(numeric ? Number(text) : text)}</Data></Cell>`;
    }).join("");
    return `<Row>${cells}</Row>`;
  }).join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${xml(sheetName || "Takeoff").slice(0, 31) || "Takeoff"}"><Table>${table}</Table></Worksheet>
</Workbook>`;
}

/**
 * @param {any} marks
 * @param {any} calibration
 * @param {any} aspect
 */
export function quantityWorkbookRows(marks = [], calibration = null, aspect = 1) {
  const rows = [["Sheet", "Name", "Kind", "Count", "Length LF", "Area SF", "Volume CF", "Circuit", "Assembly"]];
  for (const mark of marks) {
    const measured = measureMark(mark, calibration, aspect);
    rows.push([
      mark.sheet || 1,
      mark.roomName || mark.symbolLabel || "",
      mark.objectKind || mark.type || "",
      mark.type === "count" || mark.type === "drop" ? 1 : "",
      mark.storedFeet ?? measured.lengthLf ?? "",
      mark.areaSf ?? measured.areaSf ?? "",
      measured.volumeCf ?? "",
      mark.circuit || "",
      mark.assemblyId || "",
    ]);
  }
  return rows;
}

/**
 * @param {any} marks
 * @param {any} message
 */
export function applyRemoteMark(marks = [], message) {
  if (!message || message.kind !== "estim8r-collab") return marks;
  if (message.op === "upsert" && message.mark?.id) {
    return [...marks.filter((mark) => mark.id !== message.mark.id), message.mark];
  }
  if (message.op === "delete" && message.markId) return marks.filter((mark) => mark.id !== message.markId);
  if (message.op === "replace" && Array.isArray(message.marks)) return message.marks;
  return marks;
}

/**
 * @param {any} pageCount
 * @param {any} slips
 */
export function interleavePages(pageCount, slips = []) {
  const rows = [];
  const count = Math.max(0, Number(pageCount) || 0);
  for (let page = 1; page <= count; page += 1) {
    rows.push({ kind: "sheet", page, label: `Sheet ${page}` });
    for (const slip of slips) {
      if (Number(slip?.afterPage) === page) rows.push({ kind: "slip-sheet", page, label: slip.title || "Slip sheet" });
    }
  }
  return rows;
}

function bytesToBase64(bytes) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function base64ToBytes(value) {
  const text = atob(value);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);
  return bytes;
}

export async function createSigningKey() {
  return crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
}

export async function signQuantity(privateKey, payload) {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(String(payload || "")),
  );
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyQuantity(publicKey, payload, signature) {
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64ToBytes(signature),
    new TextEncoder().encode(String(payload || "")),
  );
}

/**
 * @param {any} marks
 */
export function reportLines(marks = []) {
  const rows = new Map();
  for (const mark of marks) {
    if (mark?.bidUse === false) continue;
    const name = mark.roomName || mark.symbolLabel || mark.type || "Item";
    const key = `${mark.category || ""}|${name}`;
    const row = rows.get(key) || { category: mark.category || "", name, count: 0, lengthLf: 0, areaSf: 0 };
    if (mark.type === "count" || mark.type === "drop") row.count += 1;
    if (mark.storedFeet != null && mark.storedFeet !== "") row.lengthLf += Number(mark.storedFeet) || 0;
    if (mark.areaSf != null && mark.areaSf !== "") row.areaSf += Number(mark.areaSf) || 0;
    rows.set(key, row);
  }
  return [...rows.values()];
}
