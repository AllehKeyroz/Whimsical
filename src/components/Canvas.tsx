import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import type { BoardObject, Connector, Frame, Rect, Shape, TextObject, Vec } from "../types";
import { ShapeNode } from "./ShapeNode";
import { FrameView } from "./FrameView";
import { TextView } from "./TextView";
import { ConnectorView } from "./ConnectorView";
import { ContextBar } from "./ContextBar";
import { boundsOf, normalizeRect, pointInRect, rectsIntersect, routeConnector, snapAnchor } from "../geometry";

type Mode = "idle" | "pan" | "marquee" | "create" | "drag" | "resize";

interface Interaction {
  mode: Mode;
  startWorld: Vec;
  lastWorld: Vec;
  startScreen: Vec;
  panStart: { x: number; y: number };
  handle: number;
  startRects: Record<string, Rect>;
}

const HANDLES = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [0, 0.5],
  [1, 0.5],
  [0, 1],
  [0.5, 1],
  [1, 1],
];

const SNAP_PX = 6;

/** Alignment snapping: snap the dragged bounds' edges/centers to other objects. */
function computeSnap(
  moved: Rect,
  others: Rect[],
  zoom: number,
): { dx: number; dy: number; guides: { orientation: "v" | "h"; pos: number }[] } {
  const threshold = SNAP_PX / zoom;
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
  const guides: { orientation: "v" | "h"; pos: number }[] = [];
  if (gx !== null) guides.push({ orientation: "v", pos: gx });
  if (gy !== null) guides.push({ orientation: "h", pos: gy });
  return { dx, dy, guides };
}

