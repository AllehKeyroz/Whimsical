import { nanoid } from "nanoid";
import type { BoardObject, Color, Connector, Rect, TextObject, Vec } from "../types";
import { DEFAULT_TEXT_STYLE } from "../types";
import { measure, wrapText } from "./text";

export interface OutlineEntry {
  label: string;
  depth: number;
}

interface OutlineNode {
  label: string;
  depth: number;
  children: OutlineNode[];
  color: Color;
  w: number;
  h: number;
  fs: number;
}

const BRANCH_COLORS: Color[] = ["purple", "blue", "orange", "green", "red", "indigo", "mint", "crimson", "yellow", "brown"];
const GAP_X = 100;
const GAP_Y = 6;
const MAX_TEXT_WIDTH = 260;

export function looksLikeOutline(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return false;
  let indented = 0;
  let bullets = 0;
  for (const line of lines) {
    if (/^[\t ]{2,}/.test(line)) indented++;
    if (/^[\t ]*[-*+•]\s+/.test(line)) bullets++;
  }
  return indented >= 2 || bullets >= Math.max(2, Math.floor(lines.length * 0.5));
}

export function parseOutline(text: string): OutlineEntry[] {
  const rows: { label: string; indent: number; bullet: boolean }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const leading = raw.match(/^[\t ]*/)?.[0] ?? "";
    const indent = leading.replace(/\t/g, "    ").length;
    const bullet = /^[\t ]*[-*+•]\s+/.test(raw);
    const label = raw
      .trim()
      .replace(/^[-*+•]\s+/, "")
      .trim();
    if (!label) continue;
    rows.push({ label: label.slice(0, 160), indent, bullet });
  }
  if (!rows.length) return [];

  const entries: OutlineEntry[] = [{ label: rows[0].label, depth: 0 }];
  const stack: { indent: number; bullet: boolean; depth: number }[] = [
    { indent: rows[0].indent, bullet: rows[0].bullet, depth: 0 },
  ];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Pop deeper items, and pop bullet siblings so they share the same parent.
    while (
      stack.length > 1 &&
      (stack[stack.length - 1].indent > row.indent ||
        (stack[stack.length - 1].indent === row.indent && stack[stack.length - 1].bullet))
    ) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    const depth = parent.depth + 1;
    entries.push({ label: row.label, depth });
    stack.push({ indent: row.indent, bullet: row.bullet, depth });
  }

  return entries;
}

function buildTree(entries: OutlineEntry[]): OutlineNode | null {
  if (!entries.length) return null;
  const root: OutlineNode = {
    label: entries[0].label,
    depth: 0,
    children: [],
    color: "white",
    w: 0,
    h: 0,
    fs: 18,
  };
  const stack: OutlineNode[] = [root];

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const node: OutlineNode = {
      label: entry.label,
      depth: entry.depth,
      children: [],
      color: "blue",
      w: 0,
      h: 0,
      fs: 15,
    };
    while (stack.length > 1 && stack[stack.length - 1].depth >= entry.depth) stack.pop();
    const parent = stack[stack.length - 1] ?? root;
    if (parent === root) {
      node.color = BRANCH_COLORS[root.children.length % BRANCH_COLORS.length];
    } else {
      node.color = parent.color;
    }
    parent.children.push(node);
    stack.push(node);
  }
  return root;
}

function measureNode(node: OutlineNode, isRoot: boolean): void {
  const fs = isRoot ? 20 : 15;
  node.fs = fs;
  const textWidth = measure(node.label || " ", fs, isRoot);
  node.w = Math.max(isRoot ? 120 : 56, Math.min(MAX_TEXT_WIDTH, textWidth + (isRoot ? 20 : 6)));
  const lines = wrapText(node.label || " ", node.w - 8, fs, { bold: isRoot });
  node.h = Math.max(isRoot ? 40 : 30, lines.length * fs * 1.333 + 8);
  for (const child of node.children) measureNode(child, false);
}

