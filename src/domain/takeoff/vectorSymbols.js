export const DRAW_MOVE = 0;
export const DRAW_LINE = 1;
export const DRAW_CUBIC = 2;
export const DRAW_QUAD = 3;
export const DRAW_CLOSE = 4;

export const SYMBOL_MIN = 0.12;
export const SYMBOL_MAX = 5.8;
export const TAG_ASSOCIATE_RADIUS = 2.15;
export const OVERLAP_IOU = 0.55;

const IDENTITY = [1, 0, 0, 1, 0, 0];

/**
 * @param {any} a
 * @param {any} b
 */
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

/**
 * @param {any} ctm
 * @param {any} x
 * @param {any} y
 */
export function applyCtm(ctm = IDENTITY, x = 0, y = 0) {
  return {
    x: ctm[0] * x + ctm[2] * y + ctm[4],
    y: ctm[1] * x + ctm[3] * y + ctm[5],
  };
}

// A PDF minMax rectangle must transform all four corners: transforming only
// opposite corners collapses or shifts bounds under rotated/sheared CTMs.
/**
 * @param {any} minMax
 * @param {any} ctm
 * @param {any} toPagePct
 */
export function transformedMinMaxBounds(minMax, ctm, toPagePct) {
  if (!Array.isArray(minMax) || minMax.length < 4) return null;
  const [x0, y0, x1, y1] = minMax.map(Number);
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
  const points = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]].map(([x, y]) => {
    const pdf = applyCtm(ctm, x, y);
    return toPagePct(pdf.x, pdf.y);
  });
  return boundsOfPoints(points);
}

/**
 * @param {any} points
 */
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

/**
 * @param {any} minX
 * @param {any} minY
 * @param {any} maxX
 * @param {any} maxY
 */
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

/**
 * @param {any} data
 */
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

// Sample Bezier segments for geometric bounds. PDF drawing operators store curve
// control points separately from endpoints; endpoint-only bounds miss curved ink.
/**
 * @param {any} data
 */
export function drawOpsExtentPoints(data) {
  const list = data ? Array.from(data) : [];
  const points = [];
  let current = null;
  for (let i = 0; i < list.length;) {
    const op = list[i++];
    if (op === DRAW_MOVE || op === DRAW_LINE) {
      if (i + 1 >= list.length) break;
      current = { x: Number(list[i++]), y: Number(list[i++]) };
      points.push(current);
    } else if (op === DRAW_CUBIC || op === DRAW_QUAD) {
      const n = op === DRAW_CUBIC ? 6 : 4;
      if (i + n - 1 >= list.length) break;
      const values = list.slice(i, i + n).map(Number);
      i += n;
      const end = { x: values[n - 2], y: values[n - 1] };
      if (current) {
        for (let step = 1; step <= 16; step++) {
          const t = step / 16;
          const u = 1 - t;
          const x = op === DRAW_CUBIC
            ? u ** 3 * current.x + 3 * u ** 2 * t * values[0] + 3 * u * t ** 2 * values[2] + t ** 3 * end.x
            : u ** 2 * current.x + 2 * u * t * values[0] + t ** 2 * end.x;
          const y = op === DRAW_CUBIC
            ? u ** 3 * current.y + 3 * u ** 2 * t * values[1] + 3 * u * t ** 2 * values[3] + t ** 3 * end.y
            : u ** 2 * current.y + 2 * u * t * values[1] + t ** 2 * end.y;
          points.push({ x, y });
        }
      } else points.push(end);
      current = end;
    } else if (op !== DRAW_CLOSE) break;
  }
  return points;
}

/**
 * @param {any} bounds
 */
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

/**
 * @param {any} points
 */
export function polygonArea(points = []) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0, last = points.length - 1; index < points.length; last = index++) {
    sum += points[last].x * points[index].y - points[index].x * points[last].y;
  }
  return Math.abs(sum) / 2;
}

/**
 * @param {any} points
 */
export function polygonPerimeter(points = []) {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    sum += Math.hypot(next.x - points[index].x, next.y - points[index].y);
  }
  return sum;
}

/**
 * @param {any} points
 * @param {any} bounds
 */
