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

export function legendEntryForMark(mark, drawingSymbols = [], options = {}) {
  if (!mark) return null;
  const list = (drawingSymbols || []).filter((item) => planAllows(item, options.planType));

  if (mark.legendEntryId) {
    const exactId = list.find((item) => item.id === mark.legendEntryId);
    if (exactId) return exactId;
  }

  const wanted = code(mark.legendCode || mark.typeCode || mark.abbr);
  if (wanted) {
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

  // Only use symbol id as a fallback when it is genuinely unique. Generic
  // catalog ids such as "2x4" are intentionally shared by multiple legend
  // types and were the source of incorrect hover labels.
  if (mark.symbol) {
    const byId = list.filter((item) => item.id === mark.symbol);
    if (byId.length === 1) return byId[0];
  }
  return null;
}

export function legendHoverData(mark, drawingSymbols = [], options = {}) {
  const entry = legendEntryForMark(mark, drawingSymbols, options);
  return {
    entry,
    code: clean(mark?.legendCode || entry?.abbr || entry?.type || mark?.typeCode || mark?.abbr || "UNKNOWN"),
    label: clean(mark?.legendLabel || entry?.label || mark?.symbolLabel || "No verified legend description"),
    category: clean(mark?.legendCategory || entry?.takeoffCategory || entry?.category || mark?.category || ""),
    source: clean(mark?.legendSource || entry?.source || ""),
    page: Number(mark?.legendSourcePage || entry?.page) || null,
    verified: Boolean(mark?.legendEntryId || entry),
  };
}
