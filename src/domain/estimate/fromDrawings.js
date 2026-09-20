const HEADER_FIELDS = [
  "projectName",
  "projectAddress",
  "estimateNumber",
  "customerCompany",
  "customerName",
  "customerPhone",
  "customerEmail",
];

const EMPTY_HEADER = Object.fromEntries(HEADER_FIELDS.map((field) => [field, ""]));

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+1[\s.-]?)?(?:\(?\d{3}\)?[\s.-])\d{3}[\s.-]\d{4}\b/g;
const STREET_RE = /^(\d{1,6}\s+.+?\s+(?:rd|road|st|street|ave|avenue|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pkwy|parkway|hwy|circle|cir|pl|place)\b\.?)(?:,)?$/i;
const CITY_STATE_ZIP_RE = /^([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2}|[A-Za-z]{4,})\s+(\d{5}(?:-\d{4})?)$/;
const PROJECT_NO_RE = /\b(?:comm(?:ission)?|proj(?:ect)?(?:\s*#|\.?#)?|job(?:\s*#)?)\s*[:#]?\s*(\d{4,8})\b/i;
const CITY_OF_RE = /\bCITY OF\s+[A-Z][A-Z .'-]{1,40}/;
const CONTACT_LABEL_RE = /^(?:contact(?:\s+name)?|attn|attention|project manager)\s*[:\-]\s*(.+)$/i;
const COMPANY_LABEL_RE = /^(?:owner|client|customer|company)\s*[:\-]\s*(.+)$/i;
const SKIP_NAME_RE = /^(author|checker|drawn|check|n\/?a|tbd|none)$/i;
const PLACEHOLDER_NAME_RE = /^(author|checker)$/i;
const STATE_LINE_RE = /^(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)$/;
const SHEET_ID_RE = /^[A-Z]\d+\.\d+[A-Z]?$/;
const GRID_RE = /^[\dA-F](?:\s+[\dA-F]){2,}$/;

export function emptyDrawingHeader() {
  return { ...EMPTY_HEADER };
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return "";
  if (/^8(?:11|00|88|77|66|55)$/.test(ten.slice(0, 3)) && ten.slice(3) === "0000000") return "";
  if (ten === "0000000000") return "";
  return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function isStreetLine(line) {
  return STREET_RE.test(clean(line).replace(/,$/, ""));
}

function isCityStateZip(line) {
  return CITY_STATE_ZIP_RE.test(clean(line).replace(/,$/, ""));
}

function parseStreet(line) {
  const match = clean(line).replace(/,$/, "").match(STREET_RE);
  return match ? match[1].replace(/\.$/, "") : "";
}

function parseCityStateZip(line) {
  const match = clean(line).replace(/,$/, "").match(CITY_STATE_ZIP_RE);
  if (!match) return "";
  const state = match[2].length === 2 ? match[2].toUpperCase() : match[2];
  return `${match[1]}, ${state} ${match[3]}`;
}

function looksLikePersonName(value) {
  const name = clean(value);
  if (!name || SKIP_NAME_RE.test(name) || PLACEHOLDER_NAME_RE.test(name)) return false;
  if (/@/.test(name) || CITY_OF_RE.test(name) || /architect|engineer|city of/i.test(name)) return false;
  if (/^[A-Z]{1,4}$/.test(name)) return false;
  const words = name.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /^[A-Za-z][A-Za-z.'-]{1,20}$/.test(word));
}

function isTitleLine(line) {
  const text = clean(line);
  if (!text) return false;
  if (GRID_RE.test(text) || STATE_LINE_RE.test(text) || SHEET_ID_RE.test(text)) return false;
  if (/^[A-F]$/.test(text)) return false;
  if (/^(title sheet|cover sheet|scale:?|revisions?|#|description|date|num)$/i.test(text)) return false;
  if (/^(comm|date|drawn|check|proj)\b/i.test(text)) return false;
  if (CITY_OF_RE.test(text) || COMPANY_LABEL_RE.test(text)) return false;
  if (/architect|engineer/i.test(text)) return false;
  if (isStreetLine(text) || isCityStateZip(text)) return false;
  if (EMAIL_RE.test(text) || PHONE_RE.test(text)) return false;
  if (/^https?:|^www\.|\.com\b/i.test(text)) return false;
  return /[A-Za-z]/.test(text) && text.length <= 80;
}

export function findEmails(text) {
  return [...String(text || "").matchAll(EMAIL_RE)]
    .map((match) => match[0].toLowerCase())
    .filter((email, index, list) => list.indexOf(email) === index);
}

export function findPhones(text) {
  return [...String(text || "").matchAll(PHONE_RE)]
    .map((match) => normalizePhone(match[0]))
    .filter((phone, index, list) => phone && list.indexOf(phone) === index);
}

function findProjectNumber(text) {
  const match = String(text || "").match(PROJECT_NO_RE);
  return match ? match[1] : "";
}

function findCompany(lines) {
  for (const line of lines) {
    const labeled = clean(line).match(COMPANY_LABEL_RE);
    if (labeled) {
      const value = clean(labeled[1].replace(/\b(201|220|\d{1,6}\s).*$/, ""));
      if (value && !/architect|engineer/i.test(value)) return value;
    }
    const city = clean(line).match(CITY_OF_RE);
    if (city) return clean(city[0]);
  }
  return "";
}

function findContactName(lines) {
  for (const line of lines) {
    const labeled = clean(line).match(CONTACT_LABEL_RE);
    if (labeled && looksLikePersonName(labeled[1])) return clean(labeled[1]);
    const drawn = clean(line).match(/^(?:drawn|checked? by)\s*[:\-]\s*(.+)$/i);
    if (drawn && looksLikePersonName(drawn[1])) return clean(drawn[1]);
  }
  return "";
}

function findProjectName(lines) {
  const names = [];
  for (const line of lines) {
    if (isStreetLine(line) || isCityStateZip(line) || CITY_OF_RE.test(line)) break;
    if (!isTitleLine(line)) {
      if (names.length) break;
      continue;
    }
    names.push(clean(line));
    if (names.join(" ").length > 90) break;
  }
  return names.join(" ").replace(/\s+/g, " ").trim();
}

function findProjectAddress(lines) {
  let section = "project";
  const found = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = clean(lines[index]);
    if (CITY_OF_RE.test(line) || COMPANY_LABEL_RE.test(line)) section = "owner";
    else if (/architect|engineer/i.test(line)) section = "firm";
    if (!isStreetLine(line) || found[section]) continue;
    const street = parseStreet(line);
    const next = parseCityStateZip(lines[index + 1] || "");
    found[section] = next ? `${street}, ${next}` : street;
  }
  return found.project || "";
}

export function parseTitleBlock(text) {
  const raw = String(text || "").replace(/\r/g, "");
  const header = emptyDrawingHeader();
  if (!raw.trim()) return header;
  const lines = raw.split("\n").map((line) => clean(line)).filter(Boolean);
  header.customerEmail = findEmails(raw)[0] || "";
  header.customerPhone = findPhones(raw)[0] || "";
  header.estimateNumber = findProjectNumber(raw);
  header.customerCompany = findCompany(lines);
  header.customerName = findContactName(lines);
  header.projectName = findProjectName(lines);
  header.projectAddress = findProjectAddress(lines);
  return header;
}

export function titleBlockRowsFromItems(items, viewport, rightRatio = 0.62) {
  const width = Number(viewport?.width) || 0;
  if (!width) return [];
  const right = (items || []).filter((item) => Number(item.x) > width * rightRatio);
  const rows = [];
  const sorted = [...right].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const item of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - item.y) <= 3.5) last.cells.push(item);
    else rows.push({ y: item.y, cells: [item] });
  }
  return rows.map((row) => (
    [...row.cells].sort((a, b) => a.x - b.x).map((cell) => String(cell.str || "").trim()).filter(Boolean).join(" ")
  )).filter(Boolean);
}

function pickField(sources, keys) {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = clean(source[key]);
      if (value) return value;
    }
  }
  return "";
}

export function headerFromMarkup(markup) {
  if (!markup || typeof markup !== "object") return emptyDrawingHeader();
  const nested = [markup.titleBlock, markup.header, markup.metadata, markup];
  return {
    projectName: pickField(nested, ["projectName", "project"]),
    projectAddress: pickField(nested, ["projectAddress", "address"]),
    estimateNumber: pickField(nested, ["estimateNumber", "projectNumber", "comm"]),
    customerCompany: pickField(nested, ["customerCompany", "company", "owner"]),
    customerName: pickField(nested, ["customerName", "contactName", "contact"]),
    customerPhone: normalizePhone(pickField(nested, ["customerPhone", "phone"])) || pickField(nested, ["customerPhone", "phone"]),
    customerEmail: pickField(nested, ["customerEmail", "email"]).toLowerCase(),
  };
}

export function headerFromFileName(fileName) {
  const header = emptyDrawingHeader();
  const base = String(fileName || "").replace(/\.[^.]+$/, "").trim();
  if (!base) return header;
  const numbered = base.match(/^(\d{4,8})\s*[-_]\s*(.+)$/);
  if (numbered) {
    header.estimateNumber = numbered[1];
    header.projectName = numbered[2].replace(/[-_\s]*drawings?$/i, "").replace(/[-_]+/g, " ").trim() || base;
  } else {
    header.projectName = base;
  }
  return header;
}

export function headerFromDrawings({ fileName, drawingDocs, markup } = {}) {
  const fromMarkup = headerFromMarkup(markup);
  const fromBlock = drawingDocs?.titleBlock && typeof drawingDocs.titleBlock === "object"
    ? { ...emptyDrawingHeader(), ...drawingDocs.titleBlock }
    : parseTitleBlock(drawingDocs?.titleBlockText || "");
  const fromFile = headerFromFileName(fileName);
  const header = emptyDrawingHeader();
  for (const field of HEADER_FIELDS) {
    header[field] = fromMarkup[field] || fromBlock[field] || "";
  }
  if (!header.projectName) header.projectName = fromFile.projectName;
  if (!header.estimateNumber) header.estimateNumber = fromFile.estimateNumber;
  return header;
}

export function isAutoProjectName(name, fileName) {
  const current = clean(name);
  if (!current || current === "Drawing estimate") return true;
  const stem = String(fileName || "").replace(/\.[^.]+$/, "");
  return current === stem;
}

export function fillEmptyHeader(header, extracted, { fileName } = {}) {
  const next = { ...emptyDrawingHeader(), ...header };
  const incoming = extracted || {};
  for (const field of HEADER_FIELDS) {
    const value = clean(incoming[field]);
    if (!value) continue;
    const current = clean(next[field]);
    if (!current || (field === "projectName" && isAutoProjectName(current, fileName))) {
      next[field] = value;
    }
  }
  return next;
}

export function titleBlockForMarkup(header) {
  const block = emptyDrawingHeader();
  let any = false;
  for (const field of HEADER_FIELDS) {
    const value = clean(header?.[field]);
    if (value) {
      block[field] = value;
      any = true;
    }
  }
  return any ? block : null;
}