export function pathCircularity(points, bounds) {
  const area = polygonArea(points) || (bounds ? bounds.w * bounds.h * 0.785 : 0);
  const peri = polygonPerimeter(points) || (bounds ? 2 * (bounds.w + bounds.h) : 0);
  if (!area || !peri) return 0;
  return (4 * Math.PI * area) / (peri * peri);
}

/**
 * @param {any} points
 */
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

/**
 * @param {any} points
 * @param {any} bounds
 * @param {any} options
 */
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

/**
 * @param {any} box
 */
export function rectPoints(box) {
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
}

/**
 * @param {any} geometry
 */
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

function pageBoundsForPoints(pagePoints) {
  const bounds = boundsOfPoints(pagePoints);
  if (bounds) return bounds;
  if (!pagePoints || pagePoints.length < 2) return null;
  const a = pagePoints[0];
  const b = pagePoints[pagePoints.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1.6) return null;
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
    w: Math.max(Math.abs(dx), 0.2),
    h: Math.max(Math.abs(dy), 0.2),
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
  };
}

function isLineOrRoomBounds(bounds) {
  if (!bounds || isSymbolSized(bounds)) return false;
  const long = Math.max(bounds.w, bounds.h);
  const short = Math.min(bounds.w, bounds.h);
  if (long < 0.12 || long > 96) return false;
  if (bounds.w > 88 && bounds.h > 88) return false;
  const aspect = long / Math.max(short, 0.001);
  const area = bounds.w * bounds.h;
  if (long >= 4 && short >= 3 && aspect <= 3.2 && area >= 18 && area <= 4200 && long < 78 && short < 70) return true;
  return long >= 1.6 && short <= 0.55 && aspect >= 5 && long < 90;
}

/**
 * @param {any} data
 */
export function subpathsFromDrawOps(data) {
  const list = data ? Array.from(data) : [];
  const paths = [];
  let current = [];
  const flush = () => {
    if (current.length) paths.push(current);
    current = [];
  };
  for (let index = 0; index < list.length;) {
    const op = list[index++];
    if (op === DRAW_MOVE || op === DRAW_LINE) {
      if (index + 1 >= list.length) break;
      if (op === DRAW_MOVE && current.length) flush();
      current.push({ x: list[index++], y: list[index++], curve: false });
    } else if (op === DRAW_CUBIC) {
      if (index + 5 >= list.length) break;
      index += 4;
      current.push({ x: list[index++], y: list[index++], curve: true });
    } else if (op === DRAW_QUAD) {
      if (index + 3 >= list.length) break;
      index += 2;
      current.push({ x: list[index++], y: list[index++], curve: true });
    } else if (op === DRAW_CLOSE) {
      flush();
    } else {
      break;
    }
  }
  flush();
  return paths;
}

/**
 * @param {any} entries
 * @param {any} toPagePct
 */
export function sheetGeometryFromConstructedPaths(entries, toPagePct) {
  const raw = [];
  for (const entry of entries || []) {
    const ctm = entry.ctm || IDENTITY;
    const groups = subpathsFromDrawOps(entry.drawOps);
    const parsedGroups = groups.length ? groups : [[]];
    for (const group of parsedGroups) {
      const pagePoints = group.map((point) => {
        const pdf = applyCtm(ctm, point.x, point.y);
        const page = toPagePct(pdf.x, pdf.y);
        return { ...page, curve: point.curve };
      });
      let bounds = pageBoundsForPoints(pagePoints);
      if (!bounds && entry.minMax && entry.minMax.length >= 4 && parsedGroups.length === 1) {
        bounds = transformedMinMaxBounds(entry.minMax, ctm, toPagePct);
      }
      if (!isLineOrRoomBounds(bounds)) continue;
      const points = pagePoints.length ? pagePoints : rectPoints(bounds);
      const candidate = toCandidate({
        kind: "path",
        w: bounds.w,
        h: bounds.h,
        cx: bounds.cx,
        cy: bounds.cy,
        points,
      });
      if (candidate) raw.push(candidate);
    }
  }
  return raw;
}

