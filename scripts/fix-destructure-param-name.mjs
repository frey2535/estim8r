/**
 * Destructured export params need @param {Record<string, any>} options
 * (synthetic name), not the first property name.
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

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;
  const re = /\/\*\*[\s\S]*?\*\/\s*\nexport function \w+\s*\(\s*\{/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const blockStart = match.index;
    const blockEnd = match.index + match[0].indexOf("*/") + 2;
    const block = content.slice(blockStart, blockEnd);
    const fixed = block.replace(
      /@param \{Record<string, any>\} [^\n*]+/g,
      (line) => {
        if (line.includes("options")) return line;
        changed = true;
        return " * @param {Record<string, any>} options";
      },
    );
    if (fixed !== block) {
      content = content.slice(0, blockStart) + fixed + content.slice(blockEnd);
      re.lastIndex = blockStart + fixed.length;
    }
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
console.log(`Normalized destructured @param names in ${count} files`);
