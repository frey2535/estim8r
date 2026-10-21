import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function normalizeTypeMark(text) {
  return String(text || "")
    .trim()
    .replace(/^['"‘’“”`]+|['"‘’“”`]+$/g, "")
    .replace(/^type\s+/i, "")
    .replace(/[.,;:()]+$/g, "")
    .replace(/^[()]+/, "");
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function nearbyPaths(paths, x, y, radius) {
  return (paths || [])
    .filter((p) => dist(x, y, Number(p.cx) || 0, Number(p.cy) || 0) <= radius)
    .map((p) => ({
      cx: p.cx,
      cy: p.cy,
      w: p.w,
      h: p.h,
      kind: p.kind,
      d: dist(x, y, Number(p.cx) || 0, Number(p.cy) || 0),
    }))
    .sort((a, b) => a.d - b.d);
}

const root = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(root, "../src/domain/takeoff/fixtures/pottsville-electrical.json"), "utf8"),
);

const out = {};

for (const pageNum of [52, 50]) {
  const page = (fixture.pages || []).find((p) => p.page === pageNum);
  if (!page) {
    out[pageNum] = { error: "page not found" };
    continue;
  }
  const paths = page.paths || [];
  const radius = pageNum === 52 ? 2.0 : 1.0;
  const tokens = (page.tokens || [])
    .map((t) => ({ ...t, norm: normalizeTypeMark(t.text) }))
    .filter((t) => (pageNum === 52 ? t.norm === "3" : t.norm.toUpperCase() === "OS"));

  out[pageNum] = {
    page: page.page,
    kind: page.kind,
    title: page.title,
    tokens: tokens.map((t) => ({
      text: t.text,
      norm: t.norm,
      x: t.x,
      y: t.y,
      nearbyPaths: nearbyPaths(paths, t.x, t.y, radius),
    })),
  };
}

const outPath = join(root, "../tmp/page-token-extract.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(outPath);
