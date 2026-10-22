import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".test.js")) files.push(path);
  }
  return files;
}

function runNode(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { stdio: "inherit" });
    child.on("close", (code) => resolve(code || 0));
  });
}

const all = (await walk("src")).sort();
const nodeTests = [];
for (const file of all) {
  const source = await readFile(file, "utf8");
  if (!/from\s+["']vitest["']/.test(source)) nodeTests.push(file);
}

let failed = 0;
for (const file of nodeTests) {
  console.log(`\n## node ${file}`);
  const code = await runNode(file);
  console.log(`## exit ${code}`);
  if (code !== 0) failed += 1;
}

console.log(`\n# node tests total=${nodeTests.length} failed=${failed}`);
process.exit(failed ? 1 : 0);
