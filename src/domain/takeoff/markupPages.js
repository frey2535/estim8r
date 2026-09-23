import { isNoteMark } from "./sheetNotes.js";

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

export function buildReviewMarkupPages({ marks, reconciliation, skippedSheets } = {}) {
  const list = marks || [];
  const sheets = [...new Set(list.map((mark) => Number(mark.sheet) || 1))].sort((a, b) => a - b);
  const reviewPages = [];

  if (reconciliation?.rows?.length) {
    reviewPages.push({
      id: "reconciliation",
      kind: "reconciliation",
      title: "Plan counts vs schedule",
      sourcePage: sheets[0] || 1,
      marks: [],
      reconciliation,
      summary: reconciliation.discrepancyCount
        ? `${reconciliation.discrepancyCount} type${reconciliation.discrepancyCount === 1 ? "" : "s"} differ — takeoff keeps plan counts`
        : `${reconciliation.persistedCount} plan count${reconciliation.persistedCount === 1 ? "" : "s"} (schedule is a check only)`,
    });
  }

  if ((skippedSheets || []).length) {
    reviewPages.push({
      id: "skipped-sheets",
      kind: "skipped",
      title: "Skipped sheets",
      sourcePage: skippedSheets[0]?.page || 1,
      marks: [],
      skippedSheets,
      summary: `${skippedSheets.length} non-electrical sheet${skippedSheets.length === 1 ? "" : "s"} were not counted`,
    });
  }

  for (const sheet of sheets) {
    const sheetMarks = list.filter((mark) => (Number(mark.sheet) || 1) === sheet);
    const notes = sheetMarks.filter(isNoteMark);
    if (notes.length) {
      reviewPages.push({
        id: `notes-${sheet}`,
        kind: "notes",
        title: `Sheet ${sheet} — Notes`,
        sourcePage: sheet,
        marks: notes,
        summary: `${notes.length} note${notes.length === 1 ? "" : "s"}`,
      });
    }
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
          circuits: [...new Set(group.devices.map((device) => String(device.circuit || device.circuitNumber || "").trim()).filter(Boolean))].sort(),
          devices: group.devices.map((device) => ({
            id: device.id,
            label: device.symbolLabel || device.symbol || device.abbr || "Device",
            circuit: String(device.circuit || device.circuitNumber || "").trim(),
          })),
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


export function conduitCircuitSchedule(marks) {
  return associateDevicesToConduits(marks).map((group) => {
    const circuits = [...new Set(
      group.devices
        .map((device) => String(device.circuit || device.circuitNumber || "").trim())
        .filter(Boolean),
    )].sort();
    return {
      conduitId: group.conduitId,
      runNumber: group.runNumber,
      sheet: group.sheet,
      label: group.label,
      conduitSize: group.conduit?.conduitSize || group.conduit?.abbr || "",
      conduitMaterial: group.conduit?.conduitMaterial || "",
      circuits,
      circuitCount: circuits.length,
      deviceCount: group.devices.length,
      devices: group.devices.map((device) => ({
        id: device.id,
        label: device.symbolLabel || device.symbol || device.abbr || "Device",
        circuit: String(device.circuit || device.circuitNumber || "").trim(),
      })),
    };
  }).sort((a, b) => (a.sheet - b.sheet) || ((a.runNumber || 0) - (b.runNumber || 0)));
}

export function conduitCircuitScheduleCsv(marks) {
  const csv = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const rows = [["Conduit #", "Sheet", "Conduit", "Circuits", "Device Count"]];
  for (const row of conduitCircuitSchedule(marks)) {
    rows.push([
      row.runNumber || "",
      row.sheet,
      [row.conduitSize, row.conduitMaterial].filter(Boolean).join(" ") || row.label,
      row.circuits.join(", "),
      row.deviceCount,
    ]);
  }
  return rows.map((row) => row.map(csv).join(",")).join("\n");
}
