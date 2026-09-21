import { isDeviceMark } from "./deviceStyles.js";

export const DETECT_SOURCE_ORIGINAL_PDF = "original-pdf";

export function cropWindowForMark(mark, options = {}) {
  const pad = Number.isFinite(Number(options.pad)) ? Number(options.pad) : 3.5;
  const outline = mark?.outline || {};
  const bodyW = Number(outline.w) || (outline.r ? Number(outline.r) * 2 : 0);
  const bodyH = Number(outline.h) || (outline.r ? Number(outline.r) * 2 : 0);
  const w = clamp(Math.max(bodyW, 1.2) + pad * 2, 4, 28);
  const h = clamp(Math.max(bodyH, 1.2) + pad * 2, 4, 28);
  const x = Number(mark?.x) || 0;
  const y = Number(mark?.y) || 0;
  return {
    x: clamp(x - w / 2, 0, 100 - w),
    y: clamp(y - h / 2, 0, 100 - h),
    w,
    h,
  };
}

export function cropToViewportPixels(crop, viewport) {
  const width = Number(viewport?.width) || 0;
  const height = Number(viewport?.height) || 0;
  return {
    sx: (crop.x / 100) * width,
    sy: (crop.y / 100) * height,
    sw: (crop.w / 100) * width,
    sh: (crop.h / 100) * height,
  };
}

export function devicesForAccuracyReview(marks, sheet) {
  return (marks || []).filter((mark) => (
    isDeviceMark(mark)
    && (sheet == null || mark.sheet === sheet)
  ));
}

export function reviewStatusForMark(mark) {
  if (mark?.reviewStatus === "accepted" || mark?.reviewStatus === "rejected") return mark.reviewStatus;
  return "pending";
}

export function needsAccuracyReview(mark) {
  return isDeviceMark(mark) && reviewStatusForMark(mark) === "pending";
}

export function neighborReviewId(marks, currentId, direction = 1, sheet) {
  const items = devicesForAccuracyReview(marks, sheet);
  if (!items.length) return null;
  const index = items.findIndex((mark) => mark.id === currentId);
  const start = index < 0 ? 0 : index;
  const next = (start + direction + items.length) % items.length;
  return items[next].id;
}

export function reviewSummary(marks, sheet) {
  const items = devicesForAccuracyReview(marks, sheet);
  let pending = 0;
  let accepted = 0;
  let rejected = 0;
  let vector = 0;
  let text = 0;
  for (const mark of items) {
    const status = reviewStatusForMark(mark);
    if (status === "accepted") accepted += 1;
    else if (status === "rejected") rejected += 1;
    else pending += 1;
    if (mark.outlineSource === "vector") vector += 1;
    else text += 1;
  }
  return {
    total: items.length,
    pending,
    accepted,
    rejected,
    vector,
    text,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