/**
 * @param {any} entries
 * @param {any} toPagePct
 */
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
    const extentPoints = parsed.hasCurves
      ? drawOpsExtentPoints(entry.drawOps).map((point) => {
        const pdf = applyCtm(ctm, point.x, point.y);
        return toPagePct(pdf.x, pdf.y);
      })
      : pagePoints;
    let bounds = boundsOfPoints(extentPoints);
    if (!bounds && entry.minMax && entry.minMax.length >= 4) {
      bounds = transformedMinMaxBounds(entry.minMax, ctm, toPagePct);
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

/**
 * @param {any} box
 */
export function candidateFromPageBox(box) {
  if (!isSymbolSized(box)) return null;
  const geometry = classifySymbolGeometry(rectPoints(box), box);
  return toCandidate(geometry);
}

/**
 * @param {any} a
 * @param {any} b
 */
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

/**
 * @param {any} candidates
 */
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

/**
 * @param {any} candidate
 * @param {any} point
 */
export function containsPoint(candidate, point) {
  if (!candidate || !point) return false;
  if (candidate.kind === "circle") {
    return Math.hypot(point.x - candidate.cx, point.y - candidate.cy) <= (candidate.r || Math.max(candidate.w, candidate.h) / 2);
  }
  if (candidate.points?.length >= 3) return pointInPolygon(point, candidate.points);
  return Math.abs(point.x - candidate.cx) <= candidate.w / 2
    && Math.abs(point.y - candidate.cy) <= candidate.h / 2;
}

/**
 * True when the printed tag sits on or immediately beside the extracted body.
 * Uses cardinal-edge contact so side-tagged Soccer fixtures (gaps ~0.4–1.0)
 * associate, while diagonal foreign neighbors (Pottsville E210 type 3 @ ~0.47
 * outside on both axes) stay rejected.
 */
export function tagAdjacentToSymbolBody(token, candidate, pad = 0.80) {
  if (!token || !candidate) return false;
  if (containsPoint(candidate, token)) return true;
  const w = Number(candidate.w) || 0;
  const h = Number(candidate.h) || 0;
  const cx = Number(candidate.cx) || 0;
  const cy = Number(candidate.cy) || 0;
  const needX = Math.abs((Number(token.x) || 0) - cx) - w / 2;
  const needY = Math.abs((Number(token.y) || 0) - cy) - h / 2;
  // Cardinal: inside one axis, or nearly flush on at least one edge (not a
  // diagonal corner steal).
  const onEdge = needX <= 0 || needY <= 0 || Math.min(needX, needY) <= 0.22;
  const edgePad = Math.max(Number(pad) || 0, 1.05, Math.max(w, h) * 0.12);
  return onEdge && needX <= edgePad && needY <= edgePad;
}

/**
 * @param {any} point
 * @param {any} points
 */
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

/**
 * @param {any} token
 * @param {any} candidate
 */
export function distanceToCandidate(token, candidate) {
  return Math.hypot((token?.x || 0) - candidate.cx, (token?.y || 0) - candidate.cy);
}

/**
 * Pottsville E210 type-3 fixture bar: a vertical thin/mid rect (e.g. 0.201×0.548
 * at 69.825,77.442 or 0.331×0.548 beside 69.048,79.524) sits immediately beside
 * the printed type digit. Cardinal-adjacent + vertical bar geometry — not digit
 * ink, a foreign body, or a horizontal Soccer hatch scrap (0.504×0.2).
 */
export function isAdjacentThinFixtureBar(token, candidate) {
  if (!token || !candidate || candidate.kind !== "rect") return false;
  if (!tagAdjacentToSymbolBody(token, candidate)) return false;
  const w = Number(candidate.w) || 0;
  const h = Number(candidate.h) || 0;
  // Strip-light bars beside type digits are taller than wide; horizontal scraps
  // under Soccer 1E tags must not steal the troffer body via this exception.
  if (h < w) return false;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const aspect = long / (short || 1e-9);
  const area = w * h;
  return short >= 0.16 && short <= 0.36
    && long >= 0.48 && long <= 0.62
    && aspect >= 1.5 && aspect <= 3.6
    && area >= 0.09 && area <= 0.22;
}

/**
 * @param {any} candidate
 * @param {any} token
 */
export function looksLikeTextGlyph(candidate, token) {
  if (!candidate || !token) return false;
  const dist = distanceToCandidate(token, candidate);
  const w = Number(candidate.w) || 0;
  const h = Number(candidate.h) || 0;
  const size = Math.max(w, h);
  const short = Math.min(w, h);
  const aspect = size / (short || 1e-9);
  const tokenLen = String(token.text || "").trim().replace(/^['"‘’“”`]+|['"‘’“”`]+$/g, "").length || 1;
  const expected = Math.max(0.35, tokenLen * 0.42);
  if (size > 0.70) return false;
  // Vertical fixture bars beside type tags are bodies, not letter ink
  // (E210 type 3: 0.201×0.548 or mid-width 0.331×0.548 next to printed "3").
  if (isAdjacentThinFixtureBar(token, candidate)) return false;
  if (aspect >= 2.2 && short <= 0.28) return false;
  return dist < 0.7 && size <= expected + 0.4 && size < 1.35;
}

/**
 * @param {any} text
 */
export function shapeHintFromLabel(text) {
  const blob = String(text || "").toLowerCase();
  if (!blob.trim()) return null;
  if (/\d\s*[x×]\s*\d|troffer|strip light|linear fixture|lighting fixture/.test(blob) && !/downlight/.test(blob)) return "rect";
  if (/exhaust fan|vent fan/.test(blob)) return "rect";
  if (/downlight|recessed can|occup|sensor|recept|gfi|gfci|duplex|outlet|pendant|\bfan\b/.test(blob)) return "circle";
  return null;
}

/**
 * @param {any} geometry
 * @param {any} nearby
 */
export function isWallOrArchitecturalMark(geometry, nearby = []) {
  if (!geometry) return true;
  const long = Math.max(Number(geometry.w) || 0, Number(geometry.h) || 0, (Number(geometry.r) || 0) * 2);
  const short = Math.min(
    Number(geometry.w) || long,
    Number(geometry.h) || long,
    (Number(geometry.r) || 0) * 2 || long,
  );
  const aspect = long / (short || 1e-9);
  if (long > 8) return true;
  if (aspect >= 4.2 && long >= 1.15) return true;
  const walls = (nearby || []).filter((part) => {
    const partLong = Math.max(Number(part.w) || 0, Number(part.h) || 0);
    const partShort = Math.min(Number(part.w) || 0, Number(part.h) || 0);
    return partLong / (partShort || 1e-9) >= 3.6 && partLong >= 1.4;
  });
  if (walls.length >= 2 && aspect >= 2.4 && long >= 0.9) return true;
  return false;
}

/**
 * @param {any} candidate
 */
export function looksLikeRecessedCanBody(candidate) {
  if (!candidate || isJunkGeometry(candidate)) return false;
  const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const short = Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const aspect = long / (short || 1e-9);
  if (long < 0.38 || long > 0.86 || short < 0.32 || aspect > 1.4) return false;
  // Circles only — small type-code rect/composite glyphs beside a troffer must
  // not become unlabeled-lighting-can review marks that inflate deviceCount.
  return candidate.kind === "circle";
}

/**
 * Near-square CAD rect that stands in for a recessed-can circle (Soccer extracts
 * cans as rects with no circle paths). Paint promotion only — not unlabeled recovery.
 * @param {any} candidate
 */
export function looksLikeExtractedCanRect(candidate) {
  if (!candidate || isJunkGeometry(candidate)) return false;
  if (candidate.kind !== "rect") return false;
  const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const short = Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const aspect = long / (short || 1e-9);
  return long >= 0.45 && long <= 0.86 && short >= 0.42 && aspect <= 1.25;
}

/**
 * Promote a near-square extracted rect into a circle paint perimeter so can /
 * OS fills occupy the full interior of the printed round symbol.
 * @param {any} geometry
 * @param {any} hint
 */
export function circlePaintOutlineFromBody(geometry, hint = null) {
  if (!geometry) return null;
  // hint === "circle" alone must NOT force promotion — that painted universal
  // ovals over rectangular / irregular bodies. Only promote when the measured
  // geometry itself looks circular (or is already a circle).
  const wantsCircle = geometry.kind === "circle"
    || geometry.kind === "ellipse"
    || looksLikeRecessedCanBody(geometry)
    || looksLikeExtractedCanRect(geometry)
    || (hint === "circle" && (looksLikeRecessedCanBody(geometry) || looksLikeExtractedCanRect(geometry)));
  if (!wantsCircle) return null;
  const cx = Number(geometry.cx);
  const cy = Number(geometry.cy);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  // Preserve asymmetric percent extents (w ≠ h). On a non-square page a true
  // PDF circle has unequal x/y percentages; collapsing to w=h=2r made every
  // fill render as the same screen oval under preserveAspectRatio="none".
  const w = Number(geometry.w) || (Number(geometry.r) || 0) * 2;
  const h = Number(geometry.h) || (Number(geometry.r) || 0) * 2;
  if (!(w >= 0.28 && h >= 0.28)) return null;
  const r = Number(geometry.r) > 0
    ? Number(geometry.r)
    : Math.min(w, h) / 2;
  if (!(r >= 0.14 && r <= 0.65)) return null;
  const aspect = Math.max(w, h) / Math.max(0.001, Math.min(w, h));
  if (geometry.kind !== "circle" && geometry.kind !== "ellipse" && aspect > 1.45) return null;
  return {
    kind: "circle",
    source: geometry.source === "text" ? "text" : (geometry.outline?.source || geometry.source || "vector"),
    cx,
    cy,
    r,
    w,
    h,
    points: Array.isArray(geometry.points) ? geometry.points : [],
  };
}

/**
 * @param {any} candidate
 */
export function looksLikeTrofferShard(candidate) {
  if (!candidate) return false;
  const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const short = Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0);
  if (long < 0.12 || long > 0.48 || short < 0.08) return false;
  if (long / (short || 1e-9) > 3.4) return false;
  if (isWallOrArchitecturalMark(candidate)) return false;
  return candidate.kind === "rect" || candidate.kind === "path" || candidate.kind === "composite";
}

/**
 * @param {any} token
 * @param {any} candidates
 * @param {any} options
 */
export function assembleTrofferNearTag(token, candidates = [], options = {}) {
  if (!token) return null;
  const radius = Number(options.radius) > 0 ? Number(options.radius) : 1.15;
  const parts = (candidates || []).filter((candidate) => {
    if (!looksLikeTrofferShard(candidate) && !isPlausibleSymbolForHint(candidate, "rect")) return false;
    const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
    if (long > 1.15) return false;
    return distanceToCandidate(token, candidate) <= radius || containsPoint(candidate, token);
  });
  if (parts.length < 2) return null;
  const minX = Math.min(...parts.map((part) => (part.cx || 0) - (Number(part.w) || 0) / 2));
  const maxX = Math.max(...parts.map((part) => (part.cx || 0) + (Number(part.w) || 0) / 2));
  const minY = Math.min(...parts.map((part) => (part.cy || 0) - (Number(part.h) || 0) / 2));
  const maxY = Math.max(...parts.map((part) => (part.cy || 0) + (Number(part.h) || 0) / 2));
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 0.28 || h < 0.16 || Math.max(w, h) > 2.4) return null;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const inside = token.x >= minX - 0.12 && token.x <= maxX + 0.12 && token.y >= minY - 0.12 && token.y <= maxY + 0.12;
  if (!inside && Math.hypot((token.x || 0) - cx, (token.y || 0) - cy) > 1.25) return null;
  return {
    cx,
    cy,
    w,
    h,
    kind: "composite",
    source: "vector",
    parts,
    outline: {
      kind: "rect",
      source: "vector",
      w,
      h,
      points: [],
    },
  };
}

/**
 * @param {any} candidate
 * @param {any} nearby
 */
export function isJunkGeometry(candidate, nearby = []) {
  if (!candidate) return true;
  const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const short = Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0);
  if (long < 0.18 || short < 0.09) return true;
  if (long > 2.7 && short < 0.9) return true;
  if (long / (short || 1e-9) > 6 && long > 1.8) return true;
  if (isWallOrArchitecturalMark(candidate, nearby)) return true;
  return false;
}

