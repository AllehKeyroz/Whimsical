import { memo } from "react";
import type { Shape } from "../types";
import { shapePaint } from "../palette";
import { wrapText } from "../lib/text";

const PAD = 8;
const FONT = 18;
const LINE = 24;

interface Props {
  shape: Shape;
  selected: boolean;
}

function geometryFor(shape: Shape, fill: string, stroke: string, dashed: boolean) {
  const { x, y, w, h } = shape.rect;
  const common = {
    fill,
    stroke,
    strokeWidth: 2,
    strokeLinejoin: "round" as const,
    strokeDasharray: dashed ? "7 5" : undefined,
  };
  switch (shape.shapeType) {
    case "pill":
      return <rect x={x} y={y} width={w} height={h} rx={Math.min(h / 2, 999)} ry={Math.min(h / 2, 999)} {...common} />;
    case "ellipse":
      return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />;
    case "diamond":
      return <polygon points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} {...common} />;
    case "triangle":
      return <polygon points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`} {...common} />;
    case "hexagon":
      return (
        <polygon
          points={`${x + w * 0.25},${y} ${x + w * 0.75},${y} ${x + w},${y + h / 2} ${x + w * 0.75},${y + h} ${x + w * 0.25},${y + h} ${x},${y + h / 2}`}
          {...common}
        />
      );
    case "parallelogram":
      return <polygon points={`${x + w * 0.22},${y} ${x + w},${y} ${x + w * 0.78},${y + h} ${x},${y + h}`} {...common} />;
    case "document":
      return (
        <path
          d={`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h * 0.82} Q ${x + w * 0.75} ${y + h * 0.68} ${x + w * 0.5} ${y + h * 0.84} Q ${x + w * 0.25} ${y + h} ${x} ${y + h * 0.84} Z`}
          {...common}
        />
      );
    case "cylinder": {
      const ry = Math.min(14, h * 0.16);
      return (
        <g>
          <path d={`M ${x} ${y + ry} L ${x} ${y + h - ry} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y + h - ry} L ${x + w} ${y + ry} Z`} {...common} />
          <path d={`M ${x} ${y + ry} A ${w / 2} ${ry} 0 0 1 ${x + w} ${y + ry} A ${w / 2} ${ry} 0 0 1 ${x} ${y + ry}`} {...common} />
        </g>
      );
    }
    default:
      return <rect x={x} y={y} width={w} height={h} rx={4} ry={4} {...common} />;
  }
}

function textWidthFactor(t: Shape["shapeType"]) {
  switch (t) {
    case "diamond":
      return 0.6;
    case "triangle":
      return 0.5;
    case "ellipse":
      return 0.72;
    case "hexagon":
      return 0.68;
    default:
      return 1;
  }
}

function ShapeNodeInner({ shape, selected }: Props) {
  const { rect, text, style } = shape;
  const paint = shapePaint(style);
  const { x, y, w, h } = rect;

  const maxTextWidth = (w - PAD * 2) * textWidthFactor(shape.shapeType);
  const lines = wrapText(text, Math.max(24, maxTextWidth), FONT);
  const totalH = lines.length * LINE;
  const startY = y + h / 2 - totalH / 2 + LINE * 0.75;

  return (
    <g>
      {geometryFor(shape, paint.fill, paint.stroke, paint.dashed)}
      {text ? (
        <text
          textAnchor="middle"
          fontFamily="Dinsical, system-ui, sans-serif"
          fontSize={FONT}
          fill={paint.text}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {lines.map((ln, i) => (
            <tspan key={i} x={x + w / 2} y={startY + i * LINE}>
              {ln || " "}
            </tspan>
          ))}
        </text>
      ) : null}
      {selected ? (
        <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={6} fill="none" stroke="#8b3fd9" strokeWidth={1.5} pointerEvents="none" />
      ) : null}
    </g>
  );
}

export const ShapeNode = memo(ShapeNodeInner);
