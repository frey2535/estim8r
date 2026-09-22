export function moveEstimateLine(lines = [], fromIndex, toIndex) {
  const next = [...lines];
  const from = Number(fromIndex);
  const to = Number(toIndex);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return next;
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

export function applySavedLineOrder(lines = [], orderedIds = []) {
  if (!orderedIds.length) return [...lines];
  const byId = new Map(lines.map((line) => [line.id, line]));
  const next = [];
  const seen = new Set();
  for (const id of orderedIds) {
    const line = byId.get(id);
    if (!line || seen.has(line.id)) continue;
    next.push(line);
    seen.add(line.id);
  }
  for (const line of lines) {
    if (seen.has(line.id)) continue;
    next.push(line);
  }
  return next;
}