export function Canvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const board = useStore((s) => s.board);
  const camera = useStore((s) => s.camera);
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const editingId = useStore((s) => s.editingId);
  const connectFrom = useStore((s) => s.connectFrom);

  const setCamera = useStore((s) => s.setCamera);
  const panBy = useStore((s) => s.panBy);
  const zoomAt = useStore((s) => s.zoomAt);
  const select = useStore((s) => s.select);
  const selectMany = useStore((s) => s.selectMany);
  const clearSelection = useStore((s) => s.clearSelection);
  const addShape = useStore((s) => s.addShape);
  const addText = useStore((s) => s.addText);
  const addFrame = useStore((s) => s.addFrame);
  const addConnector = useStore((s) => s.addConnector);
  const updateRect = useStore((s) => s.updateRect);
  const setRects = useStore((s) => s.setRects);
  const moveSelection = useStore((s) => s.moveSelection);
  const pushHistory = useStore((s) => s.pushHistory);
  const setTool = useStore((s) => s.setTool);
  const setEditing = useStore((s) => s.setEditing);
  const setConnectFrom = useStore((s) => s.setConnectFrom);
  const openContextBar = useStore((s) => s.openContextBar);
  const closeContextBar = useStore((s) => s.closeContextBar);
  const setConnectorEndpoint = useStore((s) => s.setConnectorEndpoint);
  const setConnectorBend = useStore((s) => s.setConnectorBend);
  const copySelection = useStore((s) => s.copySelection);
  const cutSelection = useStore((s) => s.cutSelection);
  const paste = useStore((s) => s.paste);
  const selectAll = useStore((s) => s.selectAll);
  const deleteSelection = useStore((s) => s.deleteSelection);
  const duplicateSelection = useStore((s) => s.duplicateSelection);

  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [guides, setGuides] = useState<{ orientation: "v" | "h"; pos: number }[]>([]);
  const connDrag = useRef<{
    connId: string;
    kind: "from" | "to" | "bend";
    end?: "from" | "to";
    orientation?: "h" | "v";
    other: Vec;
    segMid: Vec;
  } | null>(null);
  const inter = useRef<Interaction | null>(null);
  const spaceRef = useRef(false);

  const objects = useMemo(() => Object.values(board.objects), [board.objects]);
  const frames = objects.filter((o): o is Frame => o.objectType === "frame").sort((a, b) => a.order - b.order);
  const shapes = objects.filter((o): o is Shape => o.objectType === "shape").sort((a, b) => a.order - b.order);
  const texts = objects.filter((o): o is TextObject => o.objectType === "text").sort((a, b) => a.order - b.order);
  const connectors = objects.filter((o): o is Connector => o.objectType === "connector").sort((a, b) => a.order - b.order);
  const objectRects = useMemo(
    () =>
      objects
        .filter((o): o is Shape | Frame | TextObject => "rect" in o && !!o.rect)
        .map((o) => ({ id: o.id, objectType: o.objectType, rect: o.rect })),
    [objects],
  );

  const rectOf = useCallback(
    (id: string): Rect | null => {
      const o = board.objects[id];
      if (o && "rect" in o && o.rect) return o.rect;
      return null;
    },
    [board.objects],
  );

  const toWorld = useCallback(
    (clientX: number, clientY: number): Vec => {
      const r = svgRef.current!.getBoundingClientRect();
      return {
        x: (clientX - r.left - camera.x) / camera.zoom,
        y: (clientY - r.top - camera.y) / camera.zoom,
      };
    },
    [camera],
  );

  const toScreen = useCallback(
    (p: Vec): Vec => ({ x: p.x * camera.zoom + camera.x, y: p.y * camera.zoom + camera.y }),
    [camera],
  );

  interface ConnHandle {
    connId: string;
    kind: "from" | "to" | "bend";
    end?: "from" | "to";
    orientation?: "h" | "v";
    screen: Vec;
    other: Vec;
    segMid: Vec;
  }

  const connHandles = useMemo<ConnHandle[]>(() => {
    const list: ConnHandle[] = [];
    for (const id of selection) {
      const c = board.objects[id];
      if (!c || c.objectType !== "connector") continue;
      const fo = board.objects[c.fromId];
      const to = board.objects[c.toId];
      const fr = fo && "rect" in fo && fo.rect ? fo.rect : null;
      const tr = to && "rect" in to && to.rect ? to.rect : null;
      if ((!fr && !c.fromPoint) || (!tr && !c.toPoint)) continue;
      const obstacles = objectRects
        .filter((r) => r.objectType === "shape" && r.id !== c.fromId && r.id !== c.toId)
        .map((r) => r.rect);
      const route = routeConnector(c, fr, tr, obstacles);
      const pts = route.points;
      const p0 = pts[0];
      const p1 = pts[pts.length - 1];
      list.push({ connId: id, kind: "from", end: "from", screen: toScreen(p0), other: p1, segMid: p0 });
      list.push({ connId: id, kind: "to", end: "to", screen: toScreen(p1), other: p0, segMid: p1 });
      for (let i = 0; i < pts.length - 1; i++) {
        const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        if (len < 18) continue;
        const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
        const orientation = Math.abs(pts[i].x - pts[i + 1].x) < Math.abs(pts[i].y - pts[i + 1].y) ? "v" : "h";
        list.push({ connId: id, kind: "bend", orientation, screen: toScreen(mid), other: mid, segMid: mid });
      }
    }
    return list;
  }, [selection, board.objects, camera, objectRects, toScreen]);

  // Native, non-passive wheel listener: React registers `onWheel` as passive,
  // so preventDefault() there cannot stop the browser's Ctrl+wheel page zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, factor);
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [panBy, zoomAt]);

  const beginPan = (e: React.PointerEvent) => {
    inter.current = {
      mode: "pan",
      startWorld: toWorld(e.clientX, e.clientY),
      lastWorld: toWorld(e.clientX, e.clientY),
      startScreen: { x: e.clientX, y: e.clientY },
      panStart: { x: camera.x, y: camera.y },
      handle: -1,
      startRects: {},
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return; // right-click handled by onContextMenu
    if (editingId) setEditing(null);
    closeContextBar();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const target = e.target as Element;
    const objectId = target.closest?.("[data-object-id]")?.getAttribute("data-object-id") ?? null;
    const connectorId = target.closest?.("[data-connector-id]")?.getAttribute("data-connector-id") ?? null;

    if (e.button === 1 || spaceRef.current || tool === "pan") {
      beginPan(e);
      return;
    }

    if (connectorId) {
      select(connectorId, e.shiftKey);
      inter.current = null;
      return;
    }

    if (objectId) {
      const obj = board.objects[objectId];
      if (tool === "connect" && obj && "rect" in obj && obj.rect) {
        if (!connectFrom) {
          setConnectFrom(objectId);
        } else if (connectFrom !== objectId) {
          addConnector(connectFrom, objectId);
          setConnectFrom(null);
        }
        return;
      }
      if (obj && "rect" in obj && obj.rect) {
        if (!selection.includes(objectId)) select(objectId, e.shiftKey);
        const ids = selection.includes(objectId) ? selection : [objectId];
        const startRects: Record<string, Rect> = {};
        for (const id of ids) {
          const r = rectOf(id);
          if (r) startRects[id] = { ...r };
        }
        pushHistory();
        inter.current = {
          mode: "drag",
          startWorld: toWorld(e.clientX, e.clientY),
          lastWorld: toWorld(e.clientX, e.clientY),
          startScreen: { x: e.clientX, y: e.clientY },
          panStart: { x: camera.x, y: camera.y },
          handle: -1,
          startRects,
        };
        return;
      }
    }

    // background
    const startWorld = toWorld(e.clientX, e.clientY);
    if (tool.startsWith("shape:") || tool === "frame") {
      inter.current = {
        mode: "create",
        startWorld,
        lastWorld: startWorld,
        startScreen: { x: e.clientX, y: e.clientY },
        panStart: { x: camera.x, y: camera.y },
        handle: -1,
        startRects: {},
      };
      setPreview({ x: startWorld.x, y: startWorld.y, w: 0, h: 0 });
      return;
    }
    if (tool === "text") {
      addText({ x: startWorld.x, y: startWorld.y - 12, w: 160, h: 32 });
      setTool("select");
      return;
    }
    // marquee
    clearSelection();
    inter.current = {
      mode: "marquee",
      startWorld,
      lastWorld: startWorld,
      startScreen: { x: e.clientX, y: e.clientY },
      panStart: { x: camera.x, y: camera.y },
      handle: -1,
      startRects: {},
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const it = inter.current;
    if (!it) return;
    const world = toWorld(e.clientX, e.clientY);
    if (it.mode === "pan") {
      setCamera({ x: it.panStart.x + (e.clientX - it.startScreen.x), y: it.panStart.y + (e.clientY - it.startScreen.y), zoom: camera.zoom });
    } else if (it.mode === "drag") {
      const totalDx = world.x - it.startWorld.x;
      const totalDy = world.y - it.startWorld.y;
      const startRects = Object.values(it.startRects);
      const startBounds = boundsOf(startRects);
      const moved: Rect = { x: startBounds.x + totalDx, y: startBounds.y + totalDy, w: startBounds.w, h: startBounds.h };
      const others = objectRects.filter((r) => !selection.includes(r.id)).map((r) => r.rect);
      const snap = computeSnap(moved, others, camera.zoom);
      const finalDx = totalDx + snap.dx;
      const finalDy = totalDy + snap.dy;
      const updates: Record<string, Rect> = {};
      for (const [id, r] of Object.entries(it.startRects)) {
        updates[id] = { x: r.x + finalDx, y: r.y + finalDy, w: r.w, h: r.h };
      }
      setRects(updates, false);
      setGuides(snap.guides);
      it.lastWorld = world;
    } else if (it.mode === "marquee") {
      it.lastWorld = world;
      setMarquee(normalizeRect(it.startWorld, world));
    } else if (it.mode === "create") {
      it.lastWorld = world;
      setPreview(normalizeRect(it.startWorld, world));
    } else if (it.mode === "resize") {
      const id = selection[0];
      const start = it.startRects[id];
      if (!start) return;
      const dx = world.x - it.startWorld.x;
      const dy = world.y - it.startWorld.y;
      const h = it.handle;
      let { x, y, w, h: hh } = start;
      if (h === 0 || h === 3 || h === 5) { x = start.x + dx; w = start.w - dx; }
      if (h === 2 || h === 4 || h === 7) { w = start.w + dx; }
      if (h === 0 || h === 1 || h === 2) { y = start.y + dy; hh = start.h - dy; }
      if (h === 5 || h === 6 || h === 7) { hh = start.h + dy; }
      updateRect(id, { x, y, w: Math.max(24, w), h: Math.max(24, hh) }, false);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const it = inter.current;
    inter.current = null;
    setGuides([]);
    if (!it) return;
    if (it.mode === "marquee" && marquee) {
      const ids = objects
        .filter((o) => "rect" in o && o.rect && rectsIntersect(o.rect, marquee))
        .map((o) => o.id);
      selectMany(ids);
      setMarquee(null);
    } else if (it.mode === "create" && preview) {
      const w = Math.max(48, preview.w || 192);
      const h = Math.max(40, preview.h || 96);
      const rect = { x: preview.x, y: preview.y, w, h };
      if (tool === "frame") addFrame(rect);
      else addShape(tool.replace("shape:", "") as Shape["shapeType"], rect);
      setPreview(null);
    }
  };

  const startResize = (e: React.PointerEvent, handle: number) => {
    e.stopPropagation();
    const id = selection[0];
    const r = rectOf(id);
    if (!r) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pushHistory();
    inter.current = {
      mode: "resize",
      startWorld: toWorld(e.clientX, e.clientY),
      lastWorld: toWorld(e.clientX, e.clientY),
      startScreen: { x: e.clientX, y: e.clientY },
      panStart: { x: camera.x, y: camera.y },
      handle,
      startRects: { [id]: { ...r } },
    };
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = e.target as Element;
    const objectId = el.closest?.("[data-object-id]")?.getAttribute("data-object-id");
    const connectorId = el.closest?.("[data-connector-id]")?.getAttribute("data-connector-id");
    const id = objectId ?? connectorId;
    if (id) openContextBar(id);
    else closeContextBar();
  };

  const findShapeAt = (p: Vec): Shape | null => {
    let best: Shape | null = null;
    let bestD = 28;
    for (const o of objects) {
      if (o.objectType !== "shape") continue;
      const r = (o as Shape).rect;
      if (p.x >= r.x - 4 && p.x <= r.x + r.w + 4 && p.y >= r.y - 4 && p.y <= r.y + r.h + 4) return o as Shape;
      const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
      const cy = Math.max(r.y, Math.min(p.y, r.y + r.h));
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bestD) {
        bestD = d;
        best = o as Shape;
      }
    }
    return best;
  };

  const startConnDrag = (e: React.PointerEvent, h: ConnHandle) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pushHistory();
    connDrag.current = { connId: h.connId, kind: h.kind, end: h.end, orientation: h.orientation, other: h.other, segMid: h.segMid };
  };

  const onConnDragMove = (e: React.PointerEvent) => {
    const it = connDrag.current;
    if (!it) return;
    const world = toWorld(e.clientX, e.clientY);
    if (it.kind === "from" || it.kind === "to") {
      const shape = findShapeAt(world);
      if (shape) {
        const rel = snapAnchor(shape.rect, it.other);
        setConnectorEndpoint(it.connId, it.kind, { shapeId: shape.id, rel, point: null });
      } else {
        setConnectorEndpoint(it.connId, it.kind, { point: world });
      }
    } else if (it.orientation === "h") {
      setConnectorBend(it.connId, { x: it.segMid.x, y: world.y });
    } else {
      setConnectorBend(it.connId, { x: world.x, y: it.segMid.y });
    }
  };

  const onConnDragEnd = () => {
    connDrag.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const objectId = (e.target as Element).closest?.("[data-object-id]")?.getAttribute("data-object-id");
    const connectorId = (e.target as Element).closest?.("[data-connector-id]")?.getAttribute("data-connector-id");
    closeContextBar();
    if (objectId) {
      const o = board.objects[objectId];
      if (o && (o.objectType === "shape" || o.objectType === "text" || o.objectType === "frame")) {
        select(objectId);
        setEditing(objectId);
      }
    } else if (connectorId) {
      select(connectorId);
      setEditing(connectorId);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") spaceRef.current = true;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelection(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); useStore.getState().undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); useStore.getState().redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelection(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") { e.preventDefault(); copySelection(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") { e.preventDefault(); cutSelection(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") { e.preventDefault(); paste(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); selectAll(); }
      else if (e.key === "Escape") { setEditing(null); setConnectFrom(null); clearSelection(); }
      else if (e.key.startsWith("Arrow")) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (dx || dy) { e.preventDefault(); moveSelection(dx, dy, true); }
      } else if (e.key === "Enter" && selection.length === 1) {
        const o = board.objects[selection[0]];
        if (o && o.objectType !== "connector") setEditing(selection[0]);
      } else if (!e.ctrlKey && !e.metaKey && e.key.length === 1) {
        const map: Record<string, string> = { r: "shape:rect", o: "shape:ellipse", d: "shape:diamond", t: "text", f: "frame", c: "connect", p: "shape:pill", v: "select", h: "pan" };
        if (map[e.key]) setTool(map[e.key] as never);
      }
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === "Space") spaceRef.current = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); };
  }, [board.objects, selection, deleteSelection, duplicateSelection, moveSelection, setEditing, setConnectFrom, clearSelection, setTool, copySelection, cutSelection, paste, selectAll]);

  const selectedSingle = selection.length === 1 ? board.objects[selection[0]] : null;
  const editTarget = editingId ? board.objects[editingId] : null;

  return (
    <div ref={containerRef} className="canvas-container">
      <svg
        ref={svgRef}
        className="board-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        style={{ cursor: tool === "pan" ? "grab" : tool.startsWith("shape:") || tool === "frame" ? "crosshair" : "default" }}
      >
        <defs>
          <pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={1} fill="#dbe2e9" />
          </pattern>
        </defs>
        <rect x={0} y={0} width="100%" height="100%" fill="#fbfcfd" />
        <rect x={0} y={0} width="100%" height="100%" fill="url(#grid)" opacity={0.9} />
        <g transform={`translate(${camera.x},${camera.y}) scale(${camera.zoom})`}>
          {frames.map((f) => (
            <g key={f.id} data-object-id={f.id}>
              <FrameView frame={f} selected={selection.includes(f.id)} />
            </g>
          ))}
          {shapes.map((s) => (
            <g key={s.id} data-object-id={s.id} style={{ cursor: tool === "connect" ? "crosshair" : "move" }}>
              <ShapeNode shape={s} selected={selection.includes(s.id)} />
            </g>
          ))}
          {texts.map((t) => (
            <g key={t.id} data-object-id={t.id} style={{ cursor: "move" }}>
              <TextView text={t} selected={selection.includes(t.id)} />
            </g>
          ))}
          {connectors.map((c) => {
            const fr = rectOf(c.fromId);
            const tr = rectOf(c.toId);
            if ((!fr && !c.fromPoint) || (!tr && !c.toPoint)) return null;
            const obstacles = objectRects
              .filter((r) => r.objectType === "shape" && r.id !== c.fromId && r.id !== c.toId)
              .map((r) => r.rect);
            return (
              <ConnectorView key={c.id} connector={c} fromRect={fr} toRect={tr} obstacles={obstacles} selected={selection.includes(c.id)} />
            );
          })}
          {preview ? (
            <rect x={preview.x} y={preview.y} width={preview.w} height={preview.h} rx={4} fill="rgba(139,63,217,0.08)" stroke="#8b3fd9" strokeDasharray="4 3" strokeWidth={1.5} pointerEvents="none" />
          ) : null}
          {marquee ? (
            <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="rgba(47,123,212,0.10)" stroke="#2f7bd4" strokeWidth={1} pointerEvents="none" />
          ) : null}
          {guides.map((g, i) =>
            g.orientation === "v" ? (
              <line key={i} x1={g.pos} y1={-20000} x2={g.pos} y2={20000} stroke="#e0245e" strokeWidth={1 / camera.zoom} pointerEvents="none" />
            ) : (
              <line key={i} x1={-20000} y1={g.pos} x2={20000} y2={g.pos} stroke="#e0245e" strokeWidth={1 / camera.zoom} pointerEvents="none" />
            ),
          )}
        </g>
      </svg>

      {selectedSingle && "rect" in selectedSingle && selectedSingle.rect && camera.zoom > 0.35 ? (
        <ResizeHandles
          rect={selectedSingle.rect}
          toScreen={toScreen}
          onStart={startResize}
          onMove={onPointerMove}
          onUp={onPointerUp}
        />
      ) : null}

      {camera.zoom > 0.45
        ? connHandles.map((h, i) => (
            <div
              key={`${h.connId}-${h.kind}-${i}`}
              className={`conn-handle ${h.kind}`}
              style={{ left: h.screen.x - 5, top: h.screen.y - 5 }}
              onPointerDown={(e) => startConnDrag(e, h)}
              onPointerMove={onConnDragMove}
              onPointerUp={onConnDragEnd}
            />
          ))
        : null}

      {editTarget && "rect" in editTarget && editTarget.rect && "text" in editTarget ? (
        <TextEditor object={editTarget as Shape | TextObject | Frame} toScreen={toScreen} zoom={camera.zoom} />
      ) : null}
      {editTarget && editTarget.objectType === "connector" ? (
        <ConnectorLabelEditor connector={editTarget as Connector} toScreen={toScreen} zoom={camera.zoom} />
      ) : null}

      {connectFrom ? (
        <div className="connect-hint">Clique no destino para conectar — Esc para cancelar</div>
      ) : null}

      <ContextBar />
    </div>
  );
}

