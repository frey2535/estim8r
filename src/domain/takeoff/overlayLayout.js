export const OVERLAY_FONT_SIZE = 1.05;
export const DEVICE_CLUSTER_RADIUS = 2.8;

export function compactConduitLabel(mark, options = {}) {
  const run = `R${mark?.runNumber || ""}`;
  const parallel = Number(mark?.parallelRuns) || 1;
  const hrs = Number(mark?.homerunCount) || 0;
  if (options.selected) {
    const bits = [run];
    if (parallel > 1) bits.push(`${parallel} runs`);
    else if (hrs) bits.push(`${hrs} HR`);
    if (mark?.conduitSize) bits.push(mark.conduitSize);
    if (options.lengthText) bits.push(options.lengthText);
    return bits.join(" · ");
  }
  if (parallel > 1) return `${run}×${parallel}`;
  if (hrs) return `${run}·${hrs}`;
  return run;
}

export function labelBoxSize(text, fontSize = OVERLAY_FONT_SIZE) {
  const value = String(text || "");
  return {
    w: Math.max(1.8, value.length * fontSize * 0.52),
    h: fontSize * 1.3,
  };
}

export function polylineAnchor(points) {
  const list = points || [];
  if (!list.length) return null;
  if (list.length < 3) {
    const a = list[0];
    const b = list[list.length - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      nx: -dy / len,
      ny: dx / len,
    };
  }
  const index = Math.floor(list.length / 2);
  const a = list[index];
  const prev = list[index - 1];
  const next = list[index + 1] || a;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: a.x,
    y: a.y,
    nx: -dy / len,
    ny: dx / len,
  };
}

export function clusterDeviceCallouts(devices, radius = DEVICE_CLUSTER_RADIUS) {
  const leftover = [...(devices || [])];
  const clusters = [];
  while (leftover.length) {
    const seed = leftover.shift();
    const abbr = seed.abbr || "";
    const members = [seed];
    for (let index = leftover.length - 1; index >= 0; index -= 1) {
      const other = leftover[index];
      if ((other.abbr || "") !== abbr) continue;
      if (Math.hypot(other.x - seed.x, other.y - seed.y) > radius) continue;
      members.push(other);
      leftover.splice(index, 1);
    }
    const x = members.reduce((sum, item) => sum + item.x, 0) / members.length;
    const y = members.reduce((sum, item) => sum + item.y, 0) / members.length;
    const text = members.length > 1 && abbr ? `${abbr} ×${members.length}` : abbr;
    clusters.push({
      id: seed.id,
      x,
      y,
      text,
      count: members.length,
      members,
    });
  }
  return clusters;
}

function boxesOverlap(a, b, pad = 0.35) {
  return a.x < b.x + b.w + pad
    && a.x + a.w + pad > b.x
    && a.y - a.h < b.y + pad
    && a.y + pad > b.y - b.h;
}

function clampLabel(box) {
  return {
    ...box,
    x: Math.min(98.5 - box.w, Math.max(1.2, box.x)),
    y: Math.min(98.6, Math.max(1.8, box.y)),
  };
}

function tryPlace(anchor, text, occupied, fontSize = OVERLAY_FONT_SIZE) {
  const size = labelBoxSize(text, fontSize);
  const nx = Number(anchor.nx) || 0.8;
  const ny = Number(anchor.ny) || -0.75;
  const candidates = [
    { x: anchor.x + nx * 1.1, y: anchor.y + ny * 1.1 },
    { x: anchor.x - size.w - 0.35, y: anchor.y + ny * 1.1 },
    { x: anchor.x + 0.55, y: anchor.y + 1.15 },
    { x: anchor.x - size.w - 0.2, y: anchor.y + 1.15 },
    { x: anchor.x + nx * 2.1, y: anchor.y + ny * 2.1 },
    { x: anchor.x - nx * 1.4, y: anchor.y - ny * 1.4 },
  ];
  for (const point of candidates) {
    const box = clampLabel({ x: point.x, y: point.y, ...size });
    if (!occupied.some((other) => boxesOverlap(box, other))) {
      occupied.push(box);
      return box;
    }
  }
  return null;
}

export function layoutOverlayCallouts({
  conduits = [],
  devices: _devices = [],
  selectedId,
  lengthTextFor,
  fontSize = OVERLAY_FONT_SIZE,
} = {}) {
  const occupied = [];
  const conduitLabels = [];
  for (const mark of conduits) {
    const selected = mark.id === selectedId;
    const text = compactConduitLabel(mark, {
      selected,
      lengthText: selected ? lengthTextFor?.(mark) : "",
    });
    const anchor = polylineAnchor(mark.points);
    if (!anchor || !text) continue;
    const required = selected
      ? tryPlace(anchor, text, occupied, fontSize) || clampLabel({
        x: anchor.x + 0.6,
        y: anchor.y - 0.7,
        ...labelBoxSize(text, fontSize),
      })
      : tryPlace(anchor, text, occupied, fontSize);
    if (!required) continue;
    if (selected && !occupied.includes(required)) occupied.push(required);
    conduitLabels.push({ id: mark.id, text, selected, ...required });
  }

  return { conduitLabels, deviceLabels: [] };
}
