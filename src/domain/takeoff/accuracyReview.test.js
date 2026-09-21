import {
  cropToViewportPixels,
  cropWindowForMark,
  devicesForAccuracyReview,
  neighborReviewId,
  needsAccuracyReview,
  reviewStatusForMark,
  reviewSummary,
} from "./accuracyReview.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const vectorMark = {
  id: "v1",
  type: "count",
  sheet: 1,
  x: 22,
  y: 36,
  outlineSource: "vector",
  outline: { source: "vector", kind: "rect", w: 2.1, h: 1.05 },
  detectSource: "original-pdf",
};
const textMark = {
  id: "t1",
  type: "count",
  sheet: 1,
  x: 40,
  y: 50,
  outlineSource: "text",
  reviewStatus: "pending",
};
const otherSheet = { id: "v2", type: "count", sheet: 2, x: 10, y: 10, outlineSource: "vector" };
const conduit = { id: "c1", type: "route", tool: "conduit", sheet: 1, points: [] };

const crop = cropWindowForMark(vectorMark);
assert(crop.w >= 2.1 && crop.h >= 1.05, "crop includes the extracted outline");
assert(crop.x < 22 && crop.x + crop.w > 22, "crop is centered on the device");
assert(crop.x >= 0 && crop.x + crop.w <= 100, "crop stays on the sheet");

const edge = cropWindowForMark({ x: 1, y: 1, outline: { w: 2, h: 2 } });
assert(edge.x >= 0 && edge.y >= 0, "a device on the title-block edge still crops on-sheet");

const pixels = cropToViewportPixels({ x: 10, y: 20, w: 10, h: 5 }, { width: 2000, height: 1000 });
assert(pixels.sx === 200 && pixels.sy === 200 && pixels.sw === 200 && pixels.sh === 50, "crop maps to clean PDF pixels");

const sheet = devicesForAccuracyReview([vectorMark, textMark, otherSheet, conduit], 1);
assert(sheet.length === 2, "review list is devices on this sheet only");
assert(!sheet.some((mark) => mark.tool === "conduit"), "circuits are not accuracy-review devices");
assert(needsAccuracyReview(textMark), "text-only detections stay in the review queue");
assert(reviewStatusForMark({ ...vectorMark, reviewStatus: "accepted" }) === "accepted", "accepted stays accepted");
assert(neighborReviewId([vectorMark, textMark], "v1", 1, 1) === "t1", "next steps to the following device");
assert(neighborReviewId([vectorMark, textMark], "t1", 1, 1) === "v1", "next wraps");

const summary = reviewSummary([vectorMark, textMark, { ...textMark, id: "t2", reviewStatus: "rejected" }], 1);
assert(summary.total === 3 && summary.pending === 2 && summary.rejected === 1, "review totals stay visible");
assert(summary.vector === 1 && summary.text === 2, "vector vs text counts are not hidden");

if (!process.exitCode) console.log("accuracy review checks passed");
