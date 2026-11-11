import type { Board, Connector, Frame, Shape } from "../types";
import { colorToken, shapePaint } from "../palette";

const SHAPE_SYNTAX: Record<string, (label: string) => string> = {
  rect: (l) => `["${l}"]`,
  diamond: (l) => `{"${l}"}`,
  pill: (l) => `(["${l}"])`,
  ellipse: (l) => `(("${l}"))`,
  hexagon: (l) => `{{"${l}"}}`,
  cylinder: (l) => `[("${l}")]`,
  parallelogram: (l) => `[/"${l}"/]`,
  triangle: (l) => `["${l}"]`,
  document: (l) => `["${l}"]`,
  sticky: (l) => `["${l}"]`,
};

function escapeLabel(text: string): string {
  return text.replace(/"/g, "#quot;").replace(/\r?\n/g, "<br/>").trim();
}

function nodeToken(id: string, shape: Shape): string {
  const label = escapeLabel(shape.text || " ");
  const syntax = SHAPE_SYNTAX[shape.shapeType] ?? SHAPE_SYNTAX.rect;
  return `  ${id}${syntax(label)}`;
}

function edgeOperator(connector: Connector): string {
  const from =
    connector.fromEndpoint === "arrow"
      ? "<"
      : connector.fromEndpoint === "circle"
        ? "o"
        : connector.fromEndpoint === "diamond"
          ? "x"
          : "";
  const to =
    connector.toEndpoint === "arrow"
      ? ">"
      : connector.toEndpoint === "circle"
        ? "o"
        : connector.toEndpoint === "diamond"
          ? "x"
          : "";
  if (connector.style.deco === "dash") {
    return `${from}-.-${to}`;
  }
  if (connector.style.deco === "fill") {
    return `${from}==${to || "="}`;
  }
  return from || to ? `${from}--${to}` : "---";
}

export function boardToMermaid(board: Board): string {
  const shapes = Object.values(board.objects)
    .filter((o): o is Shape => o.objectType === "shape" && !o.hidden)
    .sort((a, b) => a.order - b.order);
  const frames = Object.values(board.objects)
    .filter((o): o is Frame => o.objectType === "frame" && !o.hidden)
    .sort((a, b) => a.order - b.order);

  const idMap = new Map<string, string>();
  if (!shapes.length) return "";
  shapes.forEach((shape, index) => idMap.set(shape.id, `n${index + 1}`));

  const rects = shapes.map((s) => s.rect);
  const minX = Math.min(...rects.map((r) => r.x));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  const direction = maxX - minX > (maxY - minY) * 1.25 ? "LR" : "TB";

  const lines: string[] = [`flowchart ${direction}`];

  const emitted = new Set<string>();
  for (const frame of frames) {
    const members = shapes.filter((s) => s.parentId === frame.id);
    if (!members.length) continue;
    lines.push(`  subgraph ${frame.id}["${escapeLabel(frame.text || "Grupo")}"]`);
    for (const shape of members) {
      const id = idMap.get(shape.id);
      if (!id) continue;
      lines.push(nodeToken(id, shape));
      emitted.add(shape.id);
    }
    lines.push("  end");
  }

  for (const shape of shapes) {
    if (emitted.has(shape.id)) continue;
    const id = idMap.get(shape.id);
    if (!id) continue;
    lines.push(nodeToken(id, shape));
  }

  const styleLines: string[] = [];
  for (const shape of shapes) {
    const id = idMap.get(shape.id);
    if (!id) continue;
    const paint = shapePaint(shape.style);
    const fill = paint.fill === "none" ? "none" : paint.fill;
    const text = shape.textStyle.color ?? paint.text;
    styleLines.push(`  style ${id} fill:${fill},stroke:${paint.stroke},color:${text}`);
  }
  lines.push(...styleLines);

  const connectors = Object.values(board.objects)
    .filter((o): o is Connector => o.objectType === "connector" && !o.hidden)
    .sort((a, b) => a.order - b.order);

  const linkStyles: string[] = [];
  let linkIndex = 0;
  for (const connector of connectors) {
    const from = idMap.get(connector.fromId);
    const to = idMap.get(connector.toId);
    if (!from || !to) continue;
    const label = connector.label?.trim();
    const edge = label
      ? `${from} ${edgeOperator(connector)}|${escapeLabel(label)}| ${to}`
      : `${from} ${edgeOperator(connector)} ${to}`;
    lines.push(`  ${edge}`);
    const token = colorToken(connector.style.color);
    if (token.base.toLowerCase() !== "#738291") {
      linkStyles.push(`  linkStyle ${linkIndex} stroke:${token.base}`);
    }
    linkIndex++;
  }
  lines.push(...linkStyles);

  return `${lines.join("\n")}\n`;
}

export async function copyBoardAsMermaid(board: Board): Promise<boolean> {
  const text = boardToMermaid(board);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
