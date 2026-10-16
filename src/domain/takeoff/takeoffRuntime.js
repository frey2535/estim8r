import { takeoffPerformanceBudget } from "./takeoffQuality.js";

export const DEFAULT_REGION_COLS = 2;
export const DEFAULT_REGION_ROWS = 2;
export const DEFAULT_WORKER_CONCURRENCY = 2;
export const DEFAULT_CACHE_BYTES = 48 * 1024 * 1024;

export function regionalTiles(options = {}) {
  const cols = Math.max(1, Number(options.cols) || DEFAULT_REGION_COLS);
  const rows = Math.max(1, Number(options.rows) || DEFAULT_REGION_ROWS);
  const tiles = [];
  const tileW = 100 / cols;
  const tileH = 100 / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push({
        id: `r${row}c${col}`,
        col,
        row,
        x: col * tileW,
        y: row * tileH,
        w: tileW,
        h: tileH,
      });
    }
  }
  return tiles;
}

export function workerJobPlan(pages = [], options = {}) {
  const tiles = regionalTiles(options);
  const concurrency = Math.max(1, Number(options.concurrency) || DEFAULT_WORKER_CONCURRENCY);
  const jobs = [];
  for (const page of pages || []) {
    const pageNumber = page.page || page.sheet || 1;
    const pathCount = (page.paths || []).length;
    const useRegions = pathCount >= (Number(options.regionPathThreshold) || 800) || Boolean(options.forceRegions);
    const regions = useRegions ? tiles : [{ id: "full", col: 0, row: 0, x: 0, y: 0, w: 100, h: 100 }];
    for (const region of regions) {
      jobs.push({
        id: `p${pageNumber}-${region.id}`,
        page: pageNumber,
        region,
        kind: useRegions ? "region" : "page",
      });
    }
  }
  return {
    jobs,
    concurrency,
    workerCount: Math.min(concurrency, Math.max(1, jobs.length)),
    regional: jobs.some((job) => job.kind === "region"),
  };
}

export function createPageCache(options = {}) {
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_CACHE_BYTES;
  const maxEntries = Number(options.maxEntries) > 0 ? Number(options.maxEntries) : 12;
  const entries = new Map();
  let bytes = 0;

  function evict() {
    while ((bytes > maxBytes || entries.size > maxEntries) && entries.size) {
      const oldest = entries.keys().next().value;
      const item = entries.get(oldest);
      entries.delete(oldest);
      bytes -= item.bytes;
    }
  }

  return {
    get(key) {
      if (!entries.has(key)) return null;
      const item = entries.get(key);
      entries.delete(key);
      entries.set(key, item);
      return item.value;
    },
    set(key, value, size = 0) {
      const nextBytes = Math.max(0, Number(size) || 0);
      if (entries.has(key)) {
        bytes -= entries.get(key).bytes;
        entries.delete(key);
      }
      entries.set(key, { value, bytes: nextBytes });
      bytes += nextBytes;
      evict();
      return this.stats();
    },
    stats() {
      return {
        size: entries.size,
        bytes,
        maxBytes,
        maxEntries,
        withinBudget: bytes <= maxBytes && entries.size <= maxEntries,
      };
    },
  };
}

export function largeDrawingNavigable(page = {}, options = {}) {
  const budget = takeoffPerformanceBudget({
    width: Number(page.width) || 2592,
    height: Number(page.height) || 1944,
    pathCount: (page.paths || []).length || Number(page.pathCount) || 0,
    zoom: Number(options.zoom) || 1,
    memoryMb: Number(options.memoryMb) || 90,
    coarsePointer: Boolean(options.coarsePointer),
  });
  const plan = workerJobPlan([page], { forceRegions: (page.paths || []).length >= 800 || page.pathCount >= 800 });
  return {
    ok: Boolean(budget.ok && plan.jobs.length),
    budget,
    plan,
  };
}
