import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  Board,
  BoardObject,
  Color,
  Connector,
  ConnectorType,
  Deco,
  EndpointMarker,
  Frame,
  Rect,
  RelativeAnchor,
  Shape,
  ShapeType,
  TextObject,
  Tool,
  Vec,
} from "./types";

export interface ConnectorDefaults {
  color: Color;
  deco: Deco;
  connectorType: ConnectorType;
  fromEndpoint: EndpointMarker;
  toEndpoint: EndpointMarker;
}
import { boundsOf, snapAnchor } from "./geometry";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardState {
  board: Board;
  selection: string[];
  camera: Camera;
  tool: Tool;
  editingId: string | null;
  connectFrom: string | null;
  contextBarFor: string | null;
  past: Board[];
  future: Board[];
  dirty: number;
  defaultConnector: ConnectorDefaults;

  setTool: (t: Tool) => void;
  setEditing: (id: string | null) => void;
  setConnectFrom: (id: string | null) => void;
  openContextBar: (id: string) => void;
  closeContextBar: () => void;

  select: (id: string | null, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;

  setCamera: (c: Camera) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (screen: Vec, factor: number) => void;

  addShape: (shapeType: ShapeType, rect: Rect) => string;
  addText: (rect: Rect) => string;
  addFrame: (rect: Rect) => string;
  addConnector: (fromId: string, toId: string, type?: ConnectorType) => string | null;

  updateObject: (id: string, patch: Partial<BoardObject>, history?: boolean) => void;
  updateRect: (id: string, rect: Rect, history?: boolean) => void;
  setRects: (updates: Record<string, Rect>, history?: boolean) => void;
  moveSelection: (dx: number, dy: number, history?: boolean) => void;
  setStyle: (id: string, patch: { color?: Color; deco?: Deco; hex?: string }) => void;
  setText: (id: string, text: string) => void;
  rotateSelection: () => void;
  swapEndpoints: (id: string) => void;
  applyConnectorDefaults: (id: string) => void;
  setConnectorEndpoint: (
    id: string,
    end: "from" | "to",
    patch: { shapeId?: string; rel?: RelativeAnchor; point?: Vec | null },
  ) => void;
  setConnectorBend: (id: string, bend: Vec | null, history?: boolean) => void;

  deleteSelection: () => void;
  duplicateSelection: () => void;
  bringToFront: () => void;
  sendToBack: () => void;

  copySelection: () => void;
  cutSelection: () => void;
  paste: () => void;
  selectAll: () => void;
  alignSelection: (edge: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  distributeSelection: (axis: "h" | "v") => void;
  autoLayout: () => void;
  fitView: (w: number, h: number) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadBoard: (b: Board) => void;
  newBoard: () => void;
}

const DEFAULT_RECT: Rect = { x: 0, y: 0, w: 192, h: 96 };

function emptyBoard(): Board {
  return {
    id: nanoid(),
    title: "Board sem título",
    fontFamily: "Dinsical",
    objects: {},
  };
}

let orderCounter = 1;

let clipboard: BoardObject[] = [];

const STORAGE_KEY = "whim.board.v1";

export function loadPersistedBoard(): Board | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as Board;
    if (b && b.objects && typeof b.objects === "object") return b;
  } catch {
    /* ignore */
  }
  return null;
}

export function persistBoard(b: Board) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

export function clearPersistedBoard() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function withOrder<T extends BoardObject>(o: T): T {
  return { ...o, order: orderCounter++ };
}

function cloneBoard(b: Board): Board {
  return {
    ...b,
    objects: Object.fromEntries(
      Object.entries(b.objects).map(([k, v]) => [
        k,
        { ...v, ...(("rect" in v && v.rect) ? { rect: { ...v.rect } } : {}) },
      ]),
    ),
  };
}

