/**
 * Adds loose object JSDoc @param tags to exported functions that use
 * destructured `= {}` parameters without existing JSDoc blocks.
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const roots = [
  path.join(repoRoot, "src/domain"),
  path.join(repoRoot, "src/lib"),
  path.join(repoRoot, "src/api"),
  path.join(repoRoot, "src/components"),
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "ui") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function hasJsdocBefore(content, exportIndex) {
  const before = content.slice(Math.max(0, exportIndex - 400), exportIndex);
  return /\/\*\*[\s\S]*?\*\/\s*$/.test(before);
}

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;
  const exportFn = /export function (\w+)\s*\(([^)]*)\)/g;
  let match;
  const inserts = [];

  while ((match = exportFn.exec(content)) !== null) {
    const [full, name, params] = match;
    const idx = match.index;
    if (hasJsdocBefore(content, idx)) continue;

    const trimmed = params.trim();
    if (!trimmed) {
      inserts.push({ idx, block: `/** @param {...any} args */\n` });
      continue;
    }

    if (trimmed.startsWith("{")) {
      const paramName = trimmed.match(/^\{\s*([^}=,\s]+)/)?.[1] || "options";
      inserts.push({
        idx,
        block: `/**\n * @param {Record<string, any>} [${paramName}]\n */\n`,
      });
      continue;
    }

    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    const lines = parts.map((part, i) => {
      const pname = part.split("=")[0].trim().replace(/^\.\.\./, "");
      return ` * @param {any} ${pname || `arg${i}`}`;
    });
    inserts.push({
      idx,
      block: `/**\n${lines.join("\n")}\n */\n`,
    });
  }

  inserts.sort((a, b) => b.idx - a.idx);
  for (const { idx, block } of inserts) {
    content = content.slice(0, idx) + block + content.slice(idx);
    changed = true;
  }

  if (changed) fs.writeFileSync(filePath, content);
  return changed;
}

let count = 0;
for (const file of walk(path.join(repoRoot, "src/domain"))) {
  if (patchFile(file)) count += 1;
}
for (const file of walk(path.join(repoRoot, "src/lib"))) {
  if (patchFile(file)) count += 1;
}
for (const file of walk(path.join(repoRoot, "src/api"))) {
  if (patchFile(file)) count += 1;
}
for (const file of walk(path.join(repoRoot, "src/components"))) {
  if (file.includes(`${path.sep}ui${path.sep}`)) continue;
  if (patchFile(file)) count += 1;
}

console.log(`Patched JSDoc in ${count} files`);
