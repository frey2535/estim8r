import {
  applyCtm,
  boxFromExtents,
  candidateFromPageBox,
  candidatesFromConstructedPaths,
  multiplyCtm,
} from "./vectorSymbols.js";

const OPS = {
  save: 10,
  restore: 11,
  transform: 12,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  constructPath: 91,
};

const IDENTITY = [1, 0, 0, 1, 0, 0];

function asMatrix(value) {
  if (!value || value.length < 6) return null;
  return [Number(value[0]), Number(value[1]), Number(value[2]), Number(value[3]), Number(value[4]), Number(value[5])];
}

function drawOpsFromConstructArgs(args = []) {
  const payload = args[1];
  if (Array.isArray(payload) && payload[0] != null && typeof payload[0] !== "object") {
    return payload;
  }
  const inner = Array.isArray(payload) ? payload[0] : payload;
  if (!inner) return [];
  if (ArrayBuffer.isView(inner) || Array.isArray(inner)) return inner;
  return [];
}

export function symbolPathsFromOperatorList(opList, toPagePct) {
  const fnArray = opList?.fnArray || [];
  const argsArray = opList?.argsArray || [];
  const ctmStack = [];
  const formStack = [];
  let ctm = IDENTITY;
  const entries = [];
  const formBoxes = [];

  const pushCtm = (next) => {
    ctmStack.push(ctm);
    ctm = next;
  };

  for (let index = 0; index < fnArray.length; index += 1) {
    const fn = fnArray[index];
    const args = argsArray[index] || [];
    if (fn === OPS.save) {
      ctmStack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = ctmStack.pop() || IDENTITY;
    } else if (fn === OPS.transform) {
      const matrix = asMatrix(args);
      if (matrix) ctm = multiplyCtm(ctm, matrix);
    } else if (fn === OPS.paintFormXObjectBegin) {
      const matrix = asMatrix(args[0]);
      pushCtm(matrix ? multiplyCtm(ctm, matrix) : ctm);
      const bbox = args[1];
      let box = null;
      if (bbox && bbox.length >= 4) {
        const a = applyCtm(ctm, bbox[0], bbox[1]);
        const b = applyCtm(ctm, bbox[2], bbox[3]);
        const pa = toPagePct(a.x, a.y);
        const pb = toPagePct(b.x, b.y);
        box = boxFromExtents(
          Math.min(pa.x, pb.x),
          Math.min(pa.y, pb.y),
          Math.max(pa.x, pb.x),
          Math.max(pa.y, pb.y),
        );
      }
      formStack.push({ box, pathCount: 0 });
    } else if (fn === OPS.paintFormXObjectEnd) {
      const form = formStack.pop();
      ctm = ctmStack.pop() || IDENTITY;
      if (form && form.pathCount === 0 && form.box) formBoxes.push(form.box);
    } else if (fn === OPS.constructPath) {
      if (formStack.length) formStack[formStack.length - 1].pathCount += 1;
      entries.push({
        ctm: ctm.slice(),
        drawOps: drawOpsFromConstructArgs(args),
        minMax: args[2] || null,
        paintOp: args[0],
      });
    }
  }

  const fromPaths = candidatesFromConstructedPaths(entries, toPagePct);
  const fromForms = formBoxes.map(candidateFromPageBox).filter(Boolean);
  return [...fromPaths, ...fromForms];
}

export async function extractPageSymbolPaths(page) {
  const viewport = page.getViewport({ scale: 1 });
  const opList = await page.getOperatorList();
  const toPagePct = (x, y) => {
    const [vx, vy] = viewport.convertToViewportPoint(x, y);
    return {
      x: viewport.width ? (vx / viewport.width) * 100 : 0,
      y: viewport.height ? (vy / viewport.height) * 100 : 0,
    };
  };
  return symbolPathsFromOperatorList(opList, toPagePct);
}
