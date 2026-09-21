import {
  applyReviewDecision,
  cropToViewportPixels,
  cropWindowForMark,
  devicesForAccuracyReview,
  isUncertainDetection,
  neighborReviewId,
  needsAccuracyReview,
  reviewQueue,
  reviewStatusForMark,
  reviewSummary,
  typeInstanceCount,
} from "./accuracyReview.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const type1a = {
  id: "a1",
  type: "count",
  sheet: 1,
  x: 22,
  y: 36,
  typeCode: "1E",
  abbr: "1E",
  outlineSource: "vector",
  outline: { source: "vector", kind: "rect", w: 2.1, h: 1.05 },
  detectSource: "original-pdf",
};
const type1b = { ...type1a, id: "a2", x: 30, y: 40 };
const type1sheet2 = { ...type1a, id: "a3", sheet: 2, x: 18, y: 20 };
const type2 = { ...type1a, id: "b1", typeCode: "2", abbr: "2", x: 50, y: 50 };
const uncertain = {
  id: "u1",
  type: "count",
  sheet: 1,
  x: 40,
  y: 50,
  typeCode: "1E",
  abbr: "1E",
  outlineSource: "text",
  confidence: "low",
  reviewStatus: "pending",
};
const conduit = { id: "c1", type: "route", tool: "conduit", sheet: 1, points: [] };
const marks = [type1a, type1b, type1sheet2, type2, uncertain, conduit];

const crop = cropWindowForMark(type1a);
assert(crop.w >= 2.1 && crop.h >= 1.05, "crop includes the extracted outline");
assert(crop.x < 22 && crop.x + crop.w > 22, "crop is centered on the device");
assert(crop.x >= 0 && crop.x + crop.w <= 100, "crop stays on the sheet");

const pixels = cropToViewportPixels({ x: 10, y: 20, w: 10, h: 5 }, { width: 2000, height: 1000 });
assert(pixels.sx === 200 && pixels.sy === 200 && pixels.sw === 200 && pixels.sh === 50, "crop maps to clean PDF pixels");

assert(!isUncertainDetection(type1a), "a vector type match is not uncertain");
assert(isUncertainDetection(uncertain), "a text-only low-confidence count is uncertain");
assert(devicesForAccuracyReview(marks, 1).length === 4, "sheet review devices exclude other sheets and circuits");
assert(typeInstanceCount(marks, type1a) === 3, "confident 1E counts across sheets are one type");

const queue = reviewQueue(marks, 1);
assert(queue.map((mark) => mark.id).join(",") === "a1,b1,u1", `queue is one of each type plus uncertain, got ${queue.map((mark) => mark.id)}`);
assert(!queue.some((mark) => mark.id === "a2"), "a second confident 1E is not a separate review");
assert(needsAccuracyReview(type1a, marks, 1), "the type sample stays in the queue");
assert(!needsAccuracyReview(type1b, marks, 1), "other confident instances of that type are not asked again");
assert(needsAccuracyReview(uncertain, marks, 1), "uncertain detections are still asked one by one");

const accepted = applyReviewDecision(marks, type1a, "accepted");
assert(accepted.find((mark) => mark.id === "a1").reviewStatus === "accepted", "the sample is accepted");
assert(accepted.find((mark) => mark.id === "a2").reviewStatus === "accepted", "other 1E counts on this sheet inherit the type decision");
assert(accepted.find((mark) => mark.id === "a3").reviewStatus === "accepted", "the same type on another sheet inherits the type decision");
assert(accepted.find((mark) => mark.id === "b1").reviewStatus !== "accepted", "type 2 is not accepted with type 1E");
assert(accepted.find((mark) => mark.id === "u1").reviewStatus === "pending", "uncertain 1E still needs its own look");
assert(reviewQueue(accepted, 1).map((mark) => mark.id).join(",") === "b1,u1", "after a type accept, only other types and uncertain items remain");

const rejectedOne = applyReviewDecision(marks, uncertain, "rejected");
assert(rejectedOne.find((mark) => mark.id === "u1").reviewStatus === "rejected", "uncertain reject is this count only");
assert(rejectedOne.find((mark) => mark.id === "a1").reviewStatus !== "rejected", "rejecting an uncertain 1E does not reject the type");

assert(neighborReviewId(marks, "a1", 1, 1) === "b1", "next walks the type/uncertain queue, not every instance");
assert(reviewStatusForMark({ ...type1a, reviewStatus: "accepted" }) === "accepted", "accepted stays accepted");

const summary = reviewSummary(marks, 1);
assert(summary.pending === 3, "pending is types plus uncertain items, not every fixture");
assert(summary.typesPending === 2 && summary.uncertainPending === 1, "summary splits type checks from uncertain checks");

if (!process.exitCode) console.log("accuracy review checks passed");
