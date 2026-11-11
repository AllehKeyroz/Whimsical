import dagre from "@dagrejs/dagre";
import { nanoid } from "nanoid";
import {
  DEFAULT_TEXT_STYLE,
  type BoardObject,
  type Cardinality,
  type Color,
  type Connector,
  type Frame,
  type Rect,
  type Shape,
  type ShapeType,
  type Style,
  type TextStyle,
  type Vec,
} from "../types";
import { boundsOf, rectCenter, snapAnchor } from "../geometry";
import { measure, wrapText } from "./text";

export type MermaidKind = "flowchart" | "diagram";

interface ParsedNode {
  id: string;
  label: string;
  shape: ShapeType;
  style?: Partial<Style> & { textColor?: string };
  size?: { w: number; h: number };
  textStyle?: Partial<TextStyle>;
}

interface ParsedEdge {
  from: string;
  to: string;
  label: string;
  dashed: boolean;
  thick: boolean;
  fromArrow: boolean;
  toArrow: boolean;
  fromCardinality?: Cardinality;
  toCardinality?: Cardinality;
}

interface ParsedGroup {
  id: string;
  label: string;
  nodeIds: Set<string>;
}

interface ParsedFlowchart {
  direction: "TB" | "BT" | "LR" | "RL";
  nodes: Map<string, ParsedNode>;
  edges: ParsedEdge[];
  groups: Map<string, ParsedGroup>;
  nodeGroup: Map<string, string>;
}

export interface MermaidBuildResult {
  objects: BoardObject[];
  ids: string[];
  bounds: Rect;
  nodeCount: number;
  edgeCount: number;
}

function stripFrontmatter(text: string): string {
  const withoutFence = text
    .replace(/^\uFEFF/, "")
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "");
  const lines = withoutFence.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i]?.trim() === "---") {
    i++;
    while (i < lines.length && lines[i].trim() !== "---") i++;
    i++;
  }
  return lines
    .slice(i)
    .filter((line) => !line.trim().startsWith("%%"))
    .join("\n")
    .replace(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/g, "\n");
}

