/** Sheet coordinates are 0–100 on each axis. Y is scaled by height/width so lengths are in width-percent. */

export function sheetAspect(widthPx, heightPx) {
  if (!widthPx || !heightPx) return 1;
  return heightPx / widthPx;
}

/**
 * @param {any} a
 * @param {any} b
 * @param {any} aspect
 */
export function widthPercentDistance(a, b, aspect = 1) {
  const dx = Number(b?.x) - Number(a?.x);
  const dy = (Number(b?.y) - Number(a?.y)) * Number(aspect || 1);
  return Math.hypot(dx, dy);
}

/**
 * @param {any} points
 * @param {any} aspect
 */
export function polylineLength(points, aspect = 1) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += widthPercentDistance(points[i - 1], points[i], aspect);
  }
  return total;
}

/**
 * @param {any} points
 * @param {any} aspect
 */
export function polygonArea(points, aspect = 1) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += Number(a.x) * Number(b.y) * aspect - Number(b.x) * Number(a.y) * aspect;
  }
  return Math.abs(sum) / 2;
}

/**
 * @param {any} a
 * @param {any} b
 * @param {any} feet
 * @param {any} aspect
 */
export function calibrationFromPoints(a, b, feet, aspect = 1) {
  const percentLength = widthPercentDistance(a, b, aspect);
  const knownFeet = Number(feet);
  if (!percentLength || !Number.isFinite(knownFeet) || knownFeet <= 0) return null;
  return { feet: knownFeet, percentLength, a, b };
}

/**
 * @param {any} percentLength
 * @param {any} calibration
 */
export function feetFromPercent(percentLength, calibration) {
  if (!calibration?.percentLength || !calibration.feet) return null;
  return percentLength * (calibration.feet / calibration.percentLength);
}

/**
 * @param {any} percentArea
 * @param {any} calibration
 */
export function areaFromPercent(percentArea, calibration) {
  if (!calibration?.percentLength || !calibration.feet) return null;
  const feetPerPercent = calibration.feet / calibration.percentLength;
  return percentArea * feetPerPercent * feetPerPercent;
}

/**
 * @param {any} value
 */
export function formatFeet(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 100) return `${value.toFixed(0)} LF`;
  if (value >= 10) return `${value.toFixed(1)} LF`;
  return `${value.toFixed(2)} LF`;
}

/**
 * @param {any} value
 */
export function formatArea(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 100) return `${value.toFixed(0)} SF`;
  return `${value.toFixed(1)} SF`;
}

export { snapOrthogonalPoint, orthogonalizePolyline, previewOrthogonalSegment } from "./ortho.js";

/**
 * @param {any} mark
 * @param {any} point
 * @param {any} aspect
 * @param {any} threshold
 */
export function hitTestMark(mark, point, aspect = 1, threshold = 2.2) {
  if (!mark || !point) return false;
  if (mark.points?.length) {
    for (let i = 1; i < mark.points.length; i += 1) {
      const dist = pointToSegment(point, mark.points[i - 1], mark.points[i], aspect);
      if (dist <= threshold) return true;
    }
    return mark.points.some((item) => widthPercentDistance(item, point, aspect) <= threshold);
  }
  return widthPercentDistance(mark, point, aspect) <= threshold;
}

function pointToSegment(p, a, b, aspect) {
  const ax = a.x;
  const ay = a.y * aspect;
  const bx = b.x;
  const by = b.y * aspect;
  const px = p.x;
  const py = p.y * aspect;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
