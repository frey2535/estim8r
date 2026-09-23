/** Pan/pinch math shared with takeoff's free-pan feel. */

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
