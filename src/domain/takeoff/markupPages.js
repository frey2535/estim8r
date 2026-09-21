export const DEVICE_PAGE_ORDER = [
  "Lighting",
  "Receptacles",
  "Switches",
  "Equipment",
  "HVAC",
  "Fire Alarm",
  "Panels / MCC",
  "Low Voltage",
  "Access Control",
  "Controls",
];

function isConduitMark(mark) {
  return mark?.tool === "conduit" || (mark?.type === "route" && mark?.tool === "conduit");
}

const HVAC_RE = /\bhvac\b|ahu|rtu|vav|condenser|heat\s*pump|furnace|unit\s*heater|fan-?coil|humidistat|thermostat/i;
const FIRE_RE = /fire\s*alarm|smoke|strobe|horn|pull\s*station|facp/i;
const MATCH_RADIUS = 2.5;

export function reviewCategoryForMark(mark) {
  if (isConduitMark(mark) || mark?.category === "Raceway") return "Conduit";
  const category = String(mark?.category || "").trim();
  const blob = `${category} ${mark?.symbol || ""} ${mark?.symbolLabel || ""} ${mark?.abbr || ""}`;
  if (/^hvac$/i.test(category) || HVAC_RE.test(blob)) return "HVAC";
  if (/fire\s*alarm/i.test(category) || FIRE_RE.test(category)) return "Fire Alarm";
  return category || "Uncategorized";
}

export function flattenMarkupMarks(markup) {
  if (Array.isArray(markup?.marks)) return markup.marks;
  return (markup?.pages || []).flatMap((page) => (page.marks || []).map((mark) => ({
    ...mark,
    sheet: mark.sheet || page.page || 1,
  })));
}

export function deviceCategoriesInMarks(marks) {
  const found = new Set();
  for (const mark of marks || []) {
    if (mark.type !== "count" && mark.type !== "drop") continue;
    const category = reviewCategoryForMark(mark);
    if (category && category !== "Conduit") found.add(category);
  }
  const preferred = DEVICE_PAGE_ORDER.filter((category) => found.has(category));
  const extra = [...found].filter((category) => !DEVICE_PAGE_ORDER.includes(category)).sort();
  return [...preferred, ...extra];
}

function distance(a, b) {
  return Math.hypot((Number(a?.x) || 0) - (Number(b?.x) || 0), (Number(a?.y) || 0) - (Number(b?.y) || 0));
}

function nearestPointDistance(mark, points) {
  let best = Infinity;
  for (const point of points || []) {
    const next = distance(mark, point);
    if (next < best) best = next;
  }
  return best;
}

export function associateDevicesToConduits(marks) {
  const conduits = (marks || []).filter(isConduitMark);
  const devices = (marks || []).filter((mark) => mark.type === "count" || mark.type === "drop");
  const groups = conduits.map((conduit) => ({
    conduitId: conduit.id,
    runNumber: conduit.runNumber || null,
    label: [`Run ${conduit.runNumber || ""}`, conduit.symbolLabel || conduit.conduitSize || "Conduit"].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
    sheet: conduit.sheet || 1,
    conduit,
    deviceIds: [],
    devices: [],
  }));
  const byId = new Map(groups.map((group) => [group.conduitId, group]));

  for (const device of devices) {
    const assigned = device.circuitRunId && byId.get(device.circuitRunId);
    if (assigned && (assigned.sheet === (device.sheet || 1))) {
      assigned.deviceIds.push(device.id);
      assigned.devices.push(device);
      continue;
    }
    let best = null;
    let bestDist = Infinity;
    for (const group of groups) {
      if (group.sheet !== (device.sheet || 1)) continue;
      const next = nearestPointDistance(device, group.conduit.points);
      if (next < bestDist) {
        bestDist = next;
        best = group;
      }
    }
    if (best && bestDist <= MATCH_RADIUS) {
      best.deviceIds.push(device.id);
      best.devices.push(device);
    }
  }
  return groups;
}

export function buildReviewMarkupPages({ marks } = {}) {
  const list = marks || [];
  const sheets = [...new Set(list.map((mark) => Number(mark.sheet) || 1))].sort((a, b) => a - b);
  const reviewPages = [];

  for (const sheet of sheets) {
    const sheetMarks = list.filter((mark) => (Number(mark.sheet) || 1) === sheet);
    const conduits = sheetMarks.filter(isConduitMark);
    if (conduits.length) {
      reviewPages.push({
        id: `conduit-${sheet}`,
        kind: "conduit",
        title: `Sheet ${sheet} — Conduit runs`,
        sourcePage: sheet,
        marks: conduits,
        summary: `${conduits.length} conduit run${conduits.length === 1 ? "" : "s"}`,
      });
    }
    for (const category of deviceCategoriesInMarks(sheetMarks)) {
      const deviceMarks = sheetMarks.filter((mark) => (
        (mark.type === "count" || mark.type === "drop")
        && reviewCategoryForMark(mark) === category
      ));
      if (!deviceMarks.length) continue;
      reviewPages.push({
        id: `devices-${category}-${sheet}`,
        kind: "devices",
        category,
        title: `Sheet ${sheet} — ${category}`,
        sourcePage: sheet,
        marks: deviceMarks,
        summary: `${deviceMarks.length} ${category} count${deviceMarks.length === 1 ? "" : "s"}`,
      });
    }
    if (conduits.length) {
      const groups = associateDevicesToConduits(sheetMarks);
      reviewPages.push({
        id: `circuits-${sheet}`,
        kind: "circuits",
        title: `Sheet ${sheet} — Circuits per conduit`,
        sourcePage: sheet,
        marks: [...conduits, ...sheetMarks.filter((mark) => mark.type === "count" || mark.type === "drop")],
        groups: groups.map((group) => ({
          conduitId: group.conduitId,
          runNumber: group.runNumber,
          label: group.label,
          deviceIds: group.deviceIds,
          deviceCount: group.devices.length,
        })),
        summary: `${groups.length} conduit group${groups.length === 1 ? "" : "s"}`,
      });
    }
  }

  return reviewPages;
}

export function assignDeviceToConduit(marks, deviceId, conduitId) {
  return (marks || []).map((mark) => (
    mark.id === deviceId ? { ...mark, circuitRunId: conduitId || null } : mark
  ));
}