export const useStore = create<BoardState>((set, get) => {
  const commit = (next: Board) => {
    const { board, past } = get();
    set({
      board: next,
      past: [...past.slice(-49), board],
      future: [],
      dirty: get().dirty + 1,
    });
  };

  return {
    board: emptyBoard(),
    selection: [],
    camera: { x: 0, y: 0, zoom: 1 },
    tool: "select",
    editingId: null,
    connectFrom: null,
    contextBarFor: null,
    past: [],
    future: [],
    dirty: 0,
    defaultConnector: { color: "gray", deco: "outline", connectorType: "elbow", fromEndpoint: "none", toEndpoint: "arrow" },

    setTool: (t) => set({ tool: t, connectFrom: null }),
    setEditing: (id) => set({ editingId: id }),
    setConnectFrom: (id) => set({ connectFrom: id }),
    openContextBar: (id) => set({ contextBarFor: id, selection: [id] }),
    closeContextBar: () => set({ contextBarFor: null }),

    select: (id, additive) => {
      if (id === null) return set({ selection: [] });
      const cur = get().selection;
      if (additive) {
        set({ selection: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      } else {
        set({ selection: [id] });
      }
    },
    selectMany: (ids) => set({ selection: ids }),
    clearSelection: () => set({ selection: [], editingId: null, contextBarFor: null }),

    setCamera: (c) => set({ camera: c }),
    panBy: (dx, dy) => set((s) => ({ camera: { ...s.camera, x: s.camera.x + dx, y: s.camera.y + dy } })),
    zoomAt: (screen, factor) => {
      const { camera } = get();
      const zoom = Math.min(4, Math.max(0.1, camera.zoom * factor));
      const k = zoom / camera.zoom;
      const x = screen.x - (screen.x - camera.x) * k;
      const y = screen.y - (screen.y - camera.y) * k;
      set({ camera: { x, y, zoom } });
    },

    addShape: (shapeType, rect) => {
      const id = nanoid();
      const shape: Shape = withOrder({
        id,
        objectType: "shape",
        parentId: null,
        shapeType,
        rect,
        style: { color: "gray", deco: "outline" },
        text: "",
        order: 0,
      });
      const board = get().board;
      commit({ ...board, objects: { ...board.objects, [id]: shape } });
      set({ selection: [id], tool: "select" });
      return id;
    },

    addText: (rect) => {
      const id = nanoid();
      const t: TextObject = withOrder({
        id,
        objectType: "text",
        parentId: null,
        rect,
        style: { color: "gray", deco: "transparent" },
        text: "Texto",
        fontSize: 18,
        order: 0,
      });
      const board = get().board;
      commit({ ...board, objects: { ...board.objects, [id]: t } });
      set({ selection: [id], tool: "select", editingId: id });
      return id;
    },

    addFrame: (rect) => {
      const id = nanoid();
      const f: Frame = withOrder({
        id,
        objectType: "frame",
        parentId: null,
        rect,
        style: { color: "smoke", deco: "outline" },
        text: "Frame",
        order: 0,
      });
      const board = get().board;
      commit({ ...board, objects: { ...board.objects, [id]: f } });
      set({ selection: [id], tool: "select" });
      return id;
    },

    addConnector: (fromId, toId, type = "elbow") => {
      if (fromId === toId) return null;
      const board = get().board;
      const from = board.objects[fromId];
      const to = board.objects[toId];
      if (!from || !to) return null;
      const fromRect = (from as Shape).rect;
      const toRect = (to as Shape).rect;
      const fromCenter = { x: fromRect.x + fromRect.w / 2, y: fromRect.y + fromRect.h / 2 };
      const toCenter = { x: toRect.x + toRect.w / 2, y: toRect.y + toRect.h / 2 };
      const rel = snapAnchor(fromRect, toCenter);
      const toRel = snapAnchor(toRect, fromCenter);
      const id = nanoid();
      const dflt = get().defaultConnector;
      const conn: Connector = withOrder({
        id,
        objectType: "connector",
        parentId: null,
        fromId,
        toId,
        connectorType: type ?? dflt.connectorType,
        fromRel: rel,
        toRel,
        fromEndpoint: dflt.fromEndpoint,
        toEndpoint: dflt.toEndpoint,
        fromCardinality: null,
        toCardinality: null,
        style: { color: dflt.color, deco: dflt.deco },
        label: "",
        order: 0,
      });
      commit({ ...board, objects: { ...board.objects, [id]: conn } });
      set({ selection: [id] });
      return id;
    },

    updateObject: (id, patch, history = true) => {
      const board = get().board;
      const obj = board.objects[id];
      if (!obj) return;
      const next: Board = {
        ...board,
        objects: { ...board.objects, [id]: { ...obj, ...patch } as BoardObject },
      };
      if (history) commit(next);
      else set({ board: next, dirty: get().dirty + 1 });
    },

    updateRect: (id, rect, history = true) => {
      get().updateObject(id, { rect } as Partial<BoardObject>, history);
    },

    setRects: (updates, history = false) => {
      const board = get().board;
      const objects = { ...board.objects };
      for (const [id, rect] of Object.entries(updates)) {
        const o = objects[id];
        if (o && "rect" in o && o.rect) objects[id] = { ...o, rect } as BoardObject;
      }
      const next = { ...board, objects };
      if (history) commit(next);
      else set({ board: next, dirty: get().dirty + 1 });
    },

    moveSelection: (dx, dy, history = false) => {
      const { board, selection } = get();
      if (selection.length === 0) return;
      const objects = { ...board.objects };
      for (const id of selection) {
        const o = objects[id];
        if (!o || !("rect" in o) || !o.rect) continue;
        objects[id] = { ...o, rect: { ...o.rect, x: o.rect.x + dx, y: o.rect.y + dy } } as BoardObject;
      }
      const next = { ...board, objects };
      if (history) commit(next);
      else set({ board: next, dirty: get().dirty + 1 });
    },

    setStyle: (id, patch) => {
      const o = get().board.objects[id];
      if (!o || !("style" in o)) return;
      get().updateObject(id, { style: { ...(o as Shape).style, ...patch } } as Partial<BoardObject>);
    },

    setText: (id, text) => {
      get().updateObject(id, { text } as Partial<BoardObject>, false);
    },

    rotateSelection: () => {
      const { board, selection } = get();
      const objects = { ...board.objects };
      for (const id of selection) {
        const o = objects[id];
        if (!o || !("rect" in o) || !o.rect) continue;
        const r = o.rect;
        objects[id] = {
          ...o,
          rect: { x: r.x + (r.w - r.h) / 2, y: r.y + (r.h - r.w) / 2, w: r.h, h: r.w },
        } as BoardObject;
      }
      commit({ ...board, objects });
    },

    swapEndpoints: (id) => {
      const o = get().board.objects[id];
      if (!o || o.objectType !== "connector") return;
      get().updateObject(id, {
        fromId: o.toId,
        toId: o.fromId,
        fromRel: o.toRel,
        toRel: o.fromRel,
        fromEndpoint: o.toEndpoint,
        toEndpoint: o.fromEndpoint,
        fromCardinality: o.toCardinality,
        toCardinality: o.fromCardinality,
      } as Partial<BoardObject>);
    },

    setConnectorEndpoint: (id, end, patch) => {
      const o = get().board.objects[id];
      if (!o || o.objectType !== "connector") return;
      const upd: Partial<Connector> = {};
      if (end === "from") {
        if (patch.shapeId !== undefined) upd.fromId = patch.shapeId;
        if (patch.rel !== undefined) upd.fromRel = patch.rel;
        if (patch.point !== undefined) upd.fromPoint = patch.point;
      } else {
        if (patch.shapeId !== undefined) upd.toId = patch.shapeId;
        if (patch.rel !== undefined) upd.toRel = patch.rel;
        if (patch.point !== undefined) upd.toPoint = patch.point;
      }
      get().updateObject(id, upd as Partial<BoardObject>, false);
    },

    setConnectorBend: (id, bend, history = false) => {
      get().updateObject(id, { bend } as Partial<BoardObject>, history);
    },

    applyConnectorDefaults: (id) => {
      const o = get().board.objects[id];
      if (!o || o.objectType !== "connector") return;
      set({
        defaultConnector: {
          color: o.style.color,
          deco: o.style.deco,
          connectorType: o.connectorType,
          fromEndpoint: o.fromEndpoint,
          toEndpoint: o.toEndpoint,
        },
      });
    },

    deleteSelection: () => {
      const { board, selection } = get();
      if (selection.length === 0) return;
      const objects = { ...board.objects };
      const sel = new Set(selection);
      for (const id of selection) delete objects[id];
      // remove connectors attached to deleted objects
      for (const [id, o] of Object.entries(objects)) {
        if (o.objectType === "connector" && (sel.has(o.fromId) || sel.has(o.toId))) delete objects[id];
      }
      commit({ ...board, objects });
      set({ selection: [], editingId: null, contextBarFor: null });
    },

    duplicateSelection: () => {
      const { board, selection } = get();
      if (selection.length === 0) return;
      const objects = { ...board.objects };
      const map: Record<string, string> = {};
      const newIds: string[] = [];
      for (const id of selection) {
        const o = objects[id];
        if (!o || !("rect" in o) || !o.rect) continue;
        const nid = nanoid();
        map[id] = nid;
        objects[nid] = withOrder({ ...o, id: nid, rect: { ...o.rect, x: o.rect.x + 32, y: o.rect.y + 32 } } as BoardObject);
        newIds.push(nid);
      }
      commit({ ...board, objects });
      set({ selection: newIds });
    },

    bringToFront: () => {
      const { board, selection } = get();
      const objects = { ...board.objects };
      for (const id of selection) {
        if (objects[id]) objects[id] = withOrder({ ...objects[id] });
      }
      commit({ ...board, objects });
    },

    sendToBack: () => {
      const { board, selection } = get();
      const objects = { ...board.objects };
      for (const id of selection) {
        if (objects[id]) objects[id] = { ...objects[id], order: -orderCounter++ } as BoardObject;
      }
      commit({ ...board, objects });
    },

    copySelection: () => {
      const { board, selection } = get();
      const sel = new Set(selection);
      const objs: BoardObject[] = [];
      for (const id of selection) {
        const o = board.objects[id];
        if (o) objs.push(JSON.parse(JSON.stringify(o)) as BoardObject);
      }
      for (const o of Object.values(board.objects)) {
        if (o.objectType === "connector" && !sel.has(o.id) && sel.has(o.fromId) && sel.has(o.toId)) {
          objs.push(JSON.parse(JSON.stringify(o)) as BoardObject);
        }
      }
      clipboard = objs;
    },

    cutSelection: () => {
      get().copySelection();
      get().deleteSelection();
    },

    paste: () => {
      if (clipboard.length === 0) return;
      const board = get().board;
      const objects = { ...board.objects };
      const idMap: Record<string, string> = {};
      const newIds: string[] = [];
      const OFF = 32;
      for (const o of clipboard) {
        const nid = nanoid();
        idMap[o.id] = nid;
        const copy = JSON.parse(JSON.stringify(o)) as BoardObject;
        (copy as { id: string }).id = nid;
        if ("rect" in copy && copy.rect) {
          copy.rect = { ...copy.rect, x: copy.rect.x + OFF, y: copy.rect.y + OFF };
        }
        if (copy.objectType === "connector") {
          copy.fromId = idMap[copy.fromId] ?? copy.fromId;
          copy.toId = idMap[copy.toId] ?? copy.toId;
          if (copy.fromPoint) copy.fromPoint = { x: copy.fromPoint.x + OFF, y: copy.fromPoint.y + OFF };
          if (copy.toPoint) copy.toPoint = { x: copy.toPoint.x + OFF, y: copy.toPoint.y + OFF };
          if (copy.bend) copy.bend = { x: copy.bend.x + OFF, y: copy.bend.y + OFF };
        }
        objects[nid] = withOrder(copy);
        newIds.push(nid);
      }
      commit({ ...board, objects });
      set({ selection: newIds, contextBarFor: null });
    },

    selectAll: () => {
      const { board } = get();
      set({ selection: Object.keys(board.objects) });
    },

    alignSelection: (edge) => {
      const { board, selection } = get();
      const items = selection
        .map((id) => board.objects[id])
        .filter((o): o is Shape => !!o && "rect" in o && !!o.rect);
      if (items.length < 2) return;
      const bounds = boundsOf(items.map((o) => o.rect));
      const objects = { ...board.objects };
      for (const o of items) {
        const r = o.rect;
        let rect = r;
        if (edge === "left") rect = { ...r, x: bounds.x };
        else if (edge === "right") rect = { ...r, x: bounds.x + bounds.w - r.w };
        else if (edge === "center") rect = { ...r, x: bounds.x + bounds.w / 2 - r.w / 2 };
        else if (edge === "top") rect = { ...r, y: bounds.y };
        else if (edge === "bottom") rect = { ...r, y: bounds.y + bounds.h - r.h };
        else if (edge === "middle") rect = { ...r, y: bounds.y + bounds.h / 2 - r.h / 2 };
        objects[o.id] = { ...o, rect } as BoardObject;
      }
      commit({ ...board, objects });
    },

    distributeSelection: (axis) => {
      const { board, selection } = get();
      const items = selection
        .map((id) => board.objects[id])
        .filter((o): o is Shape => !!o && "rect" in o && !!o.rect);
      if (items.length < 3) return;
      items.sort((a, b) => (axis === "h" ? a.rect.x - b.rect.x : a.rect.y - b.rect.y));
      const bounds = boundsOf(items.map((o) => o.rect));
      const total = axis === "h" ? bounds.w : bounds.h;
      const sizes = items.reduce((acc, o) => acc + (axis === "h" ? o.rect.w : o.rect.h), 0);
      const gap = (total - sizes) / (items.length - 1);
      let cursor = axis === "h" ? bounds.x : bounds.y;
      const objects = { ...board.objects };
      for (const o of items) {
        const size = axis === "h" ? o.rect.w : o.rect.h;
        const rect = axis === "h" ? { ...o.rect, x: cursor } : { ...o.rect, y: cursor };
        objects[o.id] = { ...o, rect } as BoardObject;
        cursor += size + gap;
      }
      commit({ ...board, objects });
    },

    autoLayout: () => {
      const { board } = get();
      const shapes = Object.values(board.objects).filter((o): o is Shape => o.objectType === "shape");
      const conns = Object.values(board.objects).filter((o): o is Connector => o.objectType === "connector");
      if (shapes.length === 0) return;
      import("@dagrejs/dagre").then(({ default: dagre }) => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 110, marginx: 40, marginy: 40 });
        g.setDefaultEdgeLabel(() => ({}));
        for (const s of shapes) g.setNode(s.id, { width: s.rect.w, height: s.rect.h });
        for (const c of conns) {
          if (board.objects[c.fromId] && board.objects[c.toId]) g.setEdge(c.fromId, c.toId);
        }
        dagre.layout(g);
        const objects = { ...board.objects };
        for (const s of shapes) {
          const n = g.node(s.id);
          if (n) objects[s.id] = { ...s, rect: { ...s.rect, x: n.x - n.width / 2, y: n.y - n.height / 2 } } as BoardObject;
        }
        const ids = shapes.map((s) => s.id);
        const rects = ids.map((id) => (objects[id] as Shape).rect);
        const b = boundsOf(rects);
        const camera = { x: -b.x + 80, y: -b.y + 80, zoom: get().camera.zoom };
        commit({ ...board, objects });
        set({ camera });
      });
    },

    fitView: (w, h) => {
      const rects = Object.values(get().board.objects)
        .filter((o) => "rect" in o && o.rect)
        .map((o) => (o as Shape).rect);
      if (rects.length === 0) return;
      const b = boundsOf(rects);
      const pad = 60;
      const zoom = Math.min(1.5, Math.max(0.1, Math.min((w - pad * 2) / b.w, (h - pad * 2) / b.h)));
      const x = w / 2 - (b.x + b.w / 2) * zoom;
      const y = h / 2 - (b.y + b.h / 2) * zoom;
      set({ camera: { x, y, zoom } });
    },

    pushHistory: () => {
      const { board, past } = get();
      set({ past: [...past.slice(-49), board], future: [] });
    },

    undo: () => {
      const { past, future, board } = get();
      if (past.length === 0) return;
      const prev = past[past.length - 1];
      set({ board: prev, past: past.slice(0, -1), future: [board, ...future].slice(0, 50), selection: [], dirty: get().dirty + 1 });
    },

    redo: () => {
      const { past, future, board } = get();
      if (future.length === 0) return;
      const next = future[0];
      set({ board: next, future: future.slice(1), past: [...past, board], selection: [], dirty: get().dirty + 1 });
    },

    loadBoard: (b) => {
      orderCounter = Math.max(1, ...Object.values(b.objects).map((o) => o.order + 1));
      set({ board: b, past: [], future: [], selection: [], dirty: get().dirty + 1 });
    },

    newBoard: () => {
      orderCounter = 1;
      set({ board: emptyBoard(), past: [], future: [], selection: [], camera: { x: 0, y: 0, zoom: 1 } });
    },
  };
});

export { cloneBoard, emptyBoard, DEFAULT_RECT };