export function detectMermaidKind(text: string): MermaidKind | null {
  const clean = stripFrontmatter(text);
  if (/^\s*(flowchart|graph)\b/im.test(clean)) return "flowchart";
  if (
    /^\s*(sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|mindmap|timeline|journey|gitGraph|quadrantChart|xychart-beta|block-beta|packet-beta|architecture-beta|kanban|sankey-beta|requirementDiagram|C4\w+)\b/im.test(
      clean,
    )
  ) {
    return "diagram";
  }
  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function unquote(value: string): string {
  const t = value.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function parseStyleAttrs(value: string): { fill?: string; stroke?: string; color?: string } {
  const out: { fill?: string; stroke?: string; color?: string } = {};
  for (const part of value.split(",")) {
    const [rawKey, rawValue] = part.split(":");
    if (!rawKey || !rawValue) continue;
    const key = rawKey.trim().toLowerCase();
    const val = rawValue.trim().replace(/^[#]?"?|"?$/g, "");
    const hex = rawValue.trim().match(/#([0-9a-fA-F]{6})\b/)?.[0];
    if (!hex) continue;
    if (key === "fill") out.fill = hex;
    else if (key === "stroke") out.stroke = hex;
    else if (key === "color") out.color = hex;
    void val;
  }
  return out;
}

function placeholderize(line: string): { line: string; quoted: string[] } {
  const quoted: string[] = [];
  const protectedLine = line.replace(/"([^"]*)"/g, (_, value: string) => {
    quoted.push(value);
    return `@@Q${quoted.length - 1}@@`;
  });
  return { line: protectedLine, quoted };
}

function restore(value: string, quoted: string[]): string {
  return value.replace(/@@Q(\d+)@@/g, (_, i: string) => quoted[Number(i)] ?? "");
}

function parseNodeToken(
  token: string,
  quoted: string[],
  nodes: Map<string, ParsedNode>,
  classMap: Map<string, string>,
  classDefs: Map<string, { fill?: string; stroke?: string; color?: string }>,
): string | null {
  let raw = token.trim();
  if (!raw) return null;
  const inlineClass = raw.match(/:::([\w-]+)$/)?.[1];
  raw = raw.replace(/:::[\w-]+$/, "").trim();
  const idMatch = raw.match(/^([A-Za-z0-9_][\w-]*)/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const rest = raw.slice(id.length).trim();
  let label = "";
  let shape: ShapeType | null = null;

  const shapeMatch = (open: string, close: string, type: ShapeType) => {
    if (rest.startsWith(open) && rest.endsWith(close)) {
      label = rest.slice(open.length, rest.length - close.length);
      shape = type;
      return true;
    }
    return false;
  };

  if (
    !shapeMatch("((", "))", "ellipse") &&
    !shapeMatch("([", "])", "pill") &&
    !shapeMatch("[[", "]]", "rect") &&
    !shapeMatch("[(", ")]", "cylinder") &&
    !shapeMatch("{{", "}}", "hexagon") &&
    !shapeMatch("[/", "/]", "parallelogram") &&
    !shapeMatch("[/", "\\]", "parallelogram") &&
    !shapeMatch("[\\", "\\]", "parallelogram") &&
    !shapeMatch("{", "}", "diamond") &&
    !shapeMatch("(", ")", "pill") &&
    !shapeMatch("[", "]", "rect")
  ) {
    if (rest.startsWith(">") && rest.endsWith("]")) {
      label = rest.slice(1, -1);
      shape = "rect";
    }
  }

  label = decodeEntities(unquote(restore(label, quoted)));
  const existing = nodes.get(id);
  const nextLabel = label || existing?.label || id;
  const className = classMap.get(id) ?? inlineClass;
  const classStyle = className ? classDefs.get(className) : undefined;
  const style = classStyle
    ? {
        hex: classStyle.fill ?? classStyle.stroke,
        deco: classStyle.fill ? ("fill" as const) : ("outline" as const),
        textColor: classStyle.color,
      }
    : existing?.style;
  nodes.set(id, {
    id,
    label: nextLabel,
    shape: shape ?? existing?.shape ?? "rect",
    style,
  });
  return id;
}

function edgeLabel(value: string, quoted: string[]): string {
  return decodeEntities(unquote(restore(value.trim(), quoted)));
}

function parseFlowLine(
  line: string,
  nodes: Map<string, ParsedNode>,
  edges: ParsedEdge[],
  groups: Map<string, ParsedGroup>,
  nodeGroup: Map<string, string>,
  groupStack: string[],
  classMap: Map<string, string>,
  classDefs: Map<string, { fill?: string; stroke?: string; color?: string }>,
) {
  const { line: protectedLine, quoted } = placeholderize(line);
  const normalized = protectedLine
    .replace(/-\.\s+(.+?)\s+\.->/g, "-.->|$1|")
    .replace(/--\s+(.+?)\s+-->/g, "-->|$1|")
    .replace(/==\s+(.+?)\s+==>/g, "==>|$1|")
    .replace(/-\.\s+(.+?)\s+\.-/g, "-.-|$1|")
    .replace(/==\s+(.+?)\s+===/g, "===|$1|");

  const EDGE_RE = /(<)?(--+|==+|-\.-?)(>)?(?:\|([^|]*)\|)?/g;
  const segments: string[] = [];
  const opMatches: { fromArrow: boolean; toArrow: boolean; op: string; label: string }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = EDGE_RE.exec(normalized))) {
    segments.push(normalized.slice(last, match.index));
    opMatches.push({
      fromArrow: !!match[1],
      op: match[2] ?? "",
      toArrow: !!match[3],
      label: match[4] ?? "",
    });
    last = EDGE_RE.lastIndex;
  }
  segments.push(normalized.slice(last));

  const groupHits = new Set<string>();
  const parseGroup = (segment: string): string[] => {
    const ids: string[] = [];
    for (const piece of segment.split("&")) {
      const id = parseNodeToken(piece, quoted, nodes, classMap, classDefs);
      if (id) {
        ids.push(id);
        groupHits.add(id);
      }
    }
    return ids;
  };

  const parsedGroups = segments.map(parseGroup);
  if (!opMatches.length) {
    for (const id of groupHits) {
      for (const g of groupStack) groups.get(g)?.nodeIds.add(id);
      if (groupStack.length) nodeGroup.set(id, groupStack[groupStack.length - 1]);
    }
    return;
  }

  for (let i = 0; i < opMatches.length; i++) {
    const fromIds = parsedGroups[i] ?? [];
    const toIds = parsedGroups[i + 1] ?? [];
    const op = opMatches[i];
    for (const from of fromIds) {
      for (const to of toIds) {
        if (from === to) continue;
        edges.push({
          from,
          to,
          label: edgeLabel(op.label, quoted),
          dashed: op.op.includes("."),
          thick: op.op.includes("="),
          fromArrow: op.fromArrow,
          toArrow: op.toArrow,
        });
      }
    }
  }
  for (const id of groupHits) {
    for (const g of groupStack) groups.get(g)?.nodeIds.add(id);
    if (groupStack.length) nodeGroup.set(id, groupStack[groupStack.length - 1]);
  }
}

export function parseMermaidFlowchart(text: string): ParsedFlowchart | null {
  const clean = stripFrontmatter(text);
  const lines = clean.split("\n");
  let direction: ParsedFlowchart["direction"] = "TB";
  let headerSeen = false;
  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  const groups = new Map<string, ParsedGroup>();
  const nodeGroup = new Map<string, string>();
  const groupStack: string[] = [];
  const classMap = new Map<string, string>();
  const classDefs = new Map<string, { fill?: string; stroke?: string; color?: string }>();
  const styleMap = new Map<string, { fill?: string; stroke?: string; color?: string }>();
  let groupCounter = 0;

  for (const rawLine of lines) {
    const line = rawLine.split("%%")[0].trim();
    if (!line) continue;
    const head = line.match(/^(flowchart|graph)\s*(TB|TD|BT|RL|LR)?\b/i);
    if (head) {
      headerSeen = true;
      const d = (head[2] || "TD").toUpperCase();
      direction = d === "TD" ? "TB" : (d as ParsedFlowchart["direction"]);
      continue;
    }
    if (!headerSeen) continue;
    if (/^classDef\b/.test(line)) {
      const m = line.match(/^classDef\s+([\w-]+)\s+(.+)$/);
      if (m) classDefs.set(m[1], parseStyleAttrs(m[2]));
      continue;
    }
    if (/^class\s+/.test(line)) {
      const m = line.match(/^class\s+([\w,\s-]+)\s+([\w-]+)\s*$/);
      if (m) {
        for (const id of m[1].split(",").map((s) => s.trim()).filter(Boolean)) classMap.set(id, m[2]);
      }
      continue;
    }
    if (/^style\s+/i.test(line)) {
      const m = line.match(/^style\s+([\w-]+)\s+(.+)$/i);
      if (m) styleMap.set(m[1], parseStyleAttrs(m[2]));
      continue;
    }
    if (/^(linkStyle|click|accTitle|accDescr|direction)\b/.test(line)) continue;
    if (/^subgraph\b/.test(line)) {
      const id = `g${groupCounter++}`;
      const rest = line.replace(/^subgraph\s+/, "").trim();
      const bracket = rest.match(/^[\w-]+\s*\[(.*)\]$/);
      const quotedTitle = rest.match(/^"([^"]*)"$/);
      const label = decodeEntities(unquote(bracket?.[1] ?? quotedTitle?.[1] ?? rest)) || "Grupo";
      groups.set(id, { id, label, nodeIds: new Set() });
      groupStack.push(id);
      continue;
    }
    if (/^end\b/.test(line)) {
      groupStack.pop();
      continue;
    }
    if (/^(flowchart|graph)\b/.test(line)) continue;
    parseFlowLine(line, nodes, edges, groups, nodeGroup, groupStack, classMap, classDefs);
  }

  if (!headerSeen || nodes.size === 0) return null;

  // `class` and `style` statements usually come after the graph definition.
  // Apply them once every line was parsed.
  const defaultDef = classDefs.get("default");
  for (const node of nodes.values()) {
    const explicit = styleMap.get(node.id);
    const className = classMap.get(node.id);
    const def = explicit ?? (className ? classDefs.get(className) : defaultDef);
    if (!def) continue;
    node.style = {
      ...node.style,
      ...(def.fill || def.stroke ? { hex: def.fill ?? def.stroke, deco: def.fill ? "fill" : "outline" } : {}),
      ...(def.color ? { textColor: def.color } : {}),
    };
  }

  return { direction, nodes, edges, groups, nodeGroup };
}

