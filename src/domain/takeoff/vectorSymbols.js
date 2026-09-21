export const DRAW_MOVE = 0;
export const DRAW_LINE = 1;
export const DRAW_CUBIC = 2;
export const DRAW_QUAD = 3;
export const DRAW_CLOSE = 4;

export const SYMBOL_MIN = 0.16;
export const SYMBOL_MAX = 5.8;
export const TAG_ASSOCIATE_RADIUS = 3.4;
export const OVERLAP_IOU = 0.55;

const IDENTITY = [1, 0, 0, 1, 0, 0];

export function multiplyCtm(a = IDENTITY, b = IDENTITY) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function applyCtm(ctm = IDENTITY, x = 0, y = 0) {
  return {
    x: ctm[0] * x + ctm[2] * y + ctm[4],
    y: ctm[1] * x + ctm[3] * y + ctm[5],
  };
}

export function boundsOfPoints(points = []) {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return boxFromExtents(minX, minY, maxX, maxY);
}

export function boxFromExtents(minX, minY, maxX, maxY) {
  const w = maxX - minX;
  const h = maxY - minY;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    w,
    h,
    cx: minX + w / 2,
    cy: minY + h / 2,
  };
}

export function parseDrawOps(data) {
  const list = data ? Array.from(data) : [];
  const points = [];
  let hasCurves = false;
  let closed = false;
  for (let index = 0; index < list.length;) {
    const op = list[index++];
    if (op === DRAW_MOVE || op === DRAW_LINE) {
      if (index + 1 >= list.length) break;
      points.push({ x: list[index++], y: list[index++], curve: false });
    } else if (op === DRAW_CUBIC) {
      if (index + 5 >= list.length) break;
      index += 4;
      points.push({ x: list[index++], y: list[index++], curve: true });
      hasCurves = true;
    } else if (op === DRAW_QUAD) {
      if (index + 3 >= list.length) break;
      index += 2;
      points.push({ x: list[index++], y: list[index++], curve: true });
      hasCurves = true;
    } else if (op === DRAW_CLOSE) {
      closed = true;
    } else {
      break;
    }
  }
  return { points, hasCurves, closed };
}

export function isSymbolSized(bounds) {
  if (!bounds) return false;
  const long = Math.max(bounds.w, bounds.h);
  const short = Math.min(bounds.w, bounds.h);
  if (long < SYMBOL_MIN || long > SYMBOL_MAX) return false;
  if (short < 0.1) return false;
  if (long / short > 8) return false;
  if (bounds.w * bounds.h > 18) return false;
  return true;
}

export function polygonArea(points = []) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0, last = points.length - 1; index < points.length; last = index++) {
    sum += points[last].x * points[index].y - points[index].x * points[last].y;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(points = []) {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    sum += Math.hypot(next.x - points[index].x, next.y - points[index].y);
  }
  return sum;
}

export function pathCircularity(points, bounds) {
  const area = polygonArea(points) || (bounds ? bounds.w * bounds.h * 0.785 : 0);
  const peri = polygonPerimeter(points) || (bounds ? 2 * (bounds.w + bounds.h) : 0);
  if (!area || !peri) return 0;
  return (4 * Math.PI * area) / (peri * peri);
}

export function isAxisAlignedRect(points = []) {
  const verts = uniqueVertices(points);
  if (verts.length < 4 || verts.length > 5) return false;
  let horiz = 0;
  let vert = 0;
  for (let index = 0; index < verts.length; index += 1) {
    const next = verts[(index + 1) % verts.length];
    const dx = Math.abs(next.x - verts[index].x);
    const dy = Math.abs(next.y - verts[index].y);
    if (dx < 0.04 && dy > 0.04) vert += 1;
    else if (dy < 0.04 && dx > 0.04) horiz += 1;
    else return false;
  }
  return horiz >= 2 && vert >= 2;
}

function uniqueVertices(points) {
  const verts = [];
  for (const point of points || []) {
    const last = verts[verts.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.03) continue;
    verts.push(point);
  }
  if (verts.length > 1) {
    const first = verts[0];
    const last = verts[verts.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 0.03) verts.pop();
  }
  return verts;
}

export function classifySymbolGeometry(points, bounds, options = {}) {
  const box = bounds || boundsOfPoints(points);
  if (!box) return null;
  const aspect = box.w / box.h;
  const circularity = options.hasCurves && aspect > 0.72 && aspect < 1.38
    ? Math.max(0.78, pathCircularity(points, box))
    : pathCircularity(points, box);
  if ((options.hasCurves || (points || []).length >= 8) && aspect > 0.72 && aspect < 1.38 && circularity >= 0.7) {
    return {
      kind: "circle",
      r: Math.max(box.w, box.h) / 2,
      w: box.w,
      h: box.h,
      cx: box.cx,
      cy: box.cy,
      points: points || [],
    };
  }
  if (isAxisAlignedRect(points) || ((points || []).length <= 6 && !options.hasCurves && aspect >= 1.12)) {
    return {
      kind: "rect",
      w: box.w,
      h: box.h,
      cx: box.cx,
      cy: box.cy,
      points: rectPoints(box),
    };
  }
  return {
    kind: "path",
    w: box.w,
    h: box.h,
    cx: box.cx,
    cy: box.cy,
    points: points || rectPoints(box),
  };
}

export function rectPoints(box) {
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
}

