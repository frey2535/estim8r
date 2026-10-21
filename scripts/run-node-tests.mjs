#!/usr/bin/env node
/**
 * Runs standalone Node assertion tests (assert + process.exitCode).
 * Vitest suites are excluded — use `npm run test:vitest`.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith(".test.js")) out.push(full);
  }
  return out;
}

function isVitestSuite(file) {
  const text = readFileSync(file, "utf8");
  return /from\s+["']vitest["']/.test(text)
    || /\bdescribe\s*\(/.test(text)
    || /(^|\n)\s*(?:it|test)\s*\(/.test(text);
}

const files = walk(srcRoot)
  .filter((file) => !isVitestSuite(file))
  .sort();

if (!files.length) {
  console.error("No standalone Node test files found under src/");
  process.exit(1);
}

console.log(`Running ${files.length} standalone Node test file(s)…`);
let failed = 0;
for (const file of files) {
  const rel = relative(root, file);
  const result = spawnSync(process.execPath, [file], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  const out = `${result.stdout || ""}${result.stderr || ""}`.trimEnd();
  if (out) console.log(out);
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAIL ${rel} (exit ${result.status ?? "null"})`);
  }
}

if (failed) {
  console.error(`\n${failed}/${files.length} standalone Node test file(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${files.length} standalone Node test file(s) passed`);