function ResizeHandles({
  rect,
  toScreen,
  onStart,
  onMove,
  onUp,
}: {
  rect: Rect;
  toScreen: (p: Vec) => Vec;
  onStart: (e: React.PointerEvent, h: number) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: (e: React.PointerEvent) => void;
}) {
  const size = 9;
  return (
    <>
      {HANDLES.map(([fx, fy], i) => {
        const p = toScreen({ x: rect.x + rect.w * fx, y: rect.y + rect.h * fy });
        return (
          <div
            key={i}
            className="resize-handle"
            style={{ left: p.x - size / 2, top: p.y - size / 2, width: size, height: size }}
            onPointerDown={(e) => onStart(e, i)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        );
      })}
    </>
  );
}

function ConnectorLabelEditor({ connector, toScreen, zoom }: { connector: Connector; toScreen: (p: Vec) => Vec; zoom: number }) {
  const board = useStore((s) => s.board);
  const updateObject = useStore((s) => s.updateObject);
  const setEditing = useStore((s) => s.setEditing);
  const [value, setValue] = useState(connector.label);
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const fr = board.objects[connector.fromId];
  const tr = board.objects[connector.toId];
  if (!fr || !tr || !("rect" in fr) || !fr.rect || !("rect" in tr) || !tr.rect) return null;
  const route = routeConnector(connector, fr.rect, tr.rect);
  const p = toScreen(route.mid);
  const commit = () => setEditing(null);
  return (
    <input
      ref={ref}
      className="text-editor label-editor"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        updateObject(connector.id, { label: e.target.value } as Partial<BoardObject>, false);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          commit();
        }
      }}
      style={{ left: p.x - 70, top: p.y - 16, width: 140, height: 30, fontSize: 13 * zoom, padding: `${3 * zoom}px ${6 * zoom}px` }}
    />
  );
}

function TextEditor({ object, toScreen, zoom }: { object: Shape | TextObject | Frame; toScreen: (p: Vec) => Vec; zoom: number }) {
  const setText = useStore((s) => s.setText);
  const setEditing = useStore((s) => s.setEditing);
  const fontSize = (object as TextObject).fontSize ?? 18;
  const p = toScreen({ x: object.rect.x, y: object.rect.y });
  const [value, setValue] = useState(object.text);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <textarea
      ref={ref}
      className="text-editor"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { setText(object.id, value); setEditing(null); }}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          setText(object.id, value);
          setEditing(null);
        }
      }}
      style={{
        left: p.x,
        top: p.y,
        width: Math.max(40, object.rect.w * zoom),
        height: Math.max(24, object.rect.h * zoom),
        fontSize: fontSize * zoom,
        lineHeight: 1.333,
        padding: `${8 * zoom}px ${10 * zoom}px`,
      }}
    />
  );
}