export function toCandidate(geometry) {
  if (!geometry) return null;
  const outline = {
    kind: geometry.kind,
    source: "vector",
    w: geometry.w,
    h: geometry.h,
    r: geometry.r,
    points: geometry.points || [],
  };
  return {
    cx: geometry.cx,
    cy: geometry.cy,
    kind: geometry.kind,
    w: geometry.w,
    h: geometry.h,
    r: geometry.r,
    points: geometry.points || [],
    outline,
  };
}

export function candidatesFromConstructedPaths(entries, toPagePct) {
  const raw = [];
  for (const entry of entries || []) {
    const ctm = entry.ctm || IDENTITY;
    const parsed = parseDrawOps(entry.drawOps);
    const pagePoints = parsed.points.map((point) => {
      const pdf = applyCtm(ctm, point.x, point.y);
      const page = toPagePct(pdf.x, pdf.y);
      return { ...page, curve: point.curve };
    });
    let bounds = boundsOfPoints(pagePoints);
    if (!bounds && entry.minMax && entry.minMax.length >= 4) {
      const aPdf = applyCtm(ctm, entry.minMax[0], entry.minMax[1]);
      const bPdf = applyCtm(ctm, entry.minMax[2], entry.minMax[3]);
      const a = toPagePct(aPdf.x, aPdf.y);
      const b = toPagePct(bPdf.x, bPdf.y);
      bounds = boxFromExtents(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.max(a.x, b.x),
        Math.max(a.y, b.y),
      );
    }
    if (!isSymbolSized(bounds)) continue;
    const geometry = classifySymbolGeometry(pagePoints.length ? pagePoints : rectPoints(bounds), bounds, {
      hasCurves: parsed.hasCurves,
    });
    const candidate = toCandidate(geometry);
    if (candidate) raw.push(candidate);
  }
  return mergeOverlappingCandidates(raw);
}

export function candidateFromPageBox(box) {
  if (!isSymbolSized(box)) return null;
  const geometry = classifySymbolGeometry(rectPoints(box), box);
  return toCandidate(geometry);
}

export function iou(a, b) {
  const minX = Math.max(a.cx - a.w / 2, b.cx - b.w / 2);
  const minY = Math.max(a.cy - a.h / 2, b.cy - b.h / 2);
  const maxX = Math.min(a.cx + a.w / 2, b.cx + b.w / 2);
  const maxY = Math.min(a.cy + a.h / 2, b.cy + b.h / 2);
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / (a.w * a.h + b.w * b.h - inter);
}

export function mergeOverlappingCandidates(candidates = []) {
  const list = [...candidates].sort((a, b) => (a.w * a.h) - (b.w * b.h));
  const kept = [];
  for (const item of list) {
    const overlap = kept.find((other) => iou(item, other) >= OVERLAP_IOU);
    if (overlap) continue;
    kept.push(item);
  }
  return kept;
}

export function containsPoint(candidate, point) {
  if (!candidate || !point) return false;
  if (candidate.kind === "circle") {
    return Math.hypot(point.x - candidate.cx, point.y - candidate.cy) <= (candidate.r || Math.max(candidate.w, candidate.h) / 2);
  }
  if (candidate.points?.length >= 3) return pointInPolygon(point, candidate.points);
  return Math.abs(point.x - candidate.cx) <= candidate.w / 2
    && Math.abs(point.y - candidate.cy) <= candidate.h / 2;
}

export function pointInPolygon(point, points = []) {
  let inside = false;
  for (let index = 0, last = points.length - 1; index < points.length; last = index++) {
    const a = points[index];
    const b = points[last];
    const crosses = ((a.y > point.y) !== (b.y > point.y))
      && (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

export function distanceToCandidate(token, candidate) {
  return Math.hypot((token?.x || 0) - candidate.cx, (token?.y || 0) - candidate.cy);
}

export function associateGeometry(token, candidates = []) {
  let best = null;
  let bestScore = -Infinity;
  for (const candidate of candidates || []) {
    const dist = distanceToCandidate(token, candidate);
    if (dist > TAG_ASSOCIATE_RADIUS) continue;
    const inside = containsPoint(candidate, token);
    if (inside && Math.max(candidate.w, candidate.h) > 2.4) continue;
    const score = (inside ? 1.4 : 0) + (3.2 - dist) + (candidate.kind === "circle" ? 0.15 : 0);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function scaleOutline(outline, factor, origin) {
  const scale = Number(factor) || 1;
  if (!outline || scale === 1) return outline;
  const ox = origin?.x ?? 0;
  const oy = origin?.y ?? 0;
  const points = (outline.points || []).map((point) => ({
    x: ox + (point.x - ox) * scale,
    y: oy + (point.y - oy) * scale,
  }));
  return {
    ...outline,
    r: outline.r != null ? outline.r * scale : outline.r,
    w: outline.w != null ? outline.w * scale : outline.w,
    h: outline.h != null ? outline.h * scale : outline.h,
    points,
  };
}

export function pointHitsOutline(outline, origin, point, pad = 0.55) {
  if (!outline || !point) return false;
  if (outline.kind === "circle") {
    return Math.hypot(point.x - origin.x, point.y - origin.y) <= Math.max(outline.r || 0, pad);
  }
  if (outline.kind === "path" && outline.points?.length >= 3) {
    if (pointInPolygon(point, outline.points)) return true;
    return outline.points.some((item) => Math.hypot(item.x - point.x, item.y - point.y) <= pad);
  }
  const w = Math.max((outline.w || 0) / 2, pad);
  const h = Math.max((outline.h || 0) / 2, pad);
  return Math.abs(point.x - origin.x) <= w && Math.abs(point.y - origin.y) <= h;
}
