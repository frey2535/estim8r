export const CUSTOM_LABOR_KEY = "estim8r.custom-labor.v1";

export function normalizeCustomLabor(row) {
  const normal = row.normal_mh ?? row.normalMh;
  return {
    id: row.id,
    laborItemId: row.labor_item_id || row.laborItemId || "",
    itemName: row.item_name || row.itemName || "",
    category: row.category || "",
    subcategory: row.subcategory || "",
    size: row.size || "",
    unit: row.unit || "EA",
    normal_mh: normal == null || normal === "" ? null : Number(normal),
    difficult_mh: row.difficult_mh ?? row.difficultMh ?? null,
    very_difficult_mh: row.very_difficult_mh ?? row.veryDifficultMh ?? null,
    notes: row.notes || "",
    active: row.active !== false,
  };
}

export function findCustomLabor(rows, { laborItemId, itemName, unit } = {}) {
  const list = (rows || []).map(normalizeCustomLabor).filter((row) => row.active);
  if (laborItemId) {
    const match = list.find((row) => row.laborItemId === laborItemId);
    if (match) return match;
  }
  if (itemName) {
    return list.find((row) => (
      row.itemName.toLowerCase() === String(itemName).toLowerCase()
      && (!unit || row.unit === unit)
    )) || null;
  }
  return null;
}

export function upsertCustomLabor(rows, input) {
  const next = normalizeCustomLabor({
    id: input.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `custom-${Date.now()}`),
    ...input,
  });
  if (next.normal_mh == null) {
    throw new Error("Custom labor requires estimator-entered man-hours.");
  }
  const list = (rows || []).map(normalizeCustomLabor);
  const index = list.findIndex((row) => row.id === next.id || (next.laborItemId && row.laborItemId === next.laborItemId));
  if (index >= 0) {
    list[index] = { ...list[index], ...next, id: list[index].id };
    return { rows: list, saved: list[index] };
  }
  return { rows: [next, ...list], saved: next };
}