/**
 * @param {any} candidate
 * @param {any} hint
 */
export function isPlausibleSymbolForHint(candidate, hint) {
  if (!candidate || isJunkGeometry(candidate)) return false;
  const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const short = Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const aspect = long / (short || 1e-9);
  if (hint === "circle") {
    if (candidate.kind === "circle" && long <= 1.25 && aspect <= 1.45) return true;
    // Recessed-can bodies on E210 are compact rects (~0.6x0.72), not
    // letter-sized ticks (~0.29x0.41) that flood Soccer type 4 / F.
    return long >= 0.28 && long <= 1.05 && aspect <= 1.45;
  }
  if (hint === "rect") return long >= 0.18 && long <= 2.3 && aspect <= 4.2;
  return long <= 2.3 && aspect <= 4.5;
}

/**
 * @param {any} hint
 */
export function associateRadiusForHint(hint) {
  if (hint === "circle") return 1.2;
  if (hint === "rect") return 1.5;
  return TAG_ASSOCIATE_RADIUS;
}

/**
 * @param {any} token
 * @param {any} candidate
 * @param {any} options
 */
export function fixtureAssociationScore(token, candidate, options = {}) {
  const dist = distanceToCandidate(token, candidate);
  const long = Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const short = Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0);
  const aspect = long / (short || 1e-9);
  const hint = options.shapeHint;
  const inside = containsPoint(candidate, token);
  let score = (3.4 - dist) + Math.min(long, 1.5) * 0.85;
  if (long < 0.22) score -= 1.4;
  if (long > 2.5 && aspect > 2.8) score -= 2.4;
  if (hint === "circle") {
    if (candidate.kind === "circle" || aspect <= 1.45) score += 0.75;
    if (aspect > 1.8 || long > 1.1) score -= 1.2;
    if (long >= 0.2 && long <= 0.7) score += 0.45;
  } else if (hint === "rect") {
    if (candidate.kind === "rect") score += 0.45;
    if (long >= 0.4 && long <= 1.8) score += 0.7;
    if (long < 0.28) score -= 0.9;
  }
  if (inside && long <= 2.2) score += 0.55;
  else if (!inside && dist > 0.28 && dist < 1.6) score += 0.3;
  return score;
}

