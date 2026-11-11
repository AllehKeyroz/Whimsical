import type { Cardinality, Connector, EndpointMarker, Rect, Vec } from "./types";

export const STUB = 22;
export const CORNER = 8;
export const SNAP_PX = 6;

export function rectCenter(r: Rect): Vec {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function rotatePoint(p: Vec, center: Vec, deg: number): Vec {
  if (!deg) return { ...p };
  const rad = degToRad(deg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

export function rectCorners(rect: Rect, rotation = 0): Vec[] {
  const c = rectCenter(rect);
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ].map((p) => rotatePoint(p, c, rotation));
}

/** Axis-aligned bounding box of a possibly rotated rect. */
export function aabbOfRect(rect: Rect, rotation = 0): Rect {
  if (!rotation) return { ...rect };
  const pts = rectCorners(rect, rotation);
  return boundsOf(pts.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
}

export function pointInRectRotated(p: Vec, rect: Rect, rotation = 0): boolean {
  if (!rotation) return pointInRect(p, rect);
  const c = rectCenter(rect);
  const local = rotatePoint(p, c, -rotation);
  return pointInRect(local, rect);
}

export function anchorPoint(
  r: Rect,
  rel: { rx: number; ry: number; axis?: "x" | "y" },
  other?: Vec,
): Vec {
  if (rel.axis === "x") {
    const cx = r.x + r.w / 2;
    const right = other ? other.x >= cx : rel.rx >= 0.5;
    return { x: right ? r.x + r.w : r.x, y: r.y + r.h * rel.ry };
  }
  if (rel.axis === "y") {
    const cy = r.y + r.h / 2;
    const below = other ? other.y >= cy : rel.ry >= 0.5;
    return { x: r.x + r.w * rel.rx, y: below ? r.y + r.h : r.y };
  }
  return { x: r.x + r.w * rel.rx, y: r.y + r.h * rel.ry };
}

export function exitDir(
  rel: { rx: number; ry: number; axis?: "x" | "y" },
  rect: Rect,
  other: Vec,
): Vec {
  const c = rectCenter(rect);
  const dx = other.x - c.x;
  const dy = other.y - c.y;
  if (rel.axis === "x") return { x: Math.sign(dx) || 1, y: 0 };
  if (rel.axis === "y") return { x: 0, y: Math.sign(dy) || 1 };
  if (rel.rx <= 0.25) return { x: -1, y: 0 };
  if (rel.rx >= 0.75) return { x: 1, y: 0 };
  if (rel.ry <= 0.25) return { x: 0, y: -1 };
  if (rel.ry >= 0.75) return { x: 0, y: 1 };
  return Math.abs(dx) > Math.abs(dy)
    ? { x: Math.sign(dx) || 1, y: 0 }
    : { x: 0, y: Math.sign(dy) || 1 };
}

function add(a: Vec, b: Vec, s = 1): Vec {
  return { x: a.x + b.x * s, y: a.y + b.y * s };
}

function dedupe(points: Vec[]): Vec[] {
  const out: Vec[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.5 || Math.abs(last.y - p.y) > 0.5) {
      out.push(p);
    }
  }
  // remove collinear midpoints
  const res: Vec[] = [];
  for (let i = 0; i < out.length; i++) {
    const prev = out[i - 1];
    const cur = out[i];
    const next = out[i + 1];
    if (prev && next) {
      const collinear =
        (Math.abs(prev.x - cur.x) < 0.5 && Math.abs(cur.x - next.x) < 0.5) ||
        (Math.abs(prev.y - cur.y) < 0.5 && Math.abs(cur.y - next.y) < 0.5);
      if (collinear) continue;
    }
    res.push(cur);
  }
  return res;
}

function roundedPath(points: Vec[], radius = CORNER): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const inDir = norm({ x: cur.x - prev.x, y: cur.y - prev.y });
    const outDir = norm({ x: next.x - cur.x, y: next.y - cur.y });
    const r = Math.min(radius, dist(prev, cur) / 2, dist(cur, next) / 2);
    const a = add(cur, inDir, -r);
    const b = add(cur, outDir, r);
    d += ` L ${a.x} ${a.y} Q ${cur.x} ${cur.y} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function norm(v: Vec): Vec {
  const m = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / m, y: v.y / m };
}

function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface RouteResult {
  d: string;
  points: Vec[];
  endDir: Vec;
  mid: Vec;
}

export function routeConnector(
  conn: Connector,
  fromRect: Rect | null,
  toRect: Rect | null,
  obstacles: Rect[] = [],
): RouteResult {
  const fromCenter = fromRect ? rectCenter(fromRect) : { x: 0, y: 0 };
  const toCenter = toRect ? rectCenter(toRect) : { x: 0, y: 0 };
  const p0 = conn.fromPoint ?? (fromRect ? anchorPoint(fromRect, conn.fromRel, toCenter) : fromCenter);
  const p1 = conn.toPoint ?? (toRect ? anchorPoint(toRect, conn.toRel, fromCenter) : toCenter);
  const d0 = conn.fromPoint || !fromRect ? dominantDir(p0, p1) : exitDir(conn.fromRel, fromRect, p1);
  const d1 = conn.toPoint || !toRect ? dominantDir(p1, p0) : exitDir(conn.toRel, toRect, p0);
  const fr = fromRect ?? { x: p0.x, y: p0.y, w: 0, h: 0 };
  const tr = toRect ?? { x: p1.x, y: p1.y, w: 0, h: 0 };

  if (conn.connectorType === "straight") {
    const mid = midpoint(p0, p1);
    return {
      d: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`,
      points: [p0, p1],
      endDir: norm({ x: p1.x - p0.x, y: p1.y - p0.y }),
      mid,
    };
  }

  if (conn.connectorType === "curved") {
    const a = add(p0, d0, conn.fromPoint ? STUB : STUB * 2);
    const b = add(p1, d1, conn.toPoint ? STUB : STUB * 2);
    const d = `M ${p0.x} ${p0.y} C ${a.x} ${a.y} ${b.x} ${b.y} ${p1.x} ${p1.y}`;
    const endDir = norm({ x: p1.x - b.x, y: p1.y - b.y });
    return { d, points: [p0, p1], endDir, mid: midpoint(p0, p1) };
  }

  // Elbow (orthogonal). Generate several candidate orthogonal paths and pick
  // the one that crosses the fewest other objects, then the cleanest/shorter.
  const a = add(p0, d0, conn.fromPoint ? 0 : STUB);
  const b = add(p1, d1, conn.toPoint ? 0 : STUB);

  // A manual bend (set by dragging a segment) wins over automatic routing.
  if (conn.bend) {
    const bend = conn.bend;
    const throughX = dedupe([p0, a, { x: bend.x, y: a.y }, { x: bend.x, y: b.y }, b, p1]);
    const throughY = dedupe([p0, a, { x: a.x, y: bend.y }, { x: b.x, y: bend.y }, b, p1]);
    const pick = pathDistanceToPoint(throughX, bend) <= pathDistanceToPoint(throughY, bend) ? throughX : throughY;
    const last = pick[pick.length - 2] ?? p0;
    const endDir = norm({ x: p1.x - last.x, y: p1.y - last.y });
    return { d: roundedPath(pick), points: pick, endDir, mid: pathMidpoint(pick) };
  }
  const ext = 36;
  const minX = Math.min(a.x, b.x, fr.x, tr.x) - ext;
  const maxX = Math.max(a.x, b.x, fr.x + fr.w, tr.x + tr.w) + ext;
  const minY = Math.min(a.y, b.y, fr.y, tr.y) - ext;
  const maxY = Math.max(a.y, b.y, fr.y + fr.h, tr.y + tr.h) + ext;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  const candidates: Vec[][] = [
    [a, { x: b.x, y: a.y }, b],
    [a, { x: a.x, y: b.y }, b],
    [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b],
    [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b],
    [a, { x: minX, y: a.y }, { x: minX, y: b.y }, b],
    [a, { x: maxX, y: a.y }, { x: maxX, y: b.y }, b],
    [a, { x: a.x, y: minY }, { x: b.x, y: minY }, b],
    [a, { x: a.x, y: maxY }, { x: b.x, y: maxY }, b],
    [a, { x: a.x, y: minY }, { x: b.x, y: minY }, { x: b.x, y: b.y }, b],
    [a, { x: a.x, y: maxY }, { x: b.x, y: maxY }, { x: b.x, y: b.y }, b],
    [a, { x: minX, y: a.y }, { x: minX, y: b.y }, { x: b.x, y: b.y }, b],
    [a, { x: maxX, y: a.y }, { x: maxX, y: b.y }, { x: b.x, y: b.y }, b],
  ];

  let best: Vec[] | null = null;
  let bestScore = Infinity;
  for (const cand of candidates) {
    const pts = dedupe([p0, ...cand, p1]);
    const score =
      pathHits(pts, obstacles) * 1000 +
      reversalPenalty(pts, d0, d1) +
      pts.length * 4 +
      pathLength(pts) * 0.02;
    if (score < bestScore) {
      bestScore = score;
      best = pts;
    }
  }
  const points = best ?? dedupe([p0, a, { x: b.x, y: a.y }, b, p1]);
  const last = points[points.length - 2] ?? p0;
  const endDir = norm({ x: p1.x - last.x, y: p1.y - last.y });
  return { d: roundedPath(points), points, endDir, mid: pathMidpoint(points) };
}

