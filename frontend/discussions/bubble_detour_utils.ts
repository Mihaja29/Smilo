import React from 'react';

export const BUBBLE_SIZE = 56;
export const PANEL_OBSTACLE_GAP = 12;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PanelGeometry {
  panelTop: number;
  panelLeft: number;
  panelWidth: number;
  panelHeight: number;
  tailPlacement: 'bottom' | 'top' | 'left' | 'right' | 'none';
  tailClass: string;
  tailStyle: React.CSSProperties;
  originX: number;
  originY: number;
}

export function getEdgeMargin(vw: number): number {
  return vw >= 768 ? 24 : 16;
}

export function getMinBottom(vw: number): number {
  return vw < 768 ? 84 : 24;
}

export function getDefaultBubblePos(): Point {
  if (typeof window === 'undefined') {
    return { x: 1200, y: 720 };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.max(12, vw - BUBBLE_SIZE - getEdgeMargin(vw)),
    y: Math.max(16, vh - BUBBLE_SIZE - getMinBottom(vw)),
  };
}

// CALCUL GEOMETRIQUE DU PANNEAU DE DISCUSSION
export function computePanelGeometry(
  bubblePos: Point,
  snapSide: 'left' | 'right',
  vw: number,
  vh: number
): PanelGeometry {
  const edge = getEdgeMargin(vw);
  const minBottom = getMinBottom(vw);
  const safeTop = 16;
  const safeBottom = Math.max(safeTop + 200, vh - minBottom);
  const idealHeight = Math.min(460, safeBottom - safeTop);
  const spaceAbove = bubblePos.y - 12 - safeTop;
  const spaceBelow = safeBottom - (bubblePos.y + BUBBLE_SIZE + 12);

  const isWideViewport = vw >= 520;
  const panelWidth = isWideViewport
    ? Math.min(356, Math.max(280, vw - edge - BUBBLE_SIZE - 28))
    : Math.max(260, vw - 32);

  let panelHeight = idealHeight;
  let panelTop = safeTop;
  let panelLeft = snapSide === 'left' ? edge : Math.max(16, vw - edge - panelWidth);
  let tailPlacement: 'bottom' | 'top' | 'left' | 'right' | 'none' = 'bottom';

  if (spaceAbove >= idealHeight || (spaceAbove >= 320 && spaceAbove >= spaceBelow)) {
    panelHeight = Math.min(idealHeight, spaceAbove);
    panelTop = Math.max(safeTop, bubblePos.y - 12 - panelHeight);
    tailPlacement = 'bottom';
  } else if (spaceBelow >= idealHeight || (spaceBelow >= 320 && spaceBelow > spaceAbove)) {
    panelHeight = Math.min(idealHeight, spaceBelow);
    panelTop = Math.min(safeBottom - panelHeight, bubblePos.y + BUBBLE_SIZE + 12);
    tailPlacement = 'top';
  } else {
    panelHeight = idealHeight;
    if (isWideViewport) {
      panelLeft =
        snapSide === 'left'
          ? edge + BUBBLE_SIZE + 12
          : Math.max(16, vw - edge - BUBBLE_SIZE - 12 - panelWidth);
      panelTop = Math.min(
        Math.max(safeTop, bubblePos.y + BUBBLE_SIZE / 2 - panelHeight / 2),
        safeBottom - panelHeight
      );
      tailPlacement = snapSide === 'left' ? 'left' : 'right';
    } else {
      panelLeft = 16;
      panelTop = Math.max(safeTop, safeBottom - panelHeight);
      tailPlacement = 'none';
    }
  }

  const bubbleCenterX = bubblePos.x + BUBBLE_SIZE / 2;
  const bubbleCenterY = bubblePos.y + BUBBLE_SIZE / 2;
  const clampedTailX = Math.min(
    Math.max(20, bubbleCenterX - panelLeft - 7),
    panelWidth - 34
  );
  const clampedTailY = Math.min(
    Math.max(20, bubbleCenterY - panelTop - 7),
    panelHeight - 34
  );

  let tailClass = '';
  let tailStyle: React.CSSProperties = {};
  if (tailPlacement === 'bottom') {
    tailClass = '-bottom-[7px] border-b border-r';
    tailStyle = { left: `${clampedTailX}px` };
  } else if (tailPlacement === 'top') {
    tailClass = '-top-[7px] border-t border-l';
    tailStyle = { left: `${clampedTailX}px` };
  } else if (tailPlacement === 'right') {
    tailClass = '-right-[7px] border-t border-r';
    tailStyle = { top: `${clampedTailY}px` };
  } else if (tailPlacement === 'left') {
    tailClass = '-left-[7px] border-b border-l';
    tailStyle = { top: `${clampedTailY}px` };
  }

  return {
    panelTop,
    panelLeft,
    panelWidth,
    panelHeight,
    tailPlacement,
    tailClass,
    tailStyle,
    originX: bubbleCenterX - panelLeft,
    originY: bubbleCenterY - panelTop,
  };
}