function defaultStyleFor(shape: ShapeType): Partial<Style> {
  switch (shape) {
    case "diamond":
      return { color: "yellow", deco: "outline" };
    case "ellipse":
    case "pill":
      return { color: "green", deco: "fill" };
    case "cylinder":
      return { color: "purple", deco: "outline" };
    case "hexagon":
      return { color: "indigo", deco: "outline" };
    case "parallelogram":
      return { color: "orange", deco: "outline" };
    case "document":
      return { color: "brown", deco: "outline" };
    default:
      return { color: "blue", deco: "outline" };
  }
}

/**
 * Matches ShapeNode's text-width factors. The shape width must be derived from
 * the *wrapped* content, never from the full label length: long labels wrap and
 * grow the box downward instead of making it endlessly wide.
 */
function textWidthFactorFor(shape: ShapeType): number {
  switch (shape) {
    case "diamond":
      return 0.6;
    case "ellipse":
      return 0.72;
    case "hexagon":
      return 0.68;
    case "triangle":
      return 0.5;
    case "sticky":
      return 0.9;
    default:
      return 1;
  }
}

const MERMAID_WIDTHS: Record<ShapeType, number> = {
  rect: 192,
  pill: 180,
  ellipse: 150,
  diamond: 240,
  triangle: 200,
  hexagon: 210,
  cylinder: 180,
  parallelogram: 210,
  document: 192,
  sticky: 220,
};

