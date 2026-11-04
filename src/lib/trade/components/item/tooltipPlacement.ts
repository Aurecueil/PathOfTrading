export interface WorldAnchor {
  l: number;
  r: number;
  t: number;
  b: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function rectToWorld(
  canvas: { getWorld: () => HTMLElement | null } | undefined,
  rect: DOMRect,
): WorldAnchor {
  const world = canvas?.getWorld();
  const vp = world?.parentElement;
  if (!world || !vp) {
    return {
      l: rect.left,
      r: rect.right,
      t: rect.top,
      b: rect.bottom,
      minX: 0,
      minY: 0,
      maxX: window.innerWidth,
      maxY: window.innerHeight,
    };
  }
  const wr = world.getBoundingClientRect(); // world is 1x1px, so width === scale
  const vr = vp.getBoundingClientRect();
  const s = wr.width || 1;
  return {
    l: (rect.left - wr.left) / s,
    r: (rect.right - wr.left) / s,
    t: (rect.top - wr.top) / s,
    b: (rect.bottom - wr.top) / s,
    minX: (vr.left - wr.left) / s,
    minY: (vr.top - wr.top) / s,
    maxX: (vr.right - wr.left) / s,
    maxY: (vr.bottom - wr.top) / s,
  };
}

export function placeBeside(
  a: WorldAnchor,
  w: number,
  h: number,
  gap = 8,
  pad = 8,
) {
  const maxH = a.maxY - a.minY - pad * 2;
  const hh = Math.min(h, maxH);
  const spaceRight = a.maxX - a.r - gap - pad;
  const spaceLeft = a.l - gap - pad - a.minX;

  let left: number;
  if (w <= spaceRight) left = a.r + gap;
  else if (w <= spaceLeft) left = a.l - gap - w;
  else if (spaceRight >= spaceLeft)
    left = Math.max(a.minX + pad, a.maxX - w - pad);
  else left = Math.max(a.minX + pad, a.l - gap - w);

  const top = Math.max(a.minY + pad, Math.min(a.t, a.maxY - hh - pad));
  return { left, top, maxH };
}