function subtreeHeight(node: OutlineNode): number {
  if (!node.children.length) return node.h;
  const total = node.children.reduce((sum, child) => sum + subtreeHeight(child), 0);
  return Math.max(node.h, total + GAP_Y * (node.children.length - 1));
}

export interface OutlineBuildResult {
  objects: BoardObject[];
  ids: string[];
  count: number;
}

export function buildOutlineMindMap(text: string, origin: Vec): OutlineBuildResult | null {
  const entries = parseOutline(text);
  const root = buildTree(entries);
  if (!root) return null;
  measureNode(root, true);

  const objects: BoardObject[] = [];
  const ids: string[] = [];
  const idByNode = new Map<OutlineNode, string>();
  const depthWidth = new Map<number, number>();
  for (const node of walk(root)) {
    const depth = node.depth;
    depthWidth.set(depth, Math.max(depthWidth.get(depth) ?? 0, node.w));
  }
  const colX = new Map<number, number>();
  colX.set(0, origin.x - root.w / 2);
  const maxDepth = Math.max(...[...depthWidth.keys()]);
  for (let d = 1; d <= maxDepth; d++) {
    colX.set(d, (colX.get(d - 1) ?? origin.x) + (depthWidth.get(d - 1) ?? 180) + GAP_X);
  }

  const totalHeight = subtreeHeight(root);
  const place = (node: OutlineNode, top: number): void => {
    const isRoot = node.depth === 0;
    const heightOwn = subtreeHeight(node);
    const centerY = top + heightOwn / 2;
    const rect = {
      x: colX.get(node.depth) ?? origin.x,
      y: centerY - node.h / 2,
      w: node.w,
      h: node.h,
    };
    const id = nanoid();
    idByNode.set(node, id);
    const text: TextObject = {
      id,
      objectType: "text",
      parentId: null,
      groupId: null,
      rect,
      style: isRoot
        ? { color: "white", deco: "fill", hex: "#ffffff" }
        : { color: node.color, deco: "transparent" },
      text: node.label,
      textStyle: {
        ...DEFAULT_TEXT_STYLE,
        fontSize: node.fs,
        fontWeight: isRoot ? 600 : 500,
        align: "center",
        color: isRoot ? "#293845" : undefined,
      },
      rotation: 0,
      order: 0,
      mindCollapsed: false,
      mindRoot: isRoot,
      mindNode: true,
    };
    objects.push(text);
    ids.push(id);

    let cursor = top;
    for (const child of node.children) {
      const childHeight = subtreeHeight(child);
      place(child, cursor);
      cursor += childHeight + GAP_Y;
    }
  };

  place(root, origin.y - totalHeight / 2);

  for (const node of walk(root)) {
    const parentId = idByNode.get(node);
    if (!parentId) continue;
    for (const child of node.children) {
      const childId = idByNode.get(child);
      if (!childId) continue;
      const color = node.depth === 0 ? child.color : node.color;
      const connector: Connector = {
        id: nanoid(),
        objectType: "connector",
        parentId: null,
        groupId: null,
        fromId: parentId,
        toId: childId,
        connectorType: "curved",
        fromRel: { rx: 1, ry: 0.5, axis: "x" },
        toRel: { rx: 0, ry: 0.5, axis: "x" },
        fromEndpoint: "none",
        toEndpoint: "none",
        fromCardinality: null,
        toCardinality: null,
        style: { color, deco: "outline" },
        label: "",
        order: 0,
        mind: true,
      };
      objects.push(connector);
      ids.push(connector.id);
    }
  }

  return { objects, ids, count: entries.length };
}

function* walk(node: OutlineNode): Generator<OutlineNode> {
  yield node;
  for (const child of node.children) yield* walk(child);
}

interface LayoutNode {
  text: TextObject;
  depth: number;
  children: LayoutNode[];
  w: number;
  h: number;
  fs: number;
}