function segRect(a: Vec, b: Vec, r: Rect, pad = 4): boolean {
  const x1 = r.x - pad;
  const y1 = r.y - pad;
  const x2 = r.x + r.w + pad;
  const y2 = r.y + r.h + pad;
  if (Math.abs(a.x - b.x) < 0.5) {
    if (a.x <= x1 || a.x >= x2) return false;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return hi > y1 && lo < y2;
  }
  if (Math.abs(a.y - b.y) < 0.5) {
    if (a.y <= y1 || a.y >= y2) return false;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return hi > x1 && lo < x2;
  }
  const loX = Math.min(a.x, b.x);
  const hiX = Math.max(a.x, b.x);
  const loY = Math.min(a.y, b.y);
  const hiY = Math.max(a.y, b.y);
  return !(hiX < x1 || loX > x2 || hiY < y1 || loY > y2);
}

function pathHits(points: Vec[], obstacles: Rect[]): number {
  let hits = 0;
  for (let i = 0; i < points.length - 1; i++) {
    for (const r of obstacles) {
      if (segRect(points[i], points[i + 1], r)) hits++;
    }
  }
  return hits;
}

function reversalPenalty(points: Vec[], d0: Vec, d1: Vec): number {
  let p = 0;
  if (points.length >= 3) {
    const s1 = norm({ x: points[1].x - points[0].x, y: points[1].y - points[0].y });
    const s2 = norm({ x: points[2].x - points[1].x, y: points[2].y - points[1].y });
    if (s1.x * s2.x + s1.y * s2.y < -0.5) p += 300;
    const n = points.length;
    const se = norm({ x: points[n - 1].x - points[n - 2].x, y: points[n - 1].y - points[n - 2].y });
    const expected = { x: -d1.x, y: -d1.y };
    if (se.x * expected.x + se.y * expected.y < -0.5) p += 300;
  }
  return p;
}

