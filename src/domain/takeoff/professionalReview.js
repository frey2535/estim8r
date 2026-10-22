import { applyReviewDecision } from "./accuracyReview.js";
import { isReviewOnlyMark } from "./detectionRecord.js";
import { deviceTypeKey, isDeviceMark } from "./deviceStyles.js";
import { legendEntryForMark, legendHoverData } from "./legendHover.js";
import { revisionDelta } from "./liveLinkedTakeoff.js";
import {
  changeReviewDeviceType,
  createManualDeviceMark,
  moveReviewMark,
  rejectReviewMark,
  resizeReviewBounds,
} from "./reviewActions.js";

function compactType(value) {
  return String(value || "")
    .trim()
    .replace(/^type\s+/i, "")
    .toUpperCase()
    .replace(/[^A-Z0-9/]+/g, "");
}

/**
 * @param {any} mark
 */
export function reviewTypeKey(mark) {
  const key = compactType(mark?.typeCode || mark?.abbr || mark?.legendCode);
  if (!key || key === "UNKNOWN" || key === "?") return "";
  return key;
}

/**
 * @param {any} marks
 * @param {any} type
 * @param {any} options
 */
export function marksOfType(marks = [], type, options = {}) {
  const wanted = compactType(type);
  if (!wanted) return [];
  return (marks || []).filter((mark) => {
    if (!isDeviceMark(mark) && mark?.type !== "count" && mark?.type !== "drop") return false;
    if (options.sheet != null && mark.sheet !== options.sheet) return false;
    if (options.includeRejected === false && mark.reviewStatus === "rejected") return false;
    return reviewTypeKey(mark) === wanted || deviceTypeKey(mark) === wanted.toLowerCase();
  });
}

/**
 * @param {any} marks
 * @param {any} options
 */
export function inspectTypes(marks = [], options = {}) {
  const counts = new Map();
  for (const mark of marks || []) {
    if (!isDeviceMark(mark) && mark?.type !== "count" && mark?.type !== "drop") continue;
    if (options.sheet != null && mark.sheet !== options.sheet) continue;
    if (isReviewOnlyMark(mark) && mark.reviewStatus !== "rejected") continue;
    const key = reviewTypeKey(mark);
    if (!key) continue;
    const row = counts.get(key) || { type: key, count: 0, pending: 0, accepted: 0, rejected: 0 };
    row.count += 1;
    if (mark.reviewStatus === "accepted") row.accepted += 1;
    else if (mark.reviewStatus === "rejected") row.rejected += 1;
    else row.pending += 1;
    counts.set(key, row);
  }
  return [...counts.values()].sort((left, right) => left.type.localeCompare(right.type));
}

/**
 * @param {any} marks
 * @param {any} inspect
 */
export function filterMarksByInspect(marks = [], inspect = {}) {
  const type = compactType(inspect.type);
  const sheet = inspect.sheet;
  return (marks || []).filter((mark) => {
    if (sheet != null && mark.sheet !== sheet) return false;
    if (type && reviewTypeKey(mark) !== type && deviceTypeKey(mark) !== type.toLowerCase()) return false;
    if (inspect.hideRejected && mark.reviewStatus === "rejected") return false;
    return true;
  });
}

/**
 * @param {any} mark
 * @param {any} drawingSymbols
 * @param {any} options
 */
export function enrichMarkLegendFields(mark, drawingSymbols = [], options = {}) {
  if (!mark) return mark;
  const hover = legendHoverData(mark, drawingSymbols, options);
  const entry = hover.entry || legendEntryForMark(mark, drawingSymbols, options);
  if (!entry && !hover.code) return mark;
  return {
    ...mark,
    legendEntryId: mark.legendEntryId || entry?.id || null,
    legendCode: mark.legendCode || hover.code || entry?.abbr || mark.typeCode || "",
    legendLabel: mark.legendLabel || hover.label || entry?.label || mark.symbolLabel || "",
    legendCategory: mark.legendCategory || hover.category || entry?.takeoffCategory || entry?.category || mark.category || "",
    legendSource: mark.legendSource || hover.source || entry?.source || "",
    legendSourcePage: mark.legendSourcePage || hover.page || entry?.page || null,
  };
}

/**
 * @param {any} mark
 * @param {any} drawingSymbols
 * @param {any} options
 */
export function hoverBoundToLegend(mark, drawingSymbols = [], options = {}) {
  const enriched = enrichMarkLegendFields(mark, drawingSymbols, options);
  const hover = legendHoverData(enriched, drawingSymbols, options);
  return {
    mark: enriched,
    hover,
    bound: Boolean(hover.verified && hover.code),
    code: hover.code,
    label: hover.label,
  };
}

function markIdentity(mark) {
  return mark?.id || mark?.objectId || mark?.sourceObjectId || "";
}

/**
 * @param {any} previous
 * @param {any} current
 * @param {any} options
 */
export function revisionCompare(previous = [], current = [], options = {}) {
  const moveRadius = Number(options.moveRadius) > 0 ? Number(options.moveRadius) : 0.35;
  const moved = [];
  const reclassified = [];
  const matchedIds = new Set();
  for (const before of previous || []) {
    const identity = markIdentity(before);
    const after = identity
      ? (current || []).find((mark) => markIdentity(mark) === identity)
      : null;
    if (!after) continue;
    matchedIds.add(identity);
    const sameType = reviewTypeKey(before) === reviewTypeKey(after);
    const dist = Math.hypot((Number(after.x) || 0) - (Number(before.x) || 0), (Number(after.y) || 0) - (Number(before.y) || 0));
    if (!sameType) reclassified.push({ before, after });
    else if (dist >= moveRadius) moved.push({ before, after, dist });
  }
  const leftoverPrevious = (previous || []).filter((mark) => !matchedIds.has(markIdentity(mark)));
  const leftoverCurrent = (current || []).filter((mark) => !matchedIds.has(markIdentity(mark)));
  const delta = revisionDelta(leftoverPrevious, leftoverCurrent);
  return {
    ...delta,
    moved,
    reclassified,
    addedCount: delta.added.length,
    removedCount: delta.removed.length,
    movedCount: moved.length,
    reclassifiedCount: reclassified.length,
  };
}

/**
 * @param {any} marks
 * @param {any} command
 * @param {any} context
 */
export function applyReviewCommand(marks, command = {}, context = {}) {
  const action = String(command.action || "").toLowerCase();
  const current = command.mark || (command.id ? (marks || []).find((item) => item.id === command.id) : null);
  if (action === "accept") return applyReviewDecision(marks, current, "accepted");
  if (action === "reject") return rejectReviewMark(marks, current);
  if (action === "reclassify") {
    const next = changeReviewDeviceType(marks, current, command.symbol);
    return (next || []).map((mark) => (
      mark.id === current?.id ? enrichMarkLegendFields(mark, context.drawingSymbols || [], context) : mark
    ));
  }
  if (action === "move") return moveReviewMark(marks, current, command.point);
  if (action === "resize") return resizeReviewBounds(marks, current, command.bounds);
  if (action === "add") {
    const created = enrichMarkLegendFields(
      createManualDeviceMark({
        sheet: command.sheet ?? current?.sheet ?? 1,
        trade: command.trade || current?.trade || "electrical",
        symbol: command.symbol,
        x: command.point?.x ?? command.x,
        y: command.point?.y ?? command.y,
        w: command.bounds?.w,
        h: command.bounds?.h,
      }),
      context.drawingSymbols || [],
      context,
    );
    return [...(marks || []), created];
  }
  return marks || [];
}
