import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const uiDir = path.join(repoRoot, "src/components/ui");
const outDir = path.join(repoRoot, "src/types/ui");

const header = `import type * as React from "react";

/** @typedef {React.ComponentPropsWithoutRef<"div"> & { className?: string; children?: React.ReactNode } & Record<string, unknown>} UiDivProps */
type UiDivProps = React.ComponentPropsWithoutRef<"div"> & {
  className?: string;
  children?: React.ReactNode;
} & Record<string, unknown>;

type UiForward = React.ForwardRefExoticComponent<
  UiDivProps & React.RefAttributes<HTMLElement>
>;
type UiComp = React.ComponentType<UiDivProps>;
type UiFn = (...args: never[]) => unknown;

`;

function parseExports(content) {
  const names = new Set();
  const exportFn = content.match(/export function (\w+)/g);
  if (exportFn) {
    for (const m of exportFn) names.add(m.replace("export function ", ""));
  }
  const exportConst = content.match(/export const (\w+)/g);
  if (exportConst) {
    for (const m of exportConst) names.add(m.replace("export const ", ""));
  }
  const blocks = content.match(/export\s*\{[^}]+\}/gs) || [];
  for (const block of blocks) {
    const inner = block.replace(/^export\s*\{|\}$/g, "");
    for (const part of inner.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const alias = trimmed.match(/\bas\s+(\w+)\s*$/);
      if (alias) {
        names.add(alias[1]);
      } else {
        names.add(trimmed.split(/\s+/)[0]);
      }
    }
  }
  return [...names].filter(Boolean).sort();
}

function stubForExport(name) {
  if (name === "buttonVariants" || name === "badgeVariants" || name === "toggleVariants") {
    return `export declare function ${name}(props?: Record<string, unknown>): string;`;
  }
  if (name === "useToast") {
    return `export declare function useToast(): {
  toast: (props: Record<string, unknown>) => { id: string; dismiss: () => void; update: (p: Record<string, unknown>) => void };
  dismiss: (id?: string) => void;
  toasts: unknown[];
};`;
  }
  if (name === "toast") {
    return `export declare const toast: (props: Record<string, unknown>) => { id: string; dismiss: () => void; update: (p: Record<string, unknown>) => void };`;
  }
  if (name === "reducer") {
    return `export declare const reducer: UiFn;`;
  }
  if (name === "Toaster") {
    return `export declare function Toaster(): React.ReactElement | null;`;
  }
  if (name === "Calendar") {
    return `export declare const Calendar: UiComp;`;
  }
  if (name === "Input" || name === "Textarea") {
    return `export declare const ${name}: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<"${name === "Input" ? "input" : "textarea"}"> & React.RefAttributes<HTML${name === "Input" ? "Input" : "TextArea"}Element>
>;`;
  }
  if (name === "Button") {
    return `export declare const Button: React.ForwardRefExoticComponent<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    asChild?: boolean;
  } & React.RefAttributes<HTMLButtonElement>
>;`;
  }
  if (name === "Label") {
    return `export declare const Label: React.ForwardRefExoticComponent<
  React.LabelHTMLAttributes<HTMLLabelElement> & React.RefAttributes<HTMLLabelElement>
>;`;
  }
  return `export declare const ${name}: UiForward | UiComp;`;
}

fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(uiDir).filter((f) => f.endsWith(".jsx"))) {
  const base = file.replace(/\.jsx$/, "");
  const content = fs.readFileSync(path.join(uiDir, file), "utf8");
  const exports = parseExports(content);
  const body = exports.map(stubForExport).join("\n");
  const special =
    base === "button"
      ? `export declare function buttonVariants(props?: Record<string, unknown>): string;\n`
      : "";
  const deduped = new Set(exports);
  let lines = exports.map(stubForExport);
  if (base === "button" && deduped.has("buttonVariants")) {
    lines = lines.filter((l) => !l.includes("buttonVariants"));
    lines.push(`export declare function buttonVariants(props?: Record<string, unknown>): string;`);
  }
  const out = `${header}${lines.join("\n")}\n`;
  fs.writeFileSync(path.join(outDir, `${base}.d.ts`), out);
}

console.log(`Wrote ${fs.readdirSync(outDir).filter((f) => f.endsWith(".d.ts")).length} UI type stubs to ${outDir}`);
