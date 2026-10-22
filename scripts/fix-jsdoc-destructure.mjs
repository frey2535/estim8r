/**
 * Repairs JSDoc broken by add-export-jsdoc.mjs:
 * - Removes @param {...any} args on zero-arg exports
 * - Replaces optional [Record<string, any>] on destructured params (TS2463)
 * - Regenerates @param lines for export functions from their signatures
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

function paramJsdoc(param, index) {
  const trimmed = param.trim();
  if (!trimmed) return ` * @param {any} arg${index}`;
  if (trimmed.startsWith("{")) {
    const inner = trimmed.replace(/=\s*\{\}\s*$/, "").replace(/^\{\s*/, "").replace(/\s*\}$/, "").trim();
    const name = inner.split(/[,=]/)[0]?.trim().replace(/^\.\.\./, "") || "options";
    return ` * @param {Record<string, any>} ${name}`;
  }
  const name = trimmed.split("=")[0].trim().replace(/^\.\.\./, "");
  return ` * @param {any} ${name || `arg${index}`}`;
}

function blockForExport(exportIndex, content) {
  const slice = content.slice(exportIndex);
  const fnMatch = slice.match(/^export function \w+\s*\(([^)]*)\)/);
  if (!fnMatch) return null;
  const params = fnMatch[1];
  if (!params.trim()) return null;
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of params) {
    if (ch === "{" || ch === "(" || ch === "[") depth += 1;
    if (ch === "}" || ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  const lines = parts.map((part, i) => paramJsdoc(part, i));
  return `/**\n${lines.join("\n")}\n */\n`;
}

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  content = content.replace(/\n\/\*\* @param \{\.\.\.any\} args \*\/\n(?=export function \w+\s*\(\s*\))/g, () => {
    changed = true;
    return "\n";
  });

  content = content.replace(
    /@param \{Record<string, any>\} \[(\w+)\]/g,
    (_, name) => {
      changed = true;
      return `@param {Record<string, any>} ${name}`;
    },
  );

  const exportRe = /\/\*\*[\s\S]*?\*\/\s*\nexport function /g;
  let match;
  const replacements = [];
  while ((match = exportRe.exec(content)) !== null) {
    const blockStart = match.index;
    const exportStart = match.index + match[0].length - "export function ".length;
    const block = content.slice(blockStart, exportStart).trim();
    const needsFix =
      block.includes("@param {...any} args")
      || block.includes("@param {any} {")
      || /\@param \{any\} \{/.test(block)
      || block.includes("pan: { x: 0");
    if (!needsFix) continue;
    const newBlock = blockForExport(exportStart, content);
    if (!newBlock) {
      replacements.push({ start: blockStart, end: exportStart, text: "" });
    } else {
      replacements.push({ start: blockStart, end: exportStart, text: newBlock });
    }
  }

  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, text } of replacements) {
    content = content.slice(0, start) + text + content.slice(end);
    changed = true;
  }

  const missingRe = /(?<!(\/\*[\s\S]*?))\nexport function (\w+)\s*\(([^)]*)\)/g;
  const inserts = [];
  while ((match = missingRe.exec(content)) !== null) {
    const idx = match.index + 1;
    const params = match[3];
    if (!params.trim()) continue;
    const before = content.slice(Math.max(0, idx - 300), idx);
    if (/\/\*\*[\s\S]*?\*\/\s*$/.test(before)) continue;
    if (!params.includes("{") || !params.includes("=")) continue;
    const newBlock = blockForExport(idx + "export function ".length - 1, content.slice(idx - 1));
    if (newBlock) inserts.push({ idx, block: newBlock });
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
for (const root of roots) {
  for (const file of walk(root)) {
    if (patchFile(file)) count += 1;
  }
}
console.log(`Fixed JSDoc in ${count} files`);