/**
 * @param {any} token
 * @param {any} candidates
 * @param {any} options
 */
export function associateGeometry(token, candidates = [], options = {}) {
  let best = null;
  let bestScore = -Infinity;
  const hint = options.shapeHint;
  const radius = Number(options.radius) > 0 ? Number(options.radius) : associateRadiusForHint(hint);
  const rivals = options.rivals || [];
  for (const candidate of candidates || []) {
    if (looksLikeTextGlyph(candidate, token)) continue;
    if (!isPlausibleSymbolForHint(candidate, hint)) continue;
    const dist = distanceToCandidate(token, candidate);
    const inside = containsPoint(candidate, token);
    if (hint === "circle" && candidate.kind !== "circle" && dist > 0.55 && !inside) continue;
    // Rect lighting fixtures (troffer / type 1–3) must not steal a neighboring
    // can/OS circle just because it sits within the associate radius. That
    // yanks the fill onto the wrong body and fails tag-on-symbol marker checks
    // (Pottsville E210 type 3 @ ~0.85 from a neighbor circle).
    if (hint === "rect" && candidate.kind === "circle" && !inside) continue;
    // Same sheet: a foreign rect ~0.92 away (E210 type 3 @ 69.55,77.86) is not
    // the tagged fixture — require the tag on or adjacent to the body.
    if (hint === "rect" && !inside && !tagAdjacentToSymbolBody(token, candidate)) continue;
    // Room/corridor scraps (E210 type 3 @ 69.048 → 1.614×0.634) must not win
    // over the printed tag's own fixture bar. Keep real 2x4 bodies (short≥0.75).
    if (
      hint === "rect"
      && !inside
      && Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0) > 1.45
      && Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0) < 0.75
    ) continue;
    if (dist > radius && !(inside && Math.max(candidate.w, candidate.h) <= 2.3)) continue;
    // Adjacent thin fixture bars (E210 type 3: long 0.548 < 0.55, area 0.110
    // < 0.28) are genuine bodies; keep the floor for everything else.
    if (
      hint === "rect"
      && !inside
      && !isAdjacentThinFixtureBar(token, candidate)
      && (Math.max(candidate.w, candidate.h) < 0.55 || candidate.w * candidate.h < 0.28)
    ) continue;
    if (rivals.some((rival) => distanceToCandidate(rival, candidate) + 0.12 < dist)) continue;
    if (inside && Math.max(candidate.w, candidate.h) > 2.4) continue;
    const score = fixtureAssociationScore(token, candidate, { shapeHint: hint });
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= 1.35 ? best : null;
}

