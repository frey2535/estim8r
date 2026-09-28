/** Force conduit segments onto horizontal / vertical (90°) runs. */

export function snapOrthogonalPoint(from, to) {
  if (!from || !to) return to;
  const dx = Math.abs(Number(to.x) - Number(from.x));
  const dy = Math.abs(Number(to.y) - Number(from.y));
  if (dx >= dy) return { x: Number(to.x), y: Number(from.y) };
  return { x: Number(from.x), y: Number(to.y) };
}

export function orthogonalizePolyline(points = []) {
  if (!Array.isArray(points) || points.length < 2) return [...(points || [])];
  const out = [{ x: Number(points[0].x), y: Number(points[0].y) }];
  for (let index = 1; index < points.length; index += 1) {
    out.push(snapOrthogonalPoint(out[out.length - 1], points[index]));
  }
  return out;
}

export function previewOrthogonalSegment(draftPoints = [], hover) {
  if (!hover) return draftPoints;
  if (!draftPoints.length) return [hover];
  return [...draftPoints, snapOrthogonalPoint(draftPoints[draftPoints.length - 1], hover)];
}