function nodeSize(shape: ShapeType, label: string): { w: number; h: number; lines: string[] } {
  const fs = 18;
  const factor = textWidthFactorFor(shape);
  const w = MERMAID_WIDTHS[shape] ?? 192;
  // Whimsical keeps the node width standard and wraps the copy inside it.
  // As the wrapped text grows, only the height increases.
  const textArea = Math.max(24, (w - 20) * factor);
  const lines = wrapText(label || " ", textArea, fs);
  let h = Math.max(96, lines.length * 24 + 32);

  if (shape === "diamond") {
    h = Math.max(140, lines.length * 24 + 70);
  } else if (shape === "ellipse") {
    h = Math.max(110, lines.length * 24 + 46);
  } else if (shape === "pill") {
    h = Math.max(64, lines.length * 24 + 28);
  } else if (shape === "cylinder") {
    h = Math.max(110, lines.length * 26 + 56);
  } else if (shape === "hexagon" || shape === "parallelogram") {
    h = Math.max(100, lines.length * 26 + 44);
  }

  return { w, h: Math.round(h), lines };
}

interface ErField {
  type: string;
  name: string;
}

interface ErEntity {
  name: string;
  fields: ErField[];
  style?: { fill?: string; stroke?: string; color?: string };
}

const ER_TYPES = new Set([
  "string",
  "text",
  "int",
  "integer",
  "bigint",
  "float",
  "double",
  "decimal",
  "boolean",
  "bool",
  "date",
  "datetime",
  "timestamp",
  "time",
  "uuid",
  "json",
  "blob",
  "varchar",
  "char",
]);

