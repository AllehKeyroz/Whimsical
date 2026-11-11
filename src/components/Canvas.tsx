import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasClipboard, INTERNAL_CLIPBOARD_PREFIX, useStore } from "../store";
import { detectMermaidKind } from "../lib/mermaid";
import { looksLikeOutline } from "../lib/outline";
import { colorToken } from "../palette";
import type {
  BoardObject,
  Connector,
  Frame,
  IconObject,
  ImageObject,
  Rect,
  Shape,
  TextObject,
  Vec,
} from "../types";
import { isConnector, isFrame, isIcon, isImage, isShape, isText } from "../types";
import { ShapeNode } from "./ShapeNode";
import { FrameView } from "./FrameView";
import { TextView } from "./TextView";
import { ImageNode } from "./ImageNode";
import { IconNode } from "./IconNode";
import { ConnectorView } from "./ConnectorView";
import { ContextBar } from "./ContextBar";
import { MindColorBar } from "./MindColorBar";
import { ContextMenu } from "./ContextMenu";
import { TextEditor } from "./TextEditor";
import { ConnectorLabelEditor } from "./ConnectorLabelEditor";
import { Icon } from "./icons";
import {
  aabbOfRect,
  boundsOf,
  computeSnap,
  normalizeRect,
  pointInRectRotated,
  rectCenter,
  rectsIntersect,
  routeConnector,
  snapAnchor,
  type RouteResult,
} from "../geometry";

type Mode = "pan" | "marquee" | "create" | "drag" | "resize" | "link";

interface Interaction {
  mode: Mode;
  startWorld: Vec;
  lastWorld: Vec;
  startScreen: Vec;
  panStart: { x: number; y: number };
  handle: number;
  startRects: Record<string, Rect>;
  startBounds: Rect;
  ids: string[];
  sourceId?: string;
  historyPushed: boolean;
  moved: boolean;
  movingFrame: boolean;
}

interface ConnHandle {
  connId: string;
  kind: "from" | "to" | "bend";
  end?: "from" | "to";
  orientation?: "h" | "v";
  screen: Vec;
  other: Vec;
  segMid: Vec;
}

interface LinkPreview {
  from: Vec;
  to: Vec;
  sourceId: string;
  targetId: string | null;
}

const HANDLES: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [0, 0.5],
  [1, 0.5],
  [0, 1],
  [0.5, 1],
  [1, 1],
];

const HANDLE_CLASS = ["nwse", "ns", "nesw", "ew", "ew", "nesw", "ns", "nwse"];

function collectMoveIds(board: ReturnType<typeof useStore.getState>["board"], seed: string[]): string[] {
  const out = new Set(seed.filter((id) => !!board.objects[id]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const o of Object.values(board.objects)) {
      if (out.has(o.id)) continue;
      const groupHit = o.groupId && [...out].some((id) => board.objects[id]?.groupId === o.groupId);
      const childHit = o.parentId && out.has(o.parentId);
      if (groupHit || childHit) {
        out.add(o.id);
        changed = true;
      }
    }
  }
  return [...out].filter((id) => {
    const o = board.objects[id];
    return !!o && !o.locked && !o.hidden && o.objectType !== "connector" && "rect" in o && !!o.rect;
  });
}

function frameUnder(board: ReturnType<typeof useStore.getState>["board"], p: Vec, exclude: Set<string>): Frame | null {
  const frames = Object.values(board.objects)
    .filter((o): o is Frame => o.objectType === "frame" && !o.hidden && !exclude.has(o.id) && !!o.rect)
    .filter((f) => pointInRectRotated(p, f.rect, f.rotation ?? 0))
    .sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h);
  return frames[0] ?? null;
}

