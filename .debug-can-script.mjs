import { candidatesFromConstructedPaths, DRAW_CLOSE, DRAW_CUBIC, DRAW_MOVE } from './src/domain/takeoff/vectorSymbols.js';
import { buildAiMarks } from './src/domain/takeoff/aiTakeoff.js';
import { paletteForTrade } from './src/domain/takeoff/trades.js';
import { deviceOutline, isUsablePaintOutline, maxFillExtent, outlineExtent, isPointDevice } from './src/domain/takeoff/deviceStyles.js';

const canPaths = candidatesFromConstructedPaths([{
  ctm: [1, 0, 0, 1, 0, 0],
  drawOps: [
    DRAW_MOVE, 29.4, 40.55,
    DRAW_CUBIC, 29.4, 40.85, 29.65, 41.1, 29.95, 41.1,
    DRAW_CUBIC, 30.25, 41.1, 30.5, 40.85, 30.5, 40.55,
    DRAW_CUBIC, 30.5, 40.25, 30.25, 40, 29.95, 40,
    DRAW_CUBIC, 29.65, 40, 29.4, 40.25, 29.4, 40.55,
    DRAW_CLOSE,
  ],
}], (x, y) => ({ x, y }));
console.log('canPaths', JSON.stringify(canPaths));
const electrical = paletteForTrade('electrical');
const cans = buildAiMarks({
  trade: 'electrical',
  symbols: electrical.symbols,
  drawingSymbols: [
    { abbr: '2', type: '2', label: 'Type 2 6" LED can downlight', takeoffCategory: 'Lighting', category: 'From drawing' },
  ],
  pages: [{
    page: 1,
    kind: 'drawing',
    tokens: [
      { text: 'ELECTRICAL LIGHTING PLAN', x: 80, y: 88 },
      { text: 'E1.01', x: 92, y: 94 },
      { text: '2', x: 31.1, y: 40.5 },
      { text: 'CAN', x: 32.2, y: 40.5 },
    ],
    paths: canPaths,
  }],
});
const canMark = cans.marks.find((mark) => mark.type === 'count');
console.log('canMark keys', canMark && Object.keys(canMark));
console.log('summary', JSON.stringify({
  symbol: canMark?.symbol,
  symbolLabel: canMark?.symbolLabel,
  outlineSource: canMark?.outlineSource,
  outline: canMark?.outline,
  source: canMark?.source,
  x: canMark?.x,
  y: canMark?.y,
}));
if (canMark) {
  console.log('isPoint', isPointDevice(canMark));
  console.log('maxFill', maxFillExtent(canMark));
  console.log('extent', outlineExtent(canMark.outline));
  console.log('usable', isUsablePaintOutline(canMark.outline, {x: canMark.x, y: canMark.y}, maxFillExtent(canMark)));
  console.log('deviceOutline', JSON.stringify(deviceOutline(canMark)));
}