function pathLength(points: Vec[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++)
    len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  return len;
}

function pathMidpoint(points: Vec[]): Vec {
  const total = pathLength(points);
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const seg = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (acc + seg >= total / 2) {
      const t = seg === 0 ? 0 : (total / 2 - acc) / seg;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    acc += seg;
  }
  return points[Math.floor(points.length / 2)] ?? midpoint(points[0], points[points.length - 1]);
}

function midpoint(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dominantDir(a: Vec, b: Vec): Vec {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: Math.sign(dx) || 1, y: 0 }
    : { x: 0, y: Math.sign(dy) || 1 };
}

function pointSegDist(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function pathDistanceToPoint(points: Vec[], p: Vec): number {
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++)
    min = Math.min(min, pointSegDist(p, points[i], points[i + 1]));
  return min;
}

export function arrowPath(tip: Vec, dir: Vec, size = 12): string {
  const d = norm(dir);
  const back = { x: tip.x - d.x * size, y: tip.y - d.y * size };
  const perp = { x: -d.y, y: d.x };
  const w = size * 0.36;
  const l = { x: back.x + perp.x * w, y: back.y + perp.y * w };
  const r = { x: back.x - perp.x * w, y: back.y - perp.y * w };
  return `M ${tip.x} ${tip.y} L ${l.x} ${l.y} L ${r.x} ${r.y} Z`;
}

