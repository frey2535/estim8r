function isConduitMark(mark) {
  return mark?.tool === "conduit" || (mark?.type === "route" && mark?.tool === "conduit");
}

export const JUNCTION_BOX_SYMBOL = "junction-box";
export const JUNCTION_BOX_LABEL = '4" square metal junction box';
export const EMT_CONNECTOR_SYMBOL = "emt-connector";
export const EMT_CONNECTOR_LABEL = "EMT connector";
export const JUNCTION_HIT = 1.6;

export function isJunctionBoxMark(mark) {
  return mark?.type === "count" && (
    mark.symbol === JUNCTION_BOX_SYMBOL
    || mark.abbr === "JB"
    || /junction box/i.test(String(mark.symbolLabel || ""))
  );
}

export function createJunctionBoxMark({
  id,
  sheet,
  trade,
  point,
  color,
  conduitId,
  connectorCount,
  source = "manual",
}) {
  return {
    id: id || `jb-${Math.random().toString(36).slice(2, 9)}`,
    sheet: sheet || 1,
    trade: trade || "electrical",
    source,
    type: "count",
    x: Number(point.x),
    y: Number(point.y),
    color: color || "#92400e",
    category: "Equipment",
    symbol: JUNCTION_BOX_SYMBOL,
    symbolLabel: JUNCTION_BOX_LABEL,
    abbr: "JB",
    typeCode: "JB",
    boxSize: '4"',
    boxShape: "square",
    boxMaterial: "metal",
    parentConduitId: conduitId || null,
    connectorCount: Math.max(0, Number(connectorCount) || 0),
    reviewStatus: "accepted",
    layer: "device",
    fillOpacity: 0.55,
  };
}

function pointHits(a, b, threshold = JUNCTION_HIT) {
  return Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.y) - Number(b?.y)) <= threshold;
}

/** How many EMT connectors a junction box needs from the conduits that meet it. */
export function connectorsForJunctionBox(box, marks = []) {
  if (!box) return 0;
  if (box.connectorCount != null && box.connectorCount !== "" && Number(box.connectorCount) > 0) {
    return Number(box.connectorCount);
  }
  let count = 0;
  for (const run of (marks || []).filter(isConduitMark)) {
    const points = run.points || [];
    if (!points.length) continue;
    const linked = (run.junctionBoxIds || []).includes(box.id);
    const atStart = pointHits(points[0], box);
    const atEnd = pointHits(points[points.length - 1], box);
    const mid = points.some((point, index) => index > 0 && index < points.length - 1 && pointHits(point, box));
    if (!linked && !atStart && !atEnd && !mid) continue;
    if ((atStart && !atEnd) || (!atStart && atEnd)) count += 1;
    else count += 2; // through box on this run
  }
  return count;
}

export function junctionHardwareTotals(marks = []) {
  const boxes = (marks || []).filter(isJunctionBoxMark);
  const emtConnectors = boxes.reduce((sum, box) => sum + connectorsForJunctionBox(box, marks), 0);
  return {
    junctionBoxes: boxes.length,
    emtConnectors,
    boxes,
  };
}

/** Schedule rows for JB + connectors only (no per-connector drawing marks). */
export function junctionHardwareRows(marks = []) {
  const totals = junctionHardwareTotals(marks);
  const rows = [];
  if (totals.junctionBoxes > 0) {
    rows.push({
      category: "Equipment",
      symbol: JUNCTION_BOX_LABEL,
      count: totals.junctionBoxes,
      lf: 0,
      sf: 0,
      notes: 0,
      hasLength: false,
      hasArea: false,
      hardware: "junction-box",
    });
  }
  if (totals.emtConnectors > 0) {
    rows.push({
      category: "Raceway",
      symbol: EMT_CONNECTOR_LABEL,
      count: totals.emtConnectors,
      lf: 0,
      sf: 0,
      notes: 0,
      hasLength: false,
      hasArea: false,
      hardware: "emt-connector",
    });
  }
  return { ...totals, rows };
}

export function attachJunctionToConduit(conduit, box) {
  if (!conduit || !box) return conduit;
  const ids = new Set([...(conduit.junctionBoxIds || []), box.id]);
  return { ...conduit, junctionBoxIds: [...ids] };
}