export function computeTailForPanel(
  panel: Pick<PanelGeometry, 'panelLeft' | 'panelTop' | 'panelWidth' | 'panelHeight'>,
  bubblePos: Point
): Pick<PanelGeometry, 'tailPlacement' | 'tailClass' | 'tailStyle' | 'originX' | 'originY'> {
  const { panelLeft, panelTop, panelWidth, panelHeight } = panel;
  const bubbleCenterX = bubblePos.x + BUBBLE_SIZE / 2;
  const bubbleCenterY = bubblePos.y + BUBBLE_SIZE / 2;

  const panelRight = panelLeft + panelWidth;
  const panelBottom = panelTop + panelHeight;

  const distLeft = panelLeft - bubbleCenterX;
  const distRight = bubbleCenterX - panelRight;
  const distTop = panelTop - bubbleCenterY;
  const distBottom = bubbleCenterY - panelBottom;

  const maxOut = Math.max(distLeft, distRight, distTop, distBottom);

  let tailPlacement: 'bottom' | 'top' | 'left' | 'right' = 'bottom';
  if (maxOut > 0) {
    if (distBottom === maxOut) {
      tailPlacement = 'bottom';
    } else if (distTop === maxOut) {
      tailPlacement = 'top';
    } else if (distLeft === maxOut) {
      tailPlacement = 'left';
    } else {
      tailPlacement = 'right';
    }
  } else {
    const insideDistLeft = Math.abs(bubbleCenterX - panelLeft);
    const insideDistRight = Math.abs(panelRight - bubbleCenterX);
    const insideDistTop = Math.abs(bubbleCenterY - panelTop);
    const insideDistBottom = Math.abs(panelBottom - bubbleCenterY);
    const minIn = Math.min(insideDistLeft, insideDistRight, insideDistTop, insideDistBottom);
    if (insideDistBottom === minIn) {
      tailPlacement = 'bottom';
    } else if (insideDistTop === minIn) {
      tailPlacement = 'top';
    } else if (insideDistLeft === minIn) {
      tailPlacement = 'left';
    } else {
      tailPlacement = 'right';
    }
  }

  const clampedTailX = Math.min(
    Math.max(20, bubbleCenterX - panelLeft - 7),
    panelWidth - 34
  );
  const clampedTailY = Math.min(
    Math.max(20, bubbleCenterY - panelTop - 7),
    panelHeight - 34
  );

  let tailClass = '';
  let tailStyle: React.CSSProperties = {};
  if (tailPlacement === 'bottom') {
    tailClass = '-bottom-[7px] border-b border-r';
    tailStyle = { left: `${clampedTailX}px` };
  } else if (tailPlacement === 'top') {
    tailClass = '-top-[7px] border-t border-l';
    tailStyle = { left: `${clampedTailX}px` };
  } else if (tailPlacement === 'right') {
    tailClass = '-right-[7px] border-t border-r';
    tailStyle = { top: `${clampedTailY}px` };
  } else {
    tailClass = '-left-[7px] border-b border-l';
    tailStyle = { top: `${clampedTailY}px` };
  }

  return {
    tailPlacement,
    tailClass,
    tailStyle,
    originX: bubbleCenterX - panelLeft,
    originY: bubbleCenterY - panelTop,
  };
}

// CONTOURNEMENT D'OBSTACLE POUR LA BULLE
export function getObstacleRect(panel: Pick<PanelGeometry, 'panelLeft' | 'panelTop' | 'panelWidth' | 'panelHeight'>): Rect {
  return {
    left: panel.panelLeft - BUBBLE_SIZE - PANEL_OBSTACLE_GAP,
    top: panel.panelTop - BUBBLE_SIZE - PANEL_OBSTACLE_GAP,
    right: panel.panelLeft + panel.panelWidth + PANEL_OBSTACLE_GAP,
    bottom: panel.panelTop + panel.panelHeight + PANEL_OBSTACLE_GAP,
  };
}

export function isInsideOpenRect(p: Point, r: Rect): boolean {
  return p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;
}