/**
 * @param {any} token
 * @param {any} candidates
 * @param {any} options
 */
export function placeOnSymbolGeometry(token, candidates = [], options = {}) {
  const hint = options.shapeHint;
  const radius = Number(options.radius) > 0 ? Number(options.radius) : associateRadiusForHint(hint);
  // Match the verified source path: associate a single body first. Do not run
  // assembleTrofferNearTag here — it merges E210 type-3 bars / neighbor cans into
  // a foreign composite. Troffer shard assembly stays available to callers that
  // need it explicitly after association fails.
  const near = associateGeometry(token, candidates, { ...options, radius });
  if (near) return near;
  if (hint === "circle") return null;
  const farRadius = Number(options.farRadius) > 0
    ? Number(options.farRadius)
    : (hint === "rect" ? 1.45 : 2.85);
  if (farRadius <= radius) return null;
  const far = associateGeometry(token, candidates, { ...options, radius: farRadius });
  if (!far) return null;
  const long = Math.max(Number(far.w) || 0, Number(far.h) || 0);
  if (hint === "rect" && (long < 0.45 || long > 1.8)) return null;
  return far;
}

/**
 * @param {any} token
 * @param {any} options
 */
export function tagOnSymbolGeometry(token, options = {}) {
  if (!token) return null;
  const x = Number(token.x);
  const y = Number(token.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const hint = options.shapeHint;
  const kind = hint === "rect" ? "rect" : "circle";
  const r = 0.26;
  const w = kind === "rect" ? 0.68 : r * 2;
  const h = kind === "rect" ? 0.38 : r * 2;
  return {
    cx: x,
    cy: y,
    kind,
    w,
    h,
    r: kind === "circle" ? r : undefined,
    source: "text",
    outline: {
      kind,
      source: "text",
      w,
      h,
      r: kind === "circle" ? r : undefined,
      points: [],
    },
  };
}

/**
 * @param {any} tokens
 * @param {any} candidates
 * @param {any} options
 */
export function assignExclusiveGeometry(tokens = [], candidates = [], options = {}) {
  const pairs = [];
  for (const token of tokens || []) {
    const hint = options.shapeHintFor?.(token);
    const maxDist = associateRadiusForHint(hint);
    for (const candidate of candidates || []) {
      if (looksLikeTextGlyph(candidate, token)) continue;
      if (!isPlausibleSymbolForHint(candidate, hint)) continue;
      const dist = distanceToCandidate(token, candidate);
      const inside = containsPoint(candidate, token);
      if (hint === "circle" && candidate.kind !== "circle" && dist > 0.55 && !inside) continue;
      if (hint === "rect" && candidate.kind === "circle" && !inside) continue;
      if (hint === "rect" && !inside && !tagAdjacentToSymbolBody(token, candidate)) continue;
      if (
        hint === "rect"
        && !inside
        && Math.max(Number(candidate.w) || 0, Number(candidate.h) || 0) > 1.45
        && Math.min(Number(candidate.w) || 0, Number(candidate.h) || 0) < 0.75
      ) continue;
      if (dist > maxDist && !(inside && Math.max(candidate.w, candidate.h) <= 2.3)) continue;
      if (
        hint === "rect"
        && !inside
        && !isAdjacentThinFixtureBar(token, candidate)
        && (Math.max(candidate.w, candidate.h) < 0.55 || candidate.w * candidate.h < 0.28)
      ) continue;
      const score = fixtureAssociationScore(token, candidate, { shapeHint: hint });
      if (score < 1.35) continue;
      pairs.push({ token, candidate, dist, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.dist - b.dist);
  const usedTokens = new Set();
  const usedCandidates = new Set();
  const assigned = new Map();
  for (const pair of pairs) {
    if (usedTokens.has(pair.token) || usedCandidates.has(pair.candidate)) continue;
    usedTokens.add(pair.token);
    usedCandidates.add(pair.candidate);
    assigned.set(pair.token, pair.candidate);
  }
  return assigned;
}

/**
 * @param {any} outline
 * @param {any} factor
 * @param {any} origin
 */
export function scaleOutline(outline, factor, origin) {
  const scale = Number(factor) || 1;
  if (!outline || scale === 1) return outline;
  const ox = origin?.x ?? 0;
  const oy = origin?.y ?? 0;
  if (outline.kind === "composite" && outline.parts?.length) {
    return {
      ...outline,
      w: outline.w != null ? outline.w * scale : outline.w,
      h: outline.h != null ? outline.h * scale : outline.h,
      parts: outline.parts.map((part) => ({
        ...part,
        cx: ox + ((part.cx ?? ox) - ox) * scale,
        cy: oy + ((part.cy ?? oy) - oy) * scale,
        r: part.r != null ? part.r * scale : part.r,
        w: part.w != null ? part.w * scale : part.w,
        h: part.h != null ? part.h * scale : part.h,
        points: (part.points || []).map((point) => ({ x: ox + (point.x - ox) * scale, y: oy + (point.y - oy) * scale })),
      })),
    };
  }

  const points = (outline.points || []).map((point) => ({
    x: ox + (point.x - ox) * scale,
    y: oy + (point.y - oy) * scale,
  }));
  const cx = outline.cx != null && Number.isFinite(Number(outline.cx))
    ? ox + (Number(outline.cx) - ox) * scale
    : outline.cx;
  const cy = outline.cy != null && Number.isFinite(Number(outline.cy))
    ? oy + (Number(outline.cy) - oy) * scale
    : outline.cy;
  return {
    ...outline,
    cx,
    cy,
    r: outline.r != null ? outline.r * scale : outline.r,
    w: outline.w != null ? outline.w * scale : outline.w,
    h: outline.h != null ? outline.h * scale : outline.h,
    points,
  };
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function outlineCenter(outline, origin) {
  const x = Number(outline?.cx);
  const y = Number(outline?.cy);
  return {
    x: Number.isFinite(x) ? x : Number(origin?.x) || 0,
    y: Number.isFinite(y) ? y : Number(origin?.y) || 0,
  };
}

/**
 * @param {any} outline
 * @param {any} origin
 * @param {any} point
 * @param {any} pad
 */
export function pointHitsOutline(outline, origin, point, pad = 0.55) {
  if (!outline || !point) return false;
  const center = outlineCenter(outline, origin);
  const grab = Math.max(0, Number(pad) || 0);
  // Expand only by a stroke, so a click on the ink hits and a click beside it does not.
  const slop = Math.min(grab, 0.3);
  if (outline.kind === "circle") {
    return Math.hypot(point.x - center.x, point.y - center.y) <= Math.max((outline.r || 0) + slop, grab);
  }
  if (outline.kind === "path" && outline.points?.length >= 2) {
    if (outline.points.length >= 3 && pointInPolygon(point, outline.points)) return true;
    if (!slop) return false;
    for (let index = 1; index < outline.points.length; index += 1) {
      if (distanceToSegment(point, outline.points[index - 1], outline.points[index]) <= slop) return true;
    }
    if (outline.points.length >= 3 && distanceToSegment(point, outline.points[outline.points.length - 1], outline.points[0]) <= slop) return true;
    return false;
  }
  if (outline.kind === "composite" && outline.parts?.length) {
    return outline.parts.some((part) => pointHitsOutline(part, center, point, pad));
  }
  const halfW = (Number(outline.w) || 0) / 2;
  const halfH = (Number(outline.h) || 0) / 2;
  const w = Math.max(halfW + slop, grab);
  const h = Math.max(halfH + slop, grab);
  return Math.abs(point.x - center.x) <= w && Math.abs(point.y - center.y) <= h;
}
