/** Pan/pinch math shared with takeoff's free-pan feel. */

export const SHEET_PAN_THRESHOLD_PX = 5;
export const TAKEOFF_MIN_ZOOM = 0.25;
export const TAKEOFF_MAX_ZOOM = 8;

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

export function pinchMidpoint(a, b) {
  return {
    x: ((a?.x || 0) + (b?.x || 0)) / 2,
    y: ((a?.y || 0) + (b?.y || 0)) / 2,
  };
}

export function sheetPinchZoom(startZoom, startDistance, currentDistance, minZoom = 0.5, maxZoom = 4) {
  if (!startDistance) return startZoom;
  const next = startZoom * (currentDistance / startDistance);
  return Number(Math.min(maxZoom, Math.max(minZoom, next)).toFixed(2));
}

/**
 * Keep the drawing point under `focusClient` on screen when zoom changes.
 * The sheet is centered in the viewport, then translated by pan.
 */
export function sheetZoomAboutPoint({
  zoom,
  nextZoom,
  pan,
  focusClient,
  viewportRect,
  extraPan = { x: 0, y: 0 },
}) {
  const panX = pan?.x || 0;
  const panY = pan?.y || 0;
  const shiftX = extraPan?.x || 0;
  const shiftY = extraPan?.y || 0;
  if (!zoom || nextZoom === zoom) {
    return { zoom: nextZoom, pan: { x: panX + shiftX, y: panY + shiftY } };
  }
  const ratio = nextZoom / zoom;
  const centerX = (viewportRect?.left || 0) + (viewportRect?.width || 0) / 2;
  const centerY = (viewportRect?.top || 0) + (viewportRect?.height || 0) / 2;
  const cursorX = (focusClient?.x || 0) - centerX;
  const cursorY = (focusClient?.y || 0) - centerY;
  return {
    zoom: nextZoom,
    pan: {
      x: panX + (cursorX - panX) * (1 - ratio) + shiftX,
      y: panY + (cursorY - panY) * (1 - ratio) + shiftY,
    },
  };
}

export function sheetPinchViewport({
  startZoom,
  startDistance,
  startPan,
  startMid,
  currentDistance,
  currentMid,
  viewportRect,
  minZoom = TAKEOFF_MIN_ZOOM,
  maxZoom = TAKEOFF_MAX_ZOOM,
}) {
  const nextZoom = sheetPinchZoom(startZoom, startDistance, currentDistance, minZoom, maxZoom);
  return sheetZoomAboutPoint({
    zoom: startZoom,
    nextZoom,
    pan: startPan,
    focusClient: startMid,
    viewportRect,
    extraPan: {
      x: (currentMid?.x || 0) - (startMid?.x || 0),
      y: (currentMid?.y || 0) - (startMid?.y || 0),
    },
  });
}
