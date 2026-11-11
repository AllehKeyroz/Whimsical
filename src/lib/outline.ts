import { nanoid } from "nanoid";
import type { BoardObject, Color, Connector, Shape, Vec } from "../types";
import { DEFAULT_TEXT_STYLE } from "../types";

export interface OutlineEntry {
  label: string;
  depth: number;
}

interface OutlineNode {
  label: string;
  depth: number;
  children: OutlineNode[];
  color: Color;
}

const BRANCH_COLORS: Color[] = ["blue", "purple", "green", "orange", "red", "indigo", "mint", "crimson", "yellow", "brown"];

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
  const root: OutlineNode = { label: entries[0].label, depth: 0, children: [], color: "purple" };
  const stack: OutlineNode[] = [root];

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const node: OutlineNode = {
      label: entry.label,
      depth: entry.depth,
      children: [],
      color: "blue",
    };
    while (stack.length > 1 && stack[stack.length - 1].depth >= entry.depth) stack.pop();
    const parent = stack[stack.length - 1] ?? root;
    if (parent === root) {
      node.color = BRANCH_COLORS[(root.children.length + 1) % BRANCH_COLORS.length];
    } else {
      node.color = parent.color;
    }
    parent.children.push(node);
    stack.push(node);
  }
  return root;
}

const NODE_W = 190;
const NODE_H = 56;
const ROOT_W = 220;
const ROOT_H = 72;
const GAP_X = 110;
const GAP_Y = 14;

function subtreeHeight(node: OutlineNode): number {
  if (!node.children.length) return NODE_H;
  const total = node.children.reduce((sum, child) => sum + subtreeHeight(child), 0);
  return Math.max(NODE_H, total + GAP_Y * (node.children.length - 1));
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

  const totalHeight = subtreeHeight(root);
  const objects: BoardObject[] = [];
  const ids: string[] = [];
  const idByNode = new Map<OutlineNode, string>();

  const place = (node: OutlineNode, depth: number, top: number): void => {
    const isRoot = depth === 0;
    const width = isRoot ? ROOT_W : NODE_W;
    const height = isRoot ? ROOT_H : NODE_H;
    const heightOwn = subtreeHeight(node);
    const centerY = node.children.length
      ? top + heightOwn / 2
      : top + height / 2;
    const rect = {
      x: isRoot
        ? origin.x - width / 2
        : origin.x + ROOT_W / 2 + GAP_X + (depth - 1) * (NODE_W + GAP_X),
      y: centerY - height / 2,
      w: width,
      h: height,
    };
    const id = nanoid();
    idByNode.set(node, id);
    const shape: Shape = {
      id,
      objectType: "shape",
      parentId: null,
      groupId: null,
      shapeType: isRoot ? "pill" : "rect",
      rect,
      style: { color: node.color, deco: isRoot ? "fill" : "outline" },
      text: node.label,
      textStyle: {
        ...DEFAULT_TEXT_STYLE,
        fontSize: isRoot ? 18 : 15,
        fontWeight: isRoot ? 600 : 500,
        align: "center",
      },
      rotation: 0,
      order: 0,
    };
    objects.push(shape);
    ids.push(id);

    let cursor = top;
    for (const child of node.children) {
      const childHeight = subtreeHeight(child);
      place(child, depth + 1, cursor);
      cursor += childHeight + GAP_Y;
    }
  };

  place(root, 0, origin.y - totalHeight / 2);

  for (const node of walk(root)) {
    const parentId = idByNode.get(node);
    if (!parentId) continue;
    for (const child of node.children) {
      const childId = idByNode.get(child);
      if (!childId) continue;
      const connector: Connector = {
        id: nanoid(),
        objectType: "connector",
        parentId: null,
        groupId: null,
        fromId: parentId,
        toId: childId,
        connectorType: "elbow",
        fromRel: { rx: 1, ry: 0.5, axis: "x" },
        toRel: { rx: 0, ry: 0.5, axis: "x" },
        fromEndpoint: "none",
        toEndpoint: "none",
        fromCardinality: null,
        toCardinality: null,
        style: { color: "gray", deco: "outline" },
        label: "",
        order: 0,
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