function sizeMindText(node: TextObject): { w: number; h: number; fs: number } {
  const fs = node.textStyle?.fontSize ?? 15;
  const bold = (node.textStyle?.fontWeight ?? 500) >= 600;
  const w = Math.max(
    node.mindRoot ? 120 : 56,
    Math.min(MAX_TEXT_WIDTH, measure(node.text || " ", fs, bold) + (node.mindRoot ? 20 : 6)),
  );
  const lines = wrapText(node.text || " ", w - 8, fs, { bold });
  const h = Math.max(node.mindRoot ? 40 : 30, lines.length * fs * 1.333 + 8);
  return { w, h, fs };
}

/** Recomputes the tidy tree layout for an existing mind map. */
export function layoutMindMapRects(objects: Record<string, BoardObject>): Record<string, Rect> | null {
  const texts = Object.values(objects).filter(
    (o): o is TextObject => o.objectType === "text" && !o.hidden,
  );
  if (!texts.length) return null;
  const byId = new Map(texts.map((t) => [t.id, t]));
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const o of Object.values(objects)) {
    if (o.objectType !== "connector" || o.hidden) continue;
    if (!byId.has(o.fromId) || !byId.has(o.toId)) continue;
    const list = childrenOf.get(o.fromId) ?? [];
    list.push(o.toId);
    childrenOf.set(o.fromId, list);
    hasParent.add(o.toId);
  }
  const roots = texts.filter((t) => !hasParent.has(t.id));
  if (!roots.length) return null;

  const buildNode = (text: TextObject, depth: number): LayoutNode => {
    const size = sizeMindText(text);
    return {
      text,
      depth,
      children: (childrenOf.get(text.id) ?? [])
        .map((id) => byId.get(id))
        .filter((t): t is TextObject => !!t)
        .map((t) => buildNode(t, depth + 1)),
      ...size,
    };
  };
  const rootNodes = roots
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    .map((t) => buildNode(t, 0));

  const depthWidth = new Map<number, number>();
  const visit = (node: LayoutNode) => {
    depthWidth.set(node.depth, Math.max(depthWidth.get(node.depth) ?? 0, node.w));
    node.children.forEach(visit);
  };
  rootNodes.forEach(visit);

  const anchor = rootNodes[0].text.rect;
  const originX = anchor.x + anchor.w / 2;
  const originY = anchor.y + anchor.h / 2;
  const columnX = new Map<number, number>();
  columnX.set(0, originX - rootNodes[0].w / 2);
  const maxDepth = Math.max(...[...depthWidth.keys()]);
  for (let d = 1; d <= maxDepth; d++) {
    columnX.set(d, (columnX.get(d - 1) ?? originX) + (depthWidth.get(d - 1) ?? 180) + GAP_X);
  }

  const heightOf = (node: LayoutNode): number => {
    if (!node.children.length) return node.h;
    const total = node.children.reduce((sum, child) => sum + heightOf(child), 0);
    return Math.max(node.h, total + GAP_Y * (node.children.length - 1));
  };

  const totalHeight =
    rootNodes.reduce((sum, node) => sum + heightOf(node), 0) + GAP_Y * 2 * (rootNodes.length - 1);
  const rects: Record<string, Rect> = {};
  const place = (node: LayoutNode, top: number) => {
    const own = heightOf(node);
    rects[node.text.id] = {
      x: columnX.get(node.depth) ?? node.text.rect.x,
      y: top + own / 2 - node.h / 2,
      w: node.w,
      h: node.h,
    };
    let cursor = top;
    for (const child of node.children) {
      place(child, cursor);
      cursor += heightOf(child) + GAP_Y;
    }
  };
  let cursor = originY - totalHeight / 2;
  for (const node of rootNodes) {
    place(node, cursor);
    cursor += heightOf(node) + GAP_Y * 2;
  }
  return rects;
}