function circlePath(center: Vec, radius: number): string {
  return `M ${center.x - radius} ${center.y} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
}

function diamondPath(center: Vec, size: number): string {
  return `M ${center.x} ${center.y - size} L ${center.x + size} ${center.y} L ${center.x} ${center.y + size} L ${center.x - size} ${center.y} Z`;
}

function line(a: Vec, b: Vec): string {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

/** Crow's foot (many) notation: three strokes fanning back from `at`. */
function crowFoot(at: Vec, dir: Vec): string[] {
  const d = norm(dir);
  const perp = { x: -d.y, y: d.x };
  const back = add(at, d, -13);
  const spread = 7;
  return [
    line(add(back, perp, spread), at),
    line(add(back, perp, -spread), at),
    line(back, at),
  ];
}

export interface MarkerPath {
  d: string;
  fill: boolean;
  stroke: boolean;
}

/**
 * Endpoint marker + optional UML cardinality notation, matching Whimsical's
 * connector "From/To endpoint" menu.
 */
export function endpointMarkup(
  tip: Vec,
  dir: Vec,
  marker: EndpointMarker,
  cardinality: Cardinality,
): MarkerPath[] {
  const d = norm(dir);
  const paths: MarkerPath[] = [];

  switch (marker) {
    case "arrow":
      paths.push({ d: arrowPath(tip, d, 13), fill: true, stroke: false });
      break;
    case "circle":
      paths.push({ d: circlePath(add(tip, d, -5), 4.5), fill: false, stroke: true });
      break;
    case "diamond":
      paths.push({ d: diamondPath(add(tip, d, -8), 6), fill: true, stroke: false });
      break;
    case "fork": {
      for (const p of crowFoot(tip, d)) paths.push({ d: p, fill: false, stroke: true });
      break;
    }
    case "none":
    default:
      break;
  }

  if (cardinality) {
    const base = add(tip, d, marker === "none" ? -2 : -20);
    const many = cardinality === "zero-or-many" || cardinality === "one-or-many";
    const zero = cardinality === "zero-or-one" || cardinality === "zero-or-many";
    const at = many ? add(base, d, -14) : base;
    if (zero) {
      paths.push({ d: circlePath(at, 4), fill: false, stroke: true });
    } else {
      const perp = { x: -d.y, y: d.x };
      paths.push({ d: line(add(at, perp, 6), add(at, perp, -6)), fill: false, stroke: true });
    }
    if (many) {
      for (const p of crowFoot(base, d)) paths.push({ d: p, fill: false, stroke: true });
    }
  }

  return paths;
}

export function boundsOf(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function boundsOfPoints(points: Vec[]): Rect {
  return boundsOf(points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
}

export function pointInRect(p: Vec, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function normalizeRect(a: Vec, b: Vec): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

export function snapAnchor(rect: Rect, p: Vec): { rx: number; ry: number; axis: "x" | "y" } {
  const c = rectCenter(rect);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const horizontal = Math.abs(dx) / Math.max(1, rect.w) >= Math.abs(dy) / Math.max(1, rect.h);
  if (horizontal) return { rx: dx >= 0 ? 1 : 0, ry: 0.5, axis: "x" };
  return { rx: 0.5, ry: dy >= 0 ? 1 : 0, axis: "y" };
}

export interface SnapGuide {
  orientation: "v" | "h";
  pos: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

/**
 * Alignment snapping: snap the dragged bounds' edges/centers to other objects
 * and optionally to the grid.
 */
export function computeSnap(
  moved: Rect,
  others: Rect[],
  opts: { zoom: number; grid: boolean; snap: boolean; gridSize?: number },
): SnapResult {
  const guides: SnapGuide[] = [];
  if (!opts.snap) return { dx: 0, dy: 0, guides };
  const threshold = SNAP_PX / Math.max(0.05, opts.zoom);
  const xs = [moved.x, moved.x + moved.w / 2, moved.x + moved.w];
  const ys = [moved.y, moved.y + moved.h / 2, moved.y + moved.h];
  let dx = 0;
  let dy = 0;
  let bestX = Infinity;
  let bestY = Infinity;
  let gx: number | null = null;
  let gy: number | null = null;
  for (const o of others) {
    const oxs = [o.x, o.x + o.w / 2, o.x + o.w];
    const oys = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const sx of xs) {
      for (const tx of oxs) {
        const d = tx - sx;
        const ad = Math.abs(d);
        if (ad <= threshold && ad < bestX) {
          bestX = ad;
          dx = d;
          gx = tx;
        }
      }
    }
    for (const sy of ys) {
      for (const ty of oys) {
        const d = ty - sy;
        const ad = Math.abs(d);
        if (ad <= threshold && ad < bestY) {
          bestY = ad;
          dy = d;
          gy = ty;
        }
      }
    }
  }
  if (opts.grid) {
    const g = opts.gridSize ?? 24;
    if (gx === null) {
      const target = Math.round(moved.x / g) * g;
      const d = target - moved.x;
      if (Math.abs(d) <= threshold) {
        dx = d;
        gx = target;
      }
    }
    if (gy === null) {
      const target = Math.round(moved.y / g) * g;
      const d = target - moved.y;
      if (Math.abs(d) <= threshold) {
        dy = d;
        gy = target;
      }
    }
  }
  if (gx !== null) guides.push({ orientation: "v", pos: gx });
  if (gy !== null) guides.push({ orientation: "h", pos: gy });
  return { dx, dy, guides };
}

export function expandRect(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

/** Distance from a point to a connector route, useful for hit testing. */
export function distanceToRoute(points: Vec[], p: Vec): number {
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++)
    min = Math.min(min, pointSegDist(p, points[i], points[i + 1]));
  return min;
}
