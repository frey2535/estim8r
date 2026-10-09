import { resolveAdjacentAnnotations } from "./adjacentAnnotations.js";

function clean(value) {
  return String(value || "").trim();
}

function code(value) {
  return clean(value).replace(/^type\s+/i, "").toUpperCase();
}

function planAllows(symbol, planType) {
  if (!planType) return true;
  const category = clean(symbol?.takeoffCategory || symbol?.category);
  if (planType === "lighting") {
    return !category || category === "Lighting" || category === "Switches";
  }
  if (planType === "power") {
    return !category || ["Receptacles", "Switches", "Equipment", "Panels / MCC", "Low Voltage", "HVAC"].includes(category);
  }
  return true;
}

export function isUnclassifiedMark(mark) {
  if (!mark) return true;
  const symbol = clean(mark.symbol).toLowerCase();
  const type = code(mark.typeCode || mark.abbr);
  return Boolean(
    mark.requiresClassification
    || mark.objectKind === "unclassified-vector"
    || symbol === "unclassified-device"
    || symbol === "unknown"
    || type === "UNKNOWN"
    || type === "?"
    || type === "",
  ) && !clean(mark.legendCode || mark.legendLabel);
}

export function paintedIdentity(mark) {
  if (!mark || isUnclassifiedMark(mark)) return null;
  const paintedCode = code(mark.legendCode || mark.typeCode || mark.abbr);
  if (!paintedCode || paintedCode === "UNKNOWN" || paintedCode === "?") return null;
  const tag = code(mark.circuitTagLocation?.text);
  if (tag && paintedCode === tag && !mark.legendEntryId && !clean(mark.legendLabel) && /^\d{1,3}[A-Z]?$/.test(paintedCode)) {
    return null;
  }
  return {
    code: paintedCode,
    label: clean(mark.legendLabel || mark.symbolLabel || `Type ${paintedCode}`),
    category: clean(mark.legendCategory || mark.category || ""),
    source: clean(mark.legendSource || ""),
    page: Number(mark.legendSourcePage) || null,
    entryId: mark.legendEntryId || null,
  };
}

export function legendEntryForMark(mark, drawingSymbols = [], options = {}) {
  if (!mark) return null;
  const list = (drawingSymbols || []).filter((item) => planAllows(item, options.planType));
  const painted = paintedIdentity(mark);

  if (mark.legendEntryId) {
    const exactId = list.find((item) => item.id === mark.legendEntryId);
    if (exactId) {
      if (!painted?.code || code(exactId.abbr || exactId.type) === painted.code || exactId.id === mark.legendEntryId) {
        return exactId;
      }
    }
  }

  const wanted = painted?.code || code(mark.legendCode || mark.typeCode || mark.abbr);
  if (wanted && wanted !== "UNKNOWN" && wanted !== "?") {
    const exactCode = list.filter((item) => code(item.abbr || item.type) === wanted);
    if (mark.legendSourcePage) {
      const pageMatch = exactCode.find((item) => Number(item.page) === Number(mark.legendSourcePage));
      if (pageMatch) return pageMatch;
    }
    if (exactCode.length === 1) return exactCode[0];
    if (exactCode.length > 1) {
      const sourceMatch = exactCode.find((item) => mark.legendSource && item.source === mark.legendSource);
      if (sourceMatch) return sourceMatch;
      return exactCode[0];
    }
  }

  return null;
}

export function legendHoverData(mark, drawingSymbols = [], options = {}) {
  if (isUnclassifiedMark(mark)) {
    return {
      entry: null,
      code: "",
      label: "Unclassified device",
      category: "Unclassified",
      source: "",
      page: null,
      verified: false,
    };
  }

  const painted = paintedIdentity(mark);
  const entry = legendEntryForMark(mark, drawingSymbols, options);
  const entryCode = code(entry?.abbr || entry?.type);
  const locked = painted && entry && entryCode && entryCode !== painted.code ? null : entry;
  const identity = painted || (locked ? {
    code: entryCode,
    label: clean(locked.label),
    category: clean(locked.takeoffCategory || locked.category),
    source: clean(locked.source),
    page: Number(locked.page) || null,
  } : null);

  if (!identity) {
    return {
      entry: null,
      code: "",
      label: "No verified legend description",
      category: "",
      source: "",
      page: null,
      verified: false,
    };
  }

  const annotations = resolveAdjacentAnnotations(mark.adjacentTokens || mark.nearbyTokens || []);
  const description = clean(locked?.description || locked?.legendDescription || locked?.symbolDescription || locked?.label || mark.legendDescription);
  const remarks = clean(locked?.remarks || locked?.legendRemarks || mark.legendRemarks);
  return {
    entry: locked,
    description: locked ? description : "",
    remarks: locked ? remarks : "",
    equipmentId: clean(mark.equipmentId || annotations.equipmentId),
    circuitNumbers: Array.isArray(mark.circuitNumbers) ? mark.circuitNumbers : annotations.circuitNumbers,
    panel: clean(mark.panel || annotations.panel),
    code: identity.code,
    label: identity.label || clean(locked?.label) || `Type ${identity.code}`,
    category: identity.category || clean(locked?.takeoffCategory || locked?.category),
    source: identity.source || clean(locked?.source),
    page: identity.page || Number(locked?.page) || null,
    verified: Boolean(locked),
  };
}

export function shouldShowSymbolHover(mark) {
  if (!mark) return false;
  if (isUnclassifiedMark(mark)) return false;
  return Boolean(paintedIdentity(mark));
}
