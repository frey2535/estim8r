import { OPS } from "pdfjs-dist";
import { DRAW_CLOSE, DRAW_LINE, DRAW_MOVE } from "./vectorSymbols.js";
import { symbolPathsFromOperatorList } from "./pdfPaths.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const rect = [
  DRAW_MOVE, 100, 100,
  DRAW_LINE, 140, 100,
  DRAW_LINE, 140, 120,
  DRAW_LINE, 100, 120,
  DRAW_CLOSE,
];

const paths = symbolPathsFromOperatorList({
  fnArray: [OPS.save, OPS.transform, OPS.constructPath, OPS.restore],
  argsArray: [
    [],
    [1, 0, 0, 1, 0, 0],
    [OPS.stroke, [new Float32Array(rect)], [100, 100, 140, 120]],
    [],
  ],
}, (x, y) => ({ x: x / 10, y: y / 10 }));

assert(paths.length === 1, "operator-list rectangles become symbol candidates");
assert(paths[0].kind === "rect", `extracted kind is the drawn rectangle, got ${paths[0]?.kind}`);
assert(Math.abs(paths[0].w - 4) < 0.2, "width is the constructed path, not a generic marker");

const formOnly = symbolPathsFromOperatorList({
  fnArray: [OPS.paintFormXObjectBegin, OPS.paintFormXObjectEnd],
  argsArray: [
    [[1, 0, 0, 1, 200, 80], [0, 0, 22, 11]],
    [],
  ],
}, (x, y) => ({ x: x / 10, y: y / 10 }));
assert(formOnly.length === 1, "a symbol-sized form XObject without inner paths still uses its real bbox");
assert(formOnly[0].kind === "rect", "form bbox stays a rectangle when that is the drawn outline");

if (!process.exitCode) console.log("pdf path extraction checks passed");
