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

const vitestFiles = [];
for (const file of (await walk("src")).sort()) {
  const source = await readFile(file, "utf8");
  if (/from\s+["']vitest["']/.test(source)) vitestFiles.push(file);
}

if (!vitestFiles.length) {
  console.log("No Vitest-authored test files found.");
  process.exit(0);
}

const child = spawn("vitest", ["run", ...vitestFiles], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("close", (code) => process.exit(code || 0));
