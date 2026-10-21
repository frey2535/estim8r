// Standalone: paste page 52 path lines or run with node if allowed.
import { readFileSync, writeFileSync } from "node:fs";

function normalizeTypeMark(text) {
  return String(text || "")
    .trim()
    .replace(/^['"‘’“”`]+|['"‘’“”`]+$/g, "")
    .replace(/^type\s+/i, "")
    .replace(/[.,;:()]+$/g, "")
    .replace(/^[()]+/, "");
}

const raw = readFileSync(
  new URL("../src/domain/takeoff/fixtures/pottsville-electrical.json", import.meta.url),
  "utf8",
);
const fixture = JSON.parse(raw);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

for (const pageNum of [52, 50]) {
  const page = fixture.pages.find((p) => p.page === pageNum);
  const r = pageNum === 52 ? 2.0 : 1.0;
  const tokens = (page?.tokens || []).filter((t) =>
    pageNum === 52
      ? normalizeTypeMark(t.text) === "3"
      : normalizeTypeMark(t.text).toUpperCase() === "OS",
  );
  const paths = page?.paths || [];
  const report = tokens.map((t) => ({
    text: t.text,
    x: t.x,
    y: t.y,
    nearbyPaths: paths
      .filter((p) => dist(t, p) <= r)
      .map((p) => ({ cx: p.cx, cy: p.cy, w: p.w, h: p.h, kind: p.kind, d: dist(t, p) }))
      .sort((a, b) => a.d - b.d),
  }));
  writeFileSync(
    new URL(`./page-${pageNum}-nearby.json`, import.meta.url),
    JSON.stringify({ page: pageNum, radius: r, tokens: report }, null, 2),
  );
}
