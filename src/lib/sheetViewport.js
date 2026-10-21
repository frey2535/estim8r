/** Pan/pinch/rotation math shared with takeoff's free-pan feel. */

export const SHEET_PAN_THRESHOLD_PX = 5;

export function sheetPanOffset(start, origin, current) {
  return {
    x: start.x + (current.x - origin.x),
    y: start.y + (current.y - origin.y),
  };
}

export function isSheetPanDrag(origin, current, threshold = SHEET_PAN_THRESHOLD_PX) {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  return (dx * dx + dy * dy) >= threshold * threshold;
}

export function pointerDistance(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

export function sheetPinchZoom(startZoom, startDistance, currentDistance, minZoom = 0.5, maxZoom = 4) {
  if (!startDistance) return startZoom;
  const next = startZoom * (currentDistance / startDistance);
  return Number(Math.min(maxZoom, Math.max(minZoom, next)).toFixed(2));
}

/** Snap sheet rotation to 0 / 90 / 180 / 270. */
export function normalizePageRotation(degrees) {
  const n = ((Number(degrees) || 0) % 360 + 360) % 360;
  const snapped = Math.round(n / 90) * 90;
  return snapped === 360 ? 0 : snapped;
}

/**
 * Rotate page-percent coordinates (0–100) so marks stay on the same printed
 * feature when the sheet is displayed at 90° increments.
 */
export function rotatePagePercent(point, rotation = 0) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const r = normalizePageRotation(rotation);
  if (r === 0) return { x, y };
  if (r === 90) return { x: y, y: 100 - x };
  if (r === 180) return { x: 100 - x, y: 100 - y };
  return { x: 100 - y, y: x };
}

export function unrotatePagePercent(point, rotation = 0) {
  const r = normalizePageRotation(rotation);
  if (r === 0) return rotatePagePercent(point, 0);
  return rotatePagePercent(point, (360 - r) % 360);
}

/**
 * Map a client point inside the sheet element's bounding rect to stable
 * page-percent coordinates. Pan/zoom are already baked into getBoundingClientRect
 * when the sheet node itself is transformed/resized; rotation remaps afterward.
 */
export function pagePercentFromClient(client, rect, rotation = 0) {
  if (!rect?.width || !rect?.height) return null;
  const x = ((Number(client?.x) - rect.left) / rect.width) * 100;
  const y = ((Number(client?.y) - rect.top) / rect.height) * 100;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return rotatePagePercent({ x, y }, rotation);
}

/**
 * Keep the page point under the cursor when zoom changes around a viewport center.
 * Mirrors TakeoffWorkspace wheel-zoom pan compensation.
 */
export function panAfterZoomAtCursor({ pan, zoom, nextZoom, cursorFromViewportCenter }) {
  if (!zoom || zoom === nextZoom) return { x: pan?.x || 0, y: pan?.y || 0 };
  const ratio = nextZoom / zoom;
  const cx = Number(cursorFromViewportCenter?.x) || 0;
  const cy = Number(cursorFromViewportCenter?.y) || 0;
  const px = Number(pan?.x) || 0;
  const py = Number(pan?.y) || 0;
  return {
    x: px + (cx - px) * (1 - ratio),
    y: py + (cy - py) * (1 - ratio),
  };
}
