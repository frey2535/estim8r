import {
  DEFAULT_LINE_SIZE,
  DEFAULT_MARKER_SIZE,
  isLineMark,
  isMarkerMark,
  lineSizePatch,
  markerSizePatch,
  normalizeSavedLineSize,
  normalizeSavedMarkerSize,
  resolvedLineSize,
  resolvedMarkerSize,
} from "./sizes.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(resolvedMarkerSize({}, 2.4) === 2.4, "markers follow the global size");
assert(resolvedMarkerSize({ markerSize: 4 }, 2.4) === 2.4, "stamped size is not an override");
assert(resolvedMarkerSize({ markerSize: 4, markerSizeOverride: true }, 2.4) === 4, "marker override wins");
assert(resolvedMarkerSize({ markerSizeOverride: true }, 2.4) === 2.4, "invalid marker override falls back to global");
assert(resolvedMarkerSize({}, 0) === DEFAULT_MARKER_SIZE, "invalid global marker size uses default");
assert(DEFAULT_MARKER_SIZE <= 0.7, "default markers are small enough to read the plan");
assert(normalizeSavedMarkerSize(1.6) === DEFAULT_MARKER_SIZE, "saved 1.6 migrates to the new default");
assert(normalizeSavedLineSize(2) === DEFAULT_LINE_SIZE, "saved default line size migrates");
assert(DEFAULT_MARKER_SIZE <= 0.7, "default markers are small enough to read the plan");
assert(normalizeSavedMarkerSize(1.6) === DEFAULT_MARKER_SIZE, "saved 1.6 markers migrate to the new default");
assert(normalizeSavedLineSize(2) === DEFAULT_LINE_SIZE, "saved default line size migrates");

assert(resolvedLineSize({}, 3) === 3, "lines follow the global size");
assert(resolvedLineSize({ thickness: 5 }, 3) === 3, "stamped thickness is not an override");
assert(resolvedLineSize({ thickness: 5, thicknessOverride: true }, 3) === 5, "line override wins");
assert(resolvedLineSize({ lineSize: 6, lineSizeOverride: true }, 3) === 6, "lineSize override wins");
assert(resolvedLineSize({}, -1) === DEFAULT_LINE_SIZE, "invalid global line size uses default");

assert(isMarkerMark({ type: "count" }) && isMarkerMark({ type: "drop" }), "count and drop are markers");
assert(isLineMark({ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), "polylines are lines");
assert(isLineMark({ tool: "conduit" }), "conduit runs are lines");
assert(!isMarkerMark({ type: "note" }) && !isLineMark({ type: "note" }), "notes are not sized marks");

assert(markerSizePatch(2.2).markerSizeOverride === true, "marker patch flags an override");
assert(lineSizePatch(3.1).thickness === 3.1 && lineSizePatch(3.1).lineSizeOverride === true, "line patch stores thickness");

if (process.exitCode) {
  console.error("sizes.test.js failed");
} else {
  console.log("sizes.test.js passed");
}
