export const DEFAULT_MARKER_SIZE = 0.55;
export const DEFAULT_LINE_SIZE = 1.35;
export const LEGACY_DEFAULT_MARKER_SIZE = 1.6;
export const LEGACY_DEFAULT_LINE_SIZE = 2;

export function clampMarkSize(value, fallback) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return fallback;
  return size;
}

export function resolvedMarkerSize(mark, globalMarkerSize = DEFAULT_MARKER_SIZE) {
  const globalSize = clampMarkSize(globalMarkerSize, DEFAULT_MARKER_SIZE);
  if (mark?.markerSizeOverride) return clampMarkSize(mark.markerSize, globalSize);
  return globalSize;
}

export function resolvedLineSize(mark, globalLineSize = DEFAULT_LINE_SIZE) {
  const globalSize = clampMarkSize(globalLineSize, DEFAULT_LINE_SIZE);
  if (mark?.lineSizeOverride || mark?.thicknessOverride) {
    return clampMarkSize(mark.lineSize ?? mark.thickness, globalSize);
  }
  return globalSize;
}

export function isLineMark(mark) {
  return Boolean(mark?.points?.length) || mark?.tool === "conduit" || mark?.type === "route";
}

export function isMarkerMark(mark) {
  return mark?.type === "count" || mark?.type === "drop";
}

export function markerSizePatch(size) {
  return { markerSize: clampMarkSize(size, DEFAULT_MARKER_SIZE), markerSizeOverride: true };
}

export function lineSizePatch(size) {
  const next = clampMarkSize(size, DEFAULT_LINE_SIZE);
  return { thickness: next, lineSize: next, lineSizeOverride: true, thicknessOverride: true };
}

export function normalizeSavedMarkerSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_MARKER_SIZE;
  if (size >= LEGACY_DEFAULT_MARKER_SIZE - 0.05) return DEFAULT_MARKER_SIZE;
  return size;
}

export function normalizeSavedLineSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_LINE_SIZE;
  if (size >= LEGACY_DEFAULT_LINE_SIZE - 0.05) return DEFAULT_LINE_SIZE;
  return size;
}