export function clampToBounds(p: Point, bounds: Bounds): Point {
  return {
    x: Math.min(Math.max(p.x, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(p.y, bounds.minY), bounds.maxY),
  };
}

export function projectOutsideObstacle(p: Point, obs: Rect, bounds: Bounds): Point {
  const clamped = clampToBounds(p, bounds);
  if (!isInsideOpenRect(clamped, obs)) {
    return clamped;
  }

  const candidates: Point[] = [];
  if (obs.left >= bounds.minX && obs.left <= bounds.maxX) {
    candidates.push({ x: obs.left, y: clamped.y });
  }
  if (obs.right >= bounds.minX && obs.right <= bounds.maxX) {
    candidates.push({ x: obs.right, y: clamped.y });
  }
  if (obs.top >= bounds.minY && obs.top <= bounds.maxY) {
    candidates.push({ x: clamped.x, y: obs.top });
  }
  if (obs.bottom >= bounds.minY && obs.bottom <= bounds.maxY) {
    candidates.push({ x: clamped.x, y: obs.bottom });
  }

  if (candidates.length === 0) {
    return clamped;
  }

  let best = candidates[0];
  let bestDist = Math.hypot(clamped.x - best.x, clamped.y - best.y);
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.hypot(clamped.x - candidates[i].x, clamped.y - candidates[i].y);
    if (d < bestDist) {
      bestDist = d;
      best = candidates[i];
    }
  }
  return best;
}

export function segmentIntersectsOpenRect(a: Point, b: Point, r: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-6) {
    if (a.x <= r.left || a.x >= r.right) {
      return false;
    }
  } else {
    const tx1 = (r.left - a.x) / dx;
    const tx2 = (r.right - a.x) / dx;
    tMin = Math.max(tMin, Math.min(tx1, tx2));
    tMax = Math.min(tMax, Math.max(tx1, tx2));
  }

  if (Math.abs(dy) < 1e-6) {
    if (a.y <= r.top || a.y >= r.bottom) {
      return false;
    }
  } else {
    const ty1 = (r.top - a.y) / dy;
    const ty2 = (r.bottom - a.y) / dy;
    tMin = Math.max(tMin, Math.min(ty1, ty2));
    tMax = Math.min(tMax, Math.max(ty1, ty2));
  }

  return tMin < tMax - 1e-5;
}

export function findDetourPath(
  start: Point,
  end: Point,
  obs: Rect,
  bounds: Bounds
): Point[] {
  const safeStart = projectOutsideObstacle(start, obs, bounds);
  const safeEnd = projectOutsideObstacle(end, obs, bounds);
  const prefix: Point[] =
    Math.hypot(safeStart.x - start.x, safeStart.y - start.y) > 0.5 ? [safeStart] : [];

  if (!segmentIntersectsOpenRect(safeStart, safeEnd, obs)) {
    return [...prefix, safeEnd];
  }

  const rawCorners: Point[] = [
    { x: obs.left, y: obs.top },
    { x: obs.right, y: obs.top },
    { x: obs.left, y: obs.bottom },
    { x: obs.right, y: obs.bottom },
  ];

  const validCorners = rawCorners.filter(
    (c) =>
      c.x >= bounds.minX &&
      c.x <= bounds.maxX &&
      c.y >= bounds.minY &&
      c.y <= bounds.maxY
  );

  const nodes: Point[] = [safeStart, ...validCorners, safeEnd];
  const n = nodes.length;
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const visited = new Array<boolean>(n).fill(false);
  dist[0] = 0;

  for (let step = 0; step < n; step++) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && (u === -1 || dist[i] < dist[u])) {
        u = i;
      }
    }
    if (u === -1 || dist[u] === Infinity) break;
    visited[u] = true;
    if (u === n - 1) break;

    for (let v = 0; v < n; v++) {
      if (visited[v] || u === v) continue;
      if (!segmentIntersectsOpenRect(nodes[u], nodes[v], obs)) {
        const w = Math.hypot(nodes[v].x - nodes[u].x, nodes[v].y - nodes[u].y);
        if (dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          prev[v] = u;
        }
      }
    }
  }

  if (dist[n - 1] === Infinity) {
    return [...prefix, safeEnd];
  }

  const route: Point[] = [];
  let cur = n - 1;
  while (cur > 0) {
    route.push(nodes[cur]);
    cur = prev[cur];
  }
  route.reverse();
  return [...prefix, ...route];
}

export function buildSnapKeyframes(
  start: Point,
  waypoints: Point[]
): { x: number[]; y: number[]; times: number[]; duration: number } | null {
  const deduped: Point[] = [start];
  for (const pt of waypoints) {
    const last = deduped[deduped.length - 1];
    if (Math.hypot(pt.x - last.x, pt.y - last.y) > 0.5) {
      deduped.push(pt);
    }
  }

  if (deduped.length < 2) {
    return null;
  }

  const cumDist: number[] = [0];
  for (let i = 1; i < deduped.length; i++) {
    const seg = Math.hypot(
      deduped[i].x - deduped[i - 1].x,
      deduped[i].y - deduped[i - 1].y
    );
    cumDist.push(cumDist[i - 1] + seg);
  }

  const totalDist = cumDist[cumDist.length - 1];
  if (totalDist <= 0.5) {
    return null;
  }

  const times = cumDist.map((d) => d / totalDist);
  const duration = Math.min(0.75, Math.max(0.38, totalDist / 900));

  return {
    x: deduped.map((p) => p.x),
    y: deduped.map((p) => p.y),
    times,
    duration,
  };
}