function objectAt(
  board: ReturnType<typeof useStore.getState>["board"],
  p: Vec,
  tolerance = 0,
  exclude?: Set<string>,
): BoardObject | null {
  const list = Object.values(board.objects)
    .filter((o) => !o.hidden && o.objectType !== "connector" && "rect" in o && !!o.rect && !exclude?.has(o.id))
    .sort((a, b) => b.order - a.order);
  for (const o of list) {
    if (!("rect" in o)) continue;
    if (pointInRectRotated(p, o.rect, o.rotation ?? 0)) return o;
  }
  if (tolerance <= 0) return null;
  let best: BoardObject | null = null;
  let bestD = tolerance;
  for (const o of list) {
    if (!("rect" in o)) continue;
    const r = aabbOfRect(o.rect, o.rotation ?? 0);
    const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(p.y, r.y + r.h));
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

export function Canvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imagePointRef = useRef<Vec>({ x: 0, y: 0 });
  const spaceRef = useRef(false);
  const pinchingRef = useRef(false);
  const inter = useRef<Interaction | null>(null);
  const connDrag = useRef<{
    connId: string;
    kind: "from" | "to" | "bend";
    end?: "from" | "to";
    orientation?: "h" | "v";
    other: Vec;
    segMid: Vec;
  } | null>(null);

  const board = useStore((s) => s.board);
  const camera = useStore((s) => s.camera);
  const settings = useStore((s) => s.settings);
  const selection = useStore((s) => s.selection);
  const editingId = useStore((s) => s.editingId);
  const connectFrom = useStore((s) => s.connectFrom);
  const tool = useStore((s) => s.tool);
  const guides = useStore((s) => s.guides);
  const presentation = useStore((s) => s.presentation);

  const setCamera = useStore((s) => s.setCamera);
  const panBy = useStore((s) => s.panBy);
  const zoomAt = useStore((s) => s.zoomAt);
  const fitView = useStore((s) => s.fitView);
  const setGuides = useStore((s) => s.setGuides);
  const select = useStore((s) => s.select);
  const selectMany = useStore((s) => s.selectMany);
  const clearSelection = useStore((s) => s.clearSelection);
  const addShape = useStore((s) => s.addShape);
  const addText = useStore((s) => s.addText);
  const addFrame = useStore((s) => s.addFrame);
  const addImage = useStore((s) => s.addImage);
  const addConnector = useStore((s) => s.addConnector);
  const quickAdd = useStore((s) => s.quickAdd);
  const addMindChild = useStore((s) => s.addMindChild);
  const createConnectedNode = useStore((s) => s.createConnectedNode);
  const setRects = useStore((s) => s.setRects);
  const pushHistory = useStore((s) => s.pushHistory);
  const reparentSelection = useStore((s) => s.reparentSelection);
  const setTool = useStore((s) => s.setTool);
  const setEditing = useStore((s) => s.setEditing);
  const setConnectFrom = useStore((s) => s.setConnectFrom);
  const closeContextMenu = useStore((s) => s.openContextMenu);
  const openContextMenu = useStore((s) => s.openContextMenu);
  const setConnectorEndpoint = useStore((s) => s.setConnectorEndpoint);
  const setConnectorBend = useStore((s) => s.setConnectorBend);
  const toggleMindCollapse = useStore((s) => s.toggleMindCollapse);

  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [dropFrameId, setDropFrameId] = useState<string | null>(null);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Vec => {
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
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

  const objects = useMemo(
    () => Object.values(board.objects).filter((o) => !o.hidden),
    [board.objects],
  );
  const frames = useMemo(
    () => objects.filter((o): o is Frame => isFrame(o)).sort((a, b) => a.order - b.order),
    [objects],
  );
  const contentObjects = useMemo(
    () => objects.filter((o) => o.objectType !== "connector" && o.objectType !== "frame").sort((a, b) => a.order - b.order),
    [objects],
  );
  const connectors = useMemo(
    () => objects.filter((o): o is Connector => isConnector(o)).sort((a, b) => a.order - b.order),
    [objects],
  );

  const mindControls = useMemo(() => {
    if (!board.mindMap) return [];
    const allConnectors = Object.values(board.objects).filter(isConnector);
    const childrenOf = new Map<string, string[]>();
    for (const c of allConnectors) {
      const list = childrenOf.get(c.fromId) ?? [];
      list.push(c.toId);
      childrenOf.set(c.fromId, list);
    }
    const countDescendants = (id: string, seen = new Set<string>()): number => {
      if (seen.has(id)) return 0;
      seen.add(id);
      let total = 0;
      for (const child of childrenOf.get(id) ?? []) {
        total += 1 + countDescendants(child, seen);
      }
      return total;
    };
    const controls: { id: string; cx: number; cy: number; count: number; collapsed: boolean; color: string }[] = [];
    for (const [id, kids] of childrenOf) {
      if (!kids.length) continue;
      const node = board.objects[id];
      if (!node || node.hidden || !("rect" in node) || !node.rect) continue;
      const firstChild = board.objects[kids[0]];
      const fallback =
        firstChild && firstChild.objectType !== "connector" && "style" in firstChild
          ? colorToken(firstChild.style.color).base
          : "#8b3fd9";
      const color =
        node.objectType === "text" ? node.textStyle.color ?? fallback : node.objectType === "shape" ? colorToken(node.style.color).base : fallback;
      controls.push({
        id,
        cx: node.rect.x + node.rect.w + 8,
        cy: node.rect.y + node.rect.h / 2,
        count: countDescendants(id),
        collapsed: !!node.mindCollapsed,
        color,
      });
    }
    return controls;
  }, [board]);

  const rectObjects = useMemo(
    () =>
      objects
        .filter(
          (o): o is Shape | Frame | TextObject | ImageObject | IconObject =>
            o.objectType !== "connector" && "rect" in o && !!o.rect,
        )
        .map((o) => ({ id: o.id, type: o.objectType, rect: aabbOfRect(o.rect, o.rotation ?? 0) })),
    [objects],
  );

  const routes = useMemo(() => {
    const map = new Map<string, RouteResult>();
    for (const c of connectors) {
      const from = board.objects[c.fromId];
      const to = board.objects[c.toId];
      const fromRect =
        from && from.objectType !== "connector" && "rect" in from ? aabbOfRect(from.rect, from.rotation ?? 0) : null;
      const toRect =
        to && to.objectType !== "connector" && "rect" in to ? aabbOfRect(to.rect, to.rotation ?? 0) : null;
      const obstacles = rectObjects
        .filter((r) => r.type === "shape" && r.id !== c.fromId && r.id !== c.toId)
        .map((r) => r.rect);
      map.set(c.id, routeConnector(c, fromRect, toRect, obstacles));
    }
    return map;
  }, [connectors, board.objects, rectObjects]);

  const selectedRectObjects = useMemo(
    () =>
      selection
        .map((id) => board.objects[id])
        .filter(
          (o): o is Shape | Frame | TextObject | ImageObject | IconObject =>
            !!o && o.objectType !== "connector" && "rect" in o && !!o.rect,
        ),
    [selection, board.objects],
  );
  const selBounds = useMemo(
    () => (selectedRectObjects.length ? boundsOf(selectedRectObjects.map((o) => aabbOfRect(o.rect, o.rotation ?? 0))) : null),
    [selectedRectObjects],
  );
  const single = selection.length === 1 ? board.objects[selection[0]] : null;
  const singleRect =
    single && single.objectType !== "connector" && "rect" in single && single.rect ? single : null;
  const editTarget = editingId ? board.objects[editingId] : null;

  const connHandles = useMemo<ConnHandle[]>(() => {
    const list: ConnHandle[] = [];
    for (const id of selection) {
      const c = board.objects[id];
      if (!c || c.objectType !== "connector") continue;
      const route = routes.get(c.id);
      if (!route) continue;
      const pts = route.points;
      const p0 = pts[0];
      const p1 = pts[pts.length - 1];
      list.push({ connId: id, kind: "from", end: "from", screen: toScreen(p0), other: p1, segMid: p0 });
      list.push({ connId: id, kind: "to", end: "to", screen: toScreen(p1), other: p0, segMid: p1 });
      if (c.connectorType === "elbow") {
        for (let i = 0; i < pts.length - 1; i++) {
          const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
          if (len < 18) continue;
          const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
          const orientation = Math.abs(pts[i].x - pts[i + 1].x) < Math.abs(pts[i].y - pts[i + 1].y) ? "v" : "h";
          list.push({ connId: id, kind: "bend", orientation, screen: toScreen(mid), other: mid, segMid: mid });
        }
      }
    }
    return list;
  }, [selection, board.objects, routes, toScreen]);

  // Fit the board whenever a different board is opened.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      fitView(el.clientWidth, el.clientHeight);
    });
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id]);

  // Wheel: Ctrl/Cmd + wheel zooms, otherwise pans.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, factor);
      } else if (e.shiftKey) {
        panBy(-e.deltaY, 0);
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [panBy, zoomAt]);

  // Pinch zoom for touch devices.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startDist = 0;
    let startZoom = 1;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchingRef.current = true;
        startDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        startZoom = useStore.getState().camera.zoom;
        e.preventDefault();
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchingRef.current || startDist === 0) return;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const r = el.getBoundingClientRect();
      const mid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
      };
      const current = useStore.getState().camera.zoom;
      const target = startZoom * (dist / startDist);
      zoomAt(mid, target / current);
      e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchingRef.current = false;
        startDist = 0;
      }
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [zoomAt]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      const s = useStore.getState();
      if (s.presentation) {
        if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
          e.preventDefault();
          s.nextFrame(1);
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "Backspace") {
          e.preventDefault();
          s.nextFrame(-1);
          return;
        }
        if (e.key === "Escape") {
          s.stopPresentation();
          return;
        }
      }
      if (e.code === "Space") {
        spaceRef.current = true;
        e.preventDefault();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        s.deleteSelection();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        s.undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        s.duplicateSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        s.selectAll();
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.setSearchOpen(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "g" && !e.shiftKey) {
        e.preventDefault();
        s.groupSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "g" && e.shiftKey) {
        e.preventDefault();
        s.ungroupSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void s.persistNow();
        return;
      }
      if (e.key === "Escape") {
        if (s.presentation) s.stopPresentation();
        else if (s.searchOpen || s.helpOpen || s.templatesOpen || s.shareOpen) {
          s.setSearchOpen(false);
          s.setHelpOpen(false);
          s.setTemplatesOpen(false);
          s.setShareOpen(false);
        } else {
          s.setEditing(null);
          s.setConnectFrom(null);
          s.openContextMenu(null);
          s.clearSelection();
        }
        return;
      }
      if (e.key.startsWith("Arrow")) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (dx || dy) {
          e.preventDefault();
          s.nudgeSelection(dx, dy);
        }
        return;
      }
      if (e.key === "Tab" && s.selection.length === 1) {
        const o = s.board.objects[s.selection[0]];
        if (o && o.objectType === "shape") {
          e.preventDefault();
          const id = s.addMindChild(o.id);
          if (id) s.setEditing(id);
        }
        return;
      }
      if (e.key === "Enter" && s.selection.length === 1) {
        const o = s.board.objects[s.selection[0]];
        if (o && o.objectType === "shape") {
          e.preventDefault();
          const id = s.addMindSibling(o.id);
          if (id) s.setEditing(id);
          return;
        }
        if (o && (o.objectType === "text" || o.objectType === "frame")) {
          s.setEditing(o.id);
        }
        return;
      }
      if (e.key === "F2" && s.selection.length === 1) {
        const o = s.board.objects[s.selection[0]];
        if (o && (o.objectType === "shape" || o.objectType === "text" || o.objectType === "frame")) {
          e.preventDefault();
          s.setEditing(o.id);
        }
        return;
      }
      if (e.key === "?") {
        s.setHelpOpen(true);
        return;
      }
      if (e.key === "0") {
        const c = containerRef.current;
        s.fitView(c?.clientWidth || window.innerWidth, c?.clientHeight || window.innerHeight);
        return;
      }
      if (e.key === "1") {
        const c = containerRef.current;
        const w = c?.clientWidth || window.innerWidth;
        const h = c?.clientHeight || window.innerHeight;
        s.zoomAt({ x: w / 2, y: h / 2 }, 1 / s.camera.zoom);
        return;
      }
      if (!mod && !e.altKey && e.key.length === 1) {
        const key = e.key.toLowerCase();
        const map: Record<string, string> = {
          v: "select",
          h: "pan",
          r: "shape:rect",
          o: "shape:ellipse",
          d: "shape:diamond",
          t: "text",
          f: "frame",
          c: "connect",
          p: "shape:pill",
          s: "shape:sticky",
          i: "image",
          l: "lock",
        };
        if (key === "l") {
          s.toggleLocked();
          return;
        }
        if (map[key]) s.setTool(map[key] as never);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || !!el?.isContentEditable;
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target) || document.querySelector(".modal-backdrop")) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (detectMermaidKind(text) || looksLikeOutline(text)) {
        e.preventDefault();
        void useStore.getState().importMermaid(text);
        return;
      }
      if (text.startsWith(INTERNAL_CLIPBOARD_PREFIX)) {
        e.preventDefault();
        useStore.getState().paste();
        return;
      }
      if (!text && hasClipboard()) {
        e.preventDefault();
        useStore.getState().paste();
      }
    };
    const onCopy = (e: ClipboardEvent) => {
      if (isEditable(e.target) || document.querySelector(".modal-backdrop")) return;
      const s = useStore.getState();
      if (!s.selection.length) return;
      e.preventDefault();
      s.copySelection();
      e.clipboardData?.setData("text/plain", `${INTERNAL_CLIPBOARD_PREFIX}${s.selection.length} objeto(s)`);
    };
    const onCut = (e: ClipboardEvent) => {
      if (isEditable(e.target) || document.querySelector(".modal-backdrop")) return;
      const s = useStore.getState();
      if (!s.selection.length) return;
      e.preventDefault();
      s.cutSelection();
      e.clipboardData?.setData("text/plain", `${INTERNAL_CLIPBOARD_PREFIX}${s.selection.length} objeto(s)`);
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCut);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCut);
    };
  }, []);

  const beginPan = (e: React.PointerEvent) => {
    inter.current = {
      mode: "pan",
      startWorld: toWorld(e.clientX, e.clientY),
      lastWorld: toWorld(e.clientX, e.clientY),
      startScreen: { x: e.clientX, y: e.clientY },
      panStart: { x: camera.x, y: camera.y },
      handle: -1,
      startRects: {},
      startBounds: { x: 0, y: 0, w: 0, h: 0 },
      ids: [],
      historyPushed: false,
      moved: false,
      movingFrame: false,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2 || pinchingRef.current) return;
    if (editingId) setEditing(null);
    closeContextMenu(null);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const target = e.target as Element;
    const objectId = target.closest?.("[data-object-id]")?.getAttribute("data-object-id") ?? null;
    const connectorId = target.closest?.("[data-connector-id]")?.getAttribute("data-connector-id") ?? null;

    if (e.button === 1 || spaceRef.current || tool === "pan") {
      beginPan(e);
      return;
    }

    if (connectorId) {
      const c = board.objects[connectorId];
      if ((e.ctrlKey || e.metaKey) && c?.link) {
        window.open(c.link, "_blank", "noopener,noreferrer");
        return;
      }
      select(connectorId, e.shiftKey);
      inter.current = null;
      return;
    }

    if (objectId) {
      const obj = board.objects[objectId];
      if (!obj) return;
      if ((e.ctrlKey || e.metaKey) && obj.link) {
        window.open(obj.link, "_blank", "noopener,noreferrer");
        return;
      }
      if (tool === "connect" && obj.objectType !== "connector" && "rect" in obj) {
        if (!connectFrom) setConnectFrom(objectId);
        else if (connectFrom !== objectId) {
          addConnector(connectFrom, objectId);
          setConnectFrom(null);
        }
        return;
      }
      if (obj.locked) {
        select(objectId, e.shiftKey);
        return;
      }
      if (e.shiftKey) {
        select(objectId, true);
        return;
      }
      if (!selection.includes(objectId)) select(objectId, false);
      const currentSelection = useStore.getState().selection;
      const ids = collectMoveIds(board, currentSelection);
      if (!ids.length) return;
      const startRects: Record<string, Rect> = {};
      for (const id of ids) {
        const o = board.objects[id];
        if (o && "rect" in o && o.rect) startRects[id] = { ...o.rect };
      }
      inter.current = {
        mode: "drag",
        startWorld: toWorld(e.clientX, e.clientY),
        lastWorld: toWorld(e.clientX, e.clientY),
        startScreen: { x: e.clientX, y: e.clientY },
        panStart: { x: camera.x, y: camera.y },
        handle: -1,
        startRects,
        startBounds: boundsOf(Object.values(startRects).map((r) => aabbOfRect(r))),
        ids,
        historyPushed: false,
        moved: false,
        movingFrame: ids.some((id) => board.objects[id]?.objectType === "frame"),
      };
      return;
    }

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
        startBounds: { x: startWorld.x, y: startWorld.y, w: 0, h: 0 },
        ids: [],
        historyPushed: false,
        moved: false,
        movingFrame: false,
      };
      setPreview({ x: startWorld.x, y: startWorld.y, w: 0, h: 0 });
      return;
    }
    if (tool === "text") {
      addText({ x: startWorld.x, y: startWorld.y - 12, w: 220, h: 36 });
      setTool("select");
      return;
    }
    if (tool === "image") {
      imagePointRef.current = startWorld;
      imageInputRef.current?.click();
      return;
    }

    if (!e.shiftKey) clearSelection();
    inter.current = {
      mode: "marquee",
      startWorld,
      lastWorld: startWorld,
      startScreen: { x: e.clientX, y: e.clientY },
      panStart: { x: camera.x, y: camera.y },
      handle: -1,
      startRects: {},
      startBounds: { x: startWorld.x, y: startWorld.y, w: 0, h: 0 },
      ids: [],
      historyPushed: false,
      moved: false,
      movingFrame: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const it = inter.current;
    if (!it) return;
    const world = toWorld(e.clientX, e.clientY);
    it.lastWorld = world;

    if (it.mode === "pan") {
      setCamera({
        x: it.panStart.x + (e.clientX - it.startScreen.x),
        y: it.panStart.y + (e.clientY - it.startScreen.y),
        zoom: camera.zoom,
      });
      return;
    }

    if (it.mode === "drag") {
      let dx = world.x - it.startWorld.x;
      let dy = world.y - it.startWorld.y;
      if (!it.moved && Math.hypot(dx, dy) * camera.zoom < 2) return;
      if (!it.historyPushed) {
        pushHistory();
        it.historyPushed = true;
      }
      it.moved = true;
      if (e.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      const moved: Rect = {
        x: it.startBounds.x + dx,
        y: it.startBounds.y + dy,
        w: it.startBounds.w,
        h: it.startBounds.h,
      };
      const exclude = new Set(it.ids);
      const others = rectObjects.filter((r) => !exclude.has(r.id)).map((r) => r.rect);
      const snap = computeSnap(moved, others, {
        zoom: camera.zoom,
        grid: settings.grid,
        snap: settings.snap,
      });
      const fx = dx + snap.dx;
      const fy = dy + snap.dy;
      const updates: Record<string, Rect> = {};
      for (const [id, r] of Object.entries(it.startRects)) {
        updates[id] = { x: r.x + fx, y: r.y + fy, w: r.w, h: r.h };
      }
      setRects(updates, false);
      setGuides(snap.guides);
      if (!it.movingFrame) {
        const f = frameUnder(board, world, exclude);
        setDropFrameId(f?.id ?? null);
      } else if (dropFrameId) {
        setDropFrameId(null);
      }
      return;
    }

    if (it.mode === "marquee") {
      setMarquee(normalizeRect(it.startWorld, world));
      return;
    }

    if (it.mode === "create") {
      setPreview(normalizeRect(it.startWorld, world));
      return;
    }

    if (it.mode === "resize") {
      const dx = world.x - it.startWorld.x;
      const dy = world.y - it.startWorld.y;
      const b = it.startBounds;
      let { x, y, w, h } = b;
      const hd = it.handle;
      if (hd === 0 || hd === 3 || hd === 5) {
        x = b.x + dx;
        w = b.w - dx;
      }
      if (hd === 2 || hd === 4 || hd === 7) w = b.w + dx;
      if (hd === 0 || hd === 1 || hd === 2) {
        y = b.y + dy;
        h = b.h - dy;
      }
      if (hd === 5 || hd === 6 || hd === 7) h = b.h + dy;
      w = Math.max(24, w);
      h = Math.max(24, h);
      if (hd === 0 || hd === 3 || hd === 5) x = b.x + b.w - w;
      if (hd === 0 || hd === 1 || hd === 2) y = b.y + b.h - h;
      if (!it.historyPushed) {
        pushHistory();
        it.historyPushed = true;
      }
      it.moved = true;
      const sx = b.w === 0 ? 1 : w / b.w;
      const sy = b.h === 0 ? 1 : h / b.h;
      const updates: Record<string, Rect> = {};
      for (const [id, r] of Object.entries(it.startRects)) {
        const o = board.objects[id];
        const rot = o?.rotation ?? 0;
        const a = aabbOfRect(r, rot);
        const cx = a.x + a.w / 2;
        const cy = a.y + a.h / 2;
        const ncx = x + (cx - b.x) * sx;
        const ncy = y + (cy - b.y) * sy;
        const nw = Math.max(16, r.w * sx);
        const nh = Math.max(16, r.h * sy);
        updates[id] = { x: ncx - nw / 2, y: ncy - nh / 2, w: nw, h: nh };
      }
      setRects(updates, false);
      return;
    }

    if (it.mode === "link" && it.sourceId) {
      if (!it.moved && Math.hypot(world.x - it.startWorld.x, world.y - it.startWorld.y) * camera.zoom < 4) return;
      it.moved = true;
      const target = objectAt(board, world, 24, new Set([it.sourceId]));
      setLinkPreview({
        sourceId: it.sourceId,
        from: it.startWorld,
        to: world,
        targetId: target?.id ?? null,
      });
      return;
    }
  };

  const onPointerUp = () => {
    const it = inter.current;
    inter.current = null;
    setGuides([]);
    setDropFrameId(null);
    if (!it) return;

    if (it.mode === "marquee" && marquee) {
      const ids = objects
        .filter((o) => o.objectType !== "connector" && "rect" in o && o.rect && rectsIntersect(aabbOfRect(o.rect, o.rotation ?? 0), marquee))
        .map((o) => o.id);
      if (ids.length) selectMany([...new Set([...selection, ...ids])]);
      setMarquee(null);
      return;
    }

    if (it.mode === "create") {
      const p = preview;
      const w = Math.max(48, p?.w || (tool === "frame" ? 480 : tool === "shape:sticky" ? 220 : 192));
      const h = Math.max(40, p?.h || (tool === "frame" ? 360 : tool === "shape:sticky" ? 150 : 96));
      const rect = { x: p?.x ?? it.startWorld.x, y: p?.y ?? it.startWorld.y, w, h };
      if (tool === "frame") addFrame(rect);
      else if (tool.startsWith("shape:")) addShape(tool.replace("shape:", "") as Shape["shapeType"], rect);
      setPreview(null);
      return;
    }

    if (it.mode === "drag") {
      setGuides([]);
      if (it.historyPushed && !it.movingFrame) {
        const target = frameUnder(board, it.lastWorld, new Set(it.ids));
        reparentSelection(target?.id ?? null);
      }
      setDropFrameId(null);
      return;
    }

    if (it.mode === "link" && linkPreview) {
      if (!it.moved) {
        setLinkPreview(null);
        return;
      }
      const target = objectAt(board, it.lastWorld, 24, new Set([linkPreview.sourceId]));
      if (target) addConnector(linkPreview.sourceId, target.id);
      else createConnectedNode(linkPreview.sourceId, it.lastWorld);
      setLinkPreview(null);
      return;
    }
  };

  const startResize = (e: React.PointerEvent, handle: number) => {
    e.stopPropagation();
    const ids = collectMoveIds(board, selection);
    if (!ids.length) return;
    const startRects: Record<string, Rect> = {};
    for (const id of ids) {
      const o = board.objects[id];
      if (o && "rect" in o && o.rect) startRects[id] = { ...o.rect };
    }
    if (!Object.keys(startRects).length) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    inter.current = {
      mode: "resize",
      startWorld: toWorld(e.clientX, e.clientY),
      lastWorld: toWorld(e.clientX, e.clientY),
      startScreen: { x: e.clientX, y: e.clientY },
      panStart: { x: camera.x, y: camera.y },
      handle,
      startRects,
      startBounds: boundsOf(Object.values(startRects).map((r) => aabbOfRect(r))),
      ids,
      historyPushed: false,
      moved: false,
      movingFrame: false,
    };
  };

  const startLink = (e: React.PointerEvent, obj: Shape | Frame | TextObject | ImageObject | IconObject) => {
    e.stopPropagation();
    const r = aabbOfRect(obj.rect, obj.rotation ?? 0);
    const start = { x: r.x + r.w, y: r.y + r.h / 2 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    inter.current = {
      mode: "link",
      startWorld: start,
      lastWorld: start,
      startScreen: { x: e.clientX, y: e.clientY },
      panStart: { x: camera.x, y: camera.y },
      handle: -1,
      startRects: {},
      startBounds: r,
      ids: [obj.id],
      sourceId: obj.id,
      historyPushed: false,
      moved: false,
      movingFrame: false,
    };
    setLinkPreview({ sourceId: obj.id, from: start, to: start, targetId: null });
  };

  const startConnDrag = (e: React.PointerEvent, h: ConnHandle) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pushHistory();
    connDrag.current = {
      connId: h.connId,
      kind: h.kind,
      end: h.end,
      orientation: h.orientation,
      other: h.other,
      segMid: h.segMid,
    };
  };

  const onConnDragMove = (e: React.PointerEvent) => {
    const it = connDrag.current;
    if (!it) return;
    const world = toWorld(e.clientX, e.clientY);
    if (it.kind === "from" || it.kind === "to") {
      const target = objectAt(board, world, 26);
      if (target && target.objectType !== "connector" && "rect" in target) {
        const rel = snapAnchor(aabbOfRect(target.rect, target.rotation ?? 0), it.other);
        setConnectorEndpoint(it.connId, it.kind, { shapeId: target.id, rel, point: null });
      } else {
        setConnectorEndpoint(it.connId, it.kind, { point: world });
      }
    } else if (it.orientation === "h") {
      setConnectorBend(it.connId, { x: it.segMid.x, y: world.y }, false);
    } else {
      setConnectorBend(it.connId, { x: world.x, y: it.segMid.y }, false);
    }
  };

  const onConnDragEnd = () => {
    connDrag.current = null;
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = e.target as Element;
    const objectId = el.closest?.("[data-object-id]")?.getAttribute("data-object-id") ?? null;
    const connectorId = el.closest?.("[data-connector-id]")?.getAttribute("data-connector-id") ?? null;
    const id = objectId ?? connectorId;
    if (id) {
      select(id, false);
      openContextMenu(null);
    } else {
      const r = containerRef.current?.getBoundingClientRect();
      openContextMenu({
        x: e.clientX - (r?.left ?? 0),
        y: e.clientY - (r?.top ?? 0),
        objectId: null,
      });
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const objectId = (e.target as Element).closest?.("[data-object-id]")?.getAttribute("data-object-id");
    const connectorId = (e.target as Element).closest?.("[data-connector-id]")?.getAttribute("data-connector-id");
    closeContextMenu(null);
    if (objectId) {
      const o = board.objects[objectId];
      if (o && (o.objectType === "shape" || o.objectType === "text" || o.objectType === "frame")) {
        select(objectId, false);
        setEditing(objectId);
      }
    } else if (connectorId) {
      select(connectorId, false);
      if (!board.mindMap) setEditing(connectorId);
    } else {
      const world = toWorld(e.clientX, e.clientY);
      addText({ x: world.x, y: world.y - 12, w: 220, h: 36 });
    }
  };

  const onImageChosen = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const p = imagePointRef.current;
      addImage({ x: p.x, y: p.y, w: 360, h: 220 }, String(reader.result), file.name);
      setTool("select");
    };
    reader.readAsDataURL(file);
  };

  const cursor =
    tool === "pan" ? "grab" : tool.startsWith("shape:") || tool === "frame" || tool === "text" ? "crosshair" : "default";

  return (
    <div ref={containerRef} className="canvas-container" data-presentation={presentation ? "true" : undefined}>
      <svg
        ref={svgRef}
        className="board-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        style={{ cursor }}
      >
        <defs>
          <pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={1} fill={settings.theme === "dark" ? "#2d3946" : "#dbe2e9"} />
          </pattern>
        </defs>
        <rect data-export-ignore="true" x={0} y={0} width="100%" height="100%" className="canvas-bg" />
        {settings.grid ? (
          <rect data-export-ignore="true" x={0} y={0} width="100%" height="100%" fill="url(#grid)" opacity={0.9} />
        ) : null}
        <g data-board-content="true" transform={`translate(${camera.x},${camera.y}) scale(${camera.zoom})`}>
          {frames.map((o) => {
            const c = rectCenter(o.rect);
            return (
              <g
                key={o.id}
                data-object-id={o.id}
                transform={`rotate(${o.rotation ?? 0} ${c.x} ${c.y})`}
                style={{ cursor: o.locked ? "default" : tool === "connect" ? "crosshair" : "move" }}
              >
                <FrameView frame={o} selected={selection.includes(o.id) && editingId !== o.id} />
              </g>
            );
          })}
          {contentObjects.map((o) => {
            const c = rectCenter((o as Shape).rect);
            return (
              <g
                key={o.id}
                data-object-id={o.id}
                transform={`rotate(${o.rotation ?? 0} ${c.x} ${c.y})`}
                style={{ cursor: o.locked ? "default" : tool === "connect" ? "crosshair" : "move" }}
              >
                {isShape(o) ? <ShapeNode shape={o} selected={selection.includes(o.id) && editingId !== o.id} /> : null}
                {isText(o) ? <TextView text={o} selected={selection.includes(o.id) && editingId !== o.id} /> : null}
                {isImage(o) ? <ImageNode image={o} selected={selection.includes(o.id) && editingId !== o.id} /> : null}
                {isIcon(o) ? <IconNode icon={o} selected={selection.includes(o.id) && editingId !== o.id} /> : null}
              </g>
            );
          })}
          {connectors.map((c) => {
            const route = routes.get(c.id);
            if (!route) return null;
            return (
              <ConnectorView
                key={c.id}
                connector={c}
                route={route}
                selected={selection.includes(c.id) && editingId !== c.id}
              />
            );
          })}
          {mindControls.map((control) => (
            <g
              key={`mind-${control.id}`}
              className={`mind-toggle${control.collapsed ? " collapsed" : ""}`}
              data-export-ignore="true"
              style={{ cursor: "pointer" }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                toggleMindCollapse(control.id);
              }}
            >
              <title>{`${control.count} item${control.count === 1 ? "" : "s"} — clique para ${control.collapsed ? "expandir" : "recolher"}`}</title>
              <circle
                cx={control.cx}
                cy={control.cy}
                r={control.collapsed ? 7.5 : 4.5}
                fill={control.collapsed ? control.color : "var(--canvas-bg)"}
                stroke={control.color}
                strokeWidth={control.collapsed ? 0 : 1.5}
              />
              {control.collapsed ? (
                <text
                  x={control.cx}
                  y={control.cy + 3}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={700}
                  fill="#ffffff"
                  pointerEvents="none"
                >
                  {control.count > 99 ? "99+" : control.count}
                </text>
              ) : null}
              <circle cx={control.cx} cy={control.cy} r={15} fill="transparent" />
            </g>
          ))}
          {dropFrameId ? (
            (() => {
              const f = board.objects[dropFrameId];
              if (!f || f.objectType !== "frame") return null;
              const r = aabbOfRect(f.rect, f.rotation ?? 0);
              return (
                <rect
                  data-export-ignore="true"
                  x={r.x - 4}
                  y={r.y - 4}
                  width={r.w + 8}
                  height={r.h + 8}
                  rx={6}
                  fill="rgba(139,63,217,.08)"
                  stroke="#8b3fd9"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  pointerEvents="none"
                />
              );
            })()
          ) : null}
          {selBounds && selection.length > 1 && !editingId ? (
            <rect
              data-export-ignore="true"
              x={selBounds.x - 6}
              y={selBounds.y - 6}
              width={selBounds.w + 12}
              height={selBounds.h + 12}
              rx={8}
              fill="none"
              stroke="#8b3fd9"
              strokeWidth={1}
              strokeDasharray="5 4"
              opacity={0.65}
              pointerEvents="none"
            />
          ) : null}
          {preview ? (
            <rect
              data-export-ignore="true"
              x={preview.x}
              y={preview.y}
              width={preview.w}
              height={preview.h}
              rx={4}
              fill="rgba(139,63,217,0.08)"
              stroke="#8b3fd9"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          ) : null}
          {marquee ? (
            <rect
              data-export-ignore="true"
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.h}
              fill="rgba(47,123,212,0.10)"
              stroke="#2f7bd4"
              strokeWidth={1}
              pointerEvents="none"
            />
          ) : null}
          {guides.map((g, i) =>
            g.orientation === "v" ? (
              <line
                key={i}
                data-export-ignore="true"
                x1={g.pos}
                y1={-20000}
                x2={g.pos}
                y2={20000}
                stroke="#e0245e"
                strokeWidth={1 / camera.zoom}
                pointerEvents="none"
              />
            ) : (
              <line
                key={i}
                data-export-ignore="true"
                x1={-20000}
                y1={g.pos}
                x2={20000}
                y2={g.pos}
                stroke="#e0245e"
                strokeWidth={1 / camera.zoom}
                pointerEvents="none"
              />
            ),
          )}
          {linkPreview ? (
            <g data-export-ignore="true">
              <line
                x1={linkPreview.from.x}
                y1={linkPreview.from.y}
                x2={linkPreview.to.x}
                y2={linkPreview.to.y}
                stroke="#8b3fd9"
                strokeWidth={2}
                strokeDasharray="6 5"
                pointerEvents="none"
              />
              <circle cx={linkPreview.to.x} cy={linkPreview.to.y} r={5} fill="#8b3fd9" pointerEvents="none" />
            </g>
          ) : null}
        </g>
      </svg>

      {selBounds && !presentation && !editingId && !board.mindMap ? (
        <ResizeHandles
          bounds={selBounds}
          toScreen={toScreen}
          onStart={startResize}
          onMove={onPointerMove}
          onUp={onPointerUp}
        />
      ) : null}

      {singleRect && !singleRect.locked && !singleRect.hidden && !presentation && !editingId ? (
        board.mindMap ? (
          <button
            className="mind-add"
            title="Criar novo ramo"
            style={(() => {
              const r = aabbOfRect(singleRect.rect, singleRect.rotation ?? 0);
              const p = toScreen({ x: r.x + r.w / 2 + 26, y: r.y + r.h + 14 });
              return { left: p.x - 11, top: p.y - 11 };
            })()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              const id = addMindChild(singleRect.id);
              if (id) setEditing(id);
            }}
          >
            <Icon name="branch" size={14} />
          </button>
        ) : (
          <>
            <LinkHandle
              rect={singleRect as Shape | Frame | TextObject | ImageObject | IconObject}
              toScreen={toScreen}
              onStart={startLink}
              onMove={onPointerMove}
              onUp={onPointerUp}
            />
            <button
              className="quick-add"
              title="Adicionar forma à direita"
              style={(() => {
                const r = aabbOfRect(singleRect.rect, singleRect.rotation ?? 0);
                const p = toScreen({ x: r.x + r.w + 18, y: r.y + r.h / 2 });
                return { left: p.x - 13, top: p.y - 13 };
              })()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => quickAdd(singleRect.id, "right")}
            >
              <Icon name="plus" size={15} />
            </button>
            <button
              className="quick-add bottom"
              title="Adicionar forma abaixo"
              style={(() => {
                const r = aabbOfRect(singleRect.rect, singleRect.rotation ?? 0);
                const p = toScreen({ x: r.x + r.w / 2, y: r.y + r.h + 2 });
                return { left: p.x - 13, top: p.y - 13 };
              })()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => quickAdd(singleRect.id, "down")}
            >
              <Icon name="plus" size={15} />
            </button>
          </>
        )
      ) : null}

      {!presentation && camera.zoom > 0.45
        ? connHandles.map((h, i) => (
            <div
              key={`${h.connId}-${h.kind}-${i}`}
              className={`conn-handle ${h.kind}`}
              style={{ left: h.screen.x - 5, top: h.screen.y - 5 }}
              onPointerDown={(e) => startConnDrag(e, h)}
              onPointerMove={onConnDragMove}
              onPointerUp={onConnDragEnd}
              onPointerCancel={onConnDragEnd}
            />
          ))
        : null}

      {editTarget && editTarget.objectType !== "connector" && "text" in editTarget ? (
        <TextEditor
          key={editTarget.id}
          object={editTarget as Shape | Frame | TextObject}
          zoom={camera.zoom}
          toScreen={toScreen}
        />
      ) : null}
      {editTarget && editTarget.objectType === "connector" && !board.mindMap ? (
        (() => {
          const route = routes.get(editTarget.id);
          return route ? (
            <ConnectorLabelEditor
              connector={editTarget as Connector}
              route={route}
              zoom={camera.zoom}
              toScreen={toScreen}
            />
          ) : null;
        })()
      ) : null}

      {connectFrom ? <div className="connect-hint">Clique no destino para conectar — Esc para cancelar</div> : null}

      {!presentation && !editingId && !board.mindMap ? <ContextBar /> : null}
      {!presentation && !editingId ? <MindColorBar /> : null}
      {!presentation ? <ContextMenu /> : null}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImageChosen(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ResizeHandles({
  bounds,
  toScreen,
  onStart,
  onMove,
  onUp,
}: {
  bounds: Rect;
  toScreen: (p: Vec) => Vec;
  onStart: (e: React.PointerEvent, handle: number) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: (e: React.PointerEvent) => void;
}) {
  const size = 9;
  return (
    <>
      {HANDLES.map(([fx, fy], i) => {
        const p = toScreen({ x: bounds.x + bounds.w * fx, y: bounds.y + bounds.h * fy });
        return (
          <div
            key={i}
            className={`resize-handle ${HANDLE_CLASS[i]}`}
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

function LinkHandle({
  rect: obj,
  toScreen,
  onStart,
  onMove,
  onUp,
}: {
  rect: Shape | Frame | TextObject | ImageObject | IconObject;
  toScreen: (p: Vec) => Vec;
  onStart: (e: React.PointerEvent, obj: Shape | Frame | TextObject | ImageObject | IconObject) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: (e: React.PointerEvent) => void;
}) {
  const r = aabbOfRect(obj.rect, obj.rotation ?? 0);
  const p = toScreen({ x: r.x + r.w, y: r.y + r.h / 2 });
  return (
    <div
      className="link-handle"
      title="Arraste para conectar"
      style={{ left: p.x - 6, top: p.y - 6 }}
      onPointerDown={(e) => onStart(e, obj)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