function tokenizeErLine(line: string): { value: string; quoted: boolean }[] {
  const raw = line.match(/`[^`]*`|"[^"]*"|'[^']*'|\S+/g) ?? [];
  return raw.map((token) => ({
    value: token.replace(/^[`"']|[`"']$/g, "").trim(),
    quoted: /^[`"']/.test(token),
  }));
}

function erField(line: string): ErField[] {
  const tokens = tokenizeErLine(line);
  if (!tokens.length) return [];
  if (tokens.every((t) => t.quoted)) {
    return tokens.map((t) => ({ type: "string", name: t.value }));
  }
  const first = tokens[0].value.toLowerCase();
  if (ER_TYPES.has(first) && tokens.length >= 2) {
    const name = tokens
      .slice(1)
      .map((t) => t.value)
      .join(" ")
      .trim();
    return name ? [{ type: tokens[0].value, name }] : [];
  }
  // Tolerate "Name Surname" without a type by treating each token as a field.
  return tokens.map((t) => ({ type: "string", name: t.value }));
}

function cardinality(value: string, side: "left" | "right"): Cardinality {
  const v = value.replace(/\s+/g, "");
  void side;
  if (v === "||") return "one";
  if (v === "o|" || v === "|o") return "zero-or-one";
  if (v === "}|" || v === "|{") return "one-or-many";
  if (v === "}o" || v === "o{") return "zero-or-many";
  return null;
}

export function parseMermaidEr(text: string): ParsedFlowchart | null {
  const clean = stripFrontmatter(text);
  const lines = clean.split("\n");
  const entities = new Map<string, ErEntity>();
  const styles = new Map<string, { fill?: string; stroke?: string; color?: string }>();
  const edges: ParsedEdge[] = [];
  let headerSeen = false;
  let current: ErEntity | null = null;

  for (const rawLine of lines) {
    const line = rawLine.split("%%")[0].trim();
    if (!line) continue;
    if (/^erDiagram\b/i.test(line)) {
      headerSeen = true;
      continue;
    }
    if (!headerSeen) continue;
    if (/^style\s+/i.test(line)) {
      const m = line.match(/^style\s+(.+?)\s+(.+)$/);
      if (m) styles.set(decodeEntities(unquote(m[1])), parseStyleAttrs(m[2]));
      continue;
    }
    if (/^(classDef|class|linkStyle|click|accTitle|accDescr)\b/i.test(line)) continue;
    if (current) {
      if (line === "}") {
        entities.set(current.name, current);
        current = null;
        continue;
      }
      current.fields.push(...erField(line));
      continue;
    }
    const entityStart = line.match(/^(.+?)\s*\{\s*$/);
    if (entityStart) {
      current = { name: decodeEntities(unquote(entityStart[1])), fields: [] };
      continue;
    }
    const rel = line.match(/^(\S+)\s+([|}{o]{1,2})(--|\.\.)([|}{o]{1,2})\s+(\S+)\s*(?::\s*(.*))?$/);
    if (rel) {
      const from = decodeEntities(unquote(rel[1]));
      const to = decodeEntities(unquote(rel[5]));
      edges.push({
        from,
        to,
        label: decodeEntities(rel[6] ?? ""),
        dashed: rel[3] === "..",
        thick: false,
        fromArrow: false,
        toArrow: false,
        fromCardinality: cardinality(rel[2], "left"),
        toCardinality: cardinality(rel[4], "right"),
      });
    }
  }
  if (current) entities.set(current.name, current);
  if (!headerSeen || entities.size === 0) return null;

  const nodes = new Map<string, ParsedNode>();
  for (const entity of entities.values()) {
    const style = styles.get(entity.name);
    const rows = entity.fields.map((f) => `${f.type}  ${f.name}`);
    const title = entity.name;
    const text = [title, "────────────────", ...rows].join("\n");
    const fs = 14;
    const lineWidth = Math.max(...text.split("\n").map((l) => measure(l, fs)), 220);
    const w = Math.max(260, Math.min(460, lineWidth + 44));
    const h = Math.max(110, 54 + Math.max(1, rows.length) * 22 + 22);
    nodes.set(entity.name, {
      id: entity.name,
      label: text,
      shape: "rect",
      size: { w: Math.round(w), h: Math.round(h) },
      textStyle: { fontSize: fs, align: "left", fontWeight: 400 },
      style: {
        color: "white",
        deco: "outline",
        ...(style?.color ? { textColor: style.color } : {}),
      },
    });
  }

  return {
    direction: "LR",
    nodes,
    edges,
    groups: new Map(),
    nodeGroup: new Map(),
  };
}

export function buildFlowchartObjects(
  parsed: ParsedFlowchart,
  origin: Vec,
): MermaidBuildResult | null {
  const nodeList = [...parsed.nodes.values()];
  if (!nodeList.length) return null;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: parsed.direction, nodesep: 72, ranksep: 112, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  const sizes = new Map<string, { w: number; h: number }>();
  for (const node of nodeList) {
    const size = node.size ?? nodeSize(node.shape, node.label);
    sizes.set(node.id, size);
    g.setNode(node.id, { width: size.w, height: size.h });
  }
  for (const edge of parsed.edges) {
    if (!parsed.nodes.has(edge.from) || !parsed.nodes.has(edge.to)) continue;
    g.setEdge(edge.from, edge.to, {
      width: edge.label ? Math.max(40, measure(edge.label, 13) + 20) : 1,
      height: edge.label ? 24 : 1,
      labelpos: "c",
    });
  }
  dagre.layout(g);

  const rects = new Map<string, Rect>();
  for (const node of nodeList) {
    const n = g.node(node.id);
    const size = sizes.get(node.id)!;
    if (!n) continue;
    rects.set(node.id, { x: n.x - size.w / 2, y: n.y - size.h / 2, w: size.w, h: size.h });
  }
  const allRects = [...rects.values()];
  const b = boundsOf(allRects);
  const dx = origin.x - (b.x + b.w / 2);
  const dy = origin.y - (b.y + b.h / 2);
  for (const r of rects.values()) {
    r.x += dx;
    r.y += dy;
  }
  const shifted = boundsOf([...rects.values()]);

  const objects: BoardObject[] = [];
  const ids: string[] = [];
  const frameByGroup = new Map<string, Frame>();
  const frameIdByNode = new Map<string, string>();

  for (const group of parsed.groups.values()) {
    const members = [...group.nodeIds].filter((id) => rects.has(id));
    if (!members.length) continue;
    const groupBounds = boundsOf(members.map((id) => rects.get(id)!));
    const pad = 36;
    const frame: Frame = {
      id: nanoid(),
      objectType: "frame",
      parentId: null,
      groupId: null,
      rect: {
        x: groupBounds.x - pad,
        y: groupBounds.y - pad - 24,
        w: groupBounds.w + pad * 2,
        h: groupBounds.h + pad * 2 + 24,
      },
      style: { color: "smoke", deco: "outline" },
      text: group.label,
      textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 13, fontWeight: 500, align: "left" },
      order: 0,
    };
    frameByGroup.set(group.id, frame);
    objects.push(frame);
    ids.push(frame.id);
    for (const id of members) frameIdByNode.set(id, frame.id);
  }

  const idMap = new Map<string, string>();
  for (const node of nodeList) {
    const id = nanoid();
    idMap.set(node.id, id);
    const rect = rects.get(node.id);
    if (!rect) continue;
    const style = { ...defaultStyleFor(node.shape), ...(node.style ?? {}) } as Style;
    const textStyle: TextStyle = {
      ...DEFAULT_TEXT_STYLE,
      align: "center",
      ...node.textStyle,
      ...(node.style?.textColor ? { color: node.style.textColor } : {}),
    };
    const shape: Shape = {
      id,
      objectType: "shape",
      parentId: frameIdByNode.get(node.id) ?? null,
      groupId: null,
      shapeType: node.shape,
      rect,
      style,
      text: node.label,
      textStyle,
      rotation: 0,
      order: 0,
    };
    objects.push(shape);
    ids.push(id);
  }

  for (const edge of parsed.edges) {
    const fromOld = edge.from;
    const toOld = edge.to;
    const fromId = idMap.get(fromOld);
    const toId = idMap.get(toOld);
    const fromRect = rects.get(fromOld);
    const toRect = rects.get(toOld);
    if (!fromId || !toId || !fromRect || !toRect) continue;
    const fromRel = snapAnchor(fromRect, rectCenter(toRect));
    const toRel = snapAnchor(toRect, rectCenter(fromRect));
    const groupFrom = frameIdByNode.get(fromOld);
    const groupTo = frameIdByNode.get(toOld);
    const conn: Connector = {
      id: nanoid(),
      objectType: "connector",
      parentId: groupFrom && groupFrom === groupTo ? groupFrom : null,
      groupId: null,
      fromId,
      toId,
      connectorType: "elbow",
      fromRel,
      toRel,
      fromEndpoint: edge.fromArrow ? "arrow" : "none",
      toEndpoint: edge.toArrow ? "arrow" : "none",
      fromCardinality: edge.fromCardinality ?? null,
      toCardinality: edge.toCardinality ?? null,
      style: { color: "gray", deco: edge.dashed ? "dash" : edge.thick ? "fill" : "outline" },
      label: edge.label,
      order: 0,
    };
    objects.push(conn);
    ids.push(conn.id);
  }

  return {
    objects,
    ids,
    bounds: shifted,
    nodeCount: nodeList.length,
    edgeCount: parsed.edges.length,
  };
}

export async function renderMermaidImage(
  text: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const mod = await import("mermaid");
    const mermaid = mod.default;
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "strict",
      fontFamily: '"Dinsical", system-ui, sans-serif',
      flowchart: { htmlLabels: false },
      class: { htmlLabels: false },
    });
    const id = `mermaid-paste-${nanoid(8)}`;
    const { svg } = await mermaid.render(id, text);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const el = doc.documentElement;
    const vb = el.getAttribute("viewBox")?.split(/\s+/).map(Number);
    const width = Math.max(1, Number(vb?.[2] || el.getAttribute("width")?.replace(/px$/, "") || 800));
    const height = Math.max(1, Number(vb?.[3] || el.getAttribute("height")?.replace(/px$/, "") || 600));
    const withBg = svg.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="#ffffff"/>`);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withBg)}`;
    return { dataUrl, width, height };
  } catch {
    return null;
  }
}

export function clampTextStyle(style?: TextStyle): TextStyle {
  return style ?? { ...DEFAULT_TEXT_STYLE };
}

export function colorForShape(shape: ShapeType): Color {
  return (defaultStyleFor(shape).color as Color) ?? "blue";
}
