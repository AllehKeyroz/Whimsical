import { memo } from "react";
import type { Shape } from "../types";
import { colorToken, shapePaint, TEXT_COLOR } from "../palette";
import { wrapText } from "../lib/text";

const PAD = 10;
const LINE = 1.3;

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
          <path
            d={`M ${x} ${y + ry} L ${x} ${y + h - ry} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y + h - ry} L ${x + w} ${y + ry} Z`}
            {...common}
          />
          <path
            d={`M ${x} ${y + ry} A ${w / 2} ${ry} 0 0 1 ${x + w} ${y + ry} A ${w / 2} ${ry} 0 0 1 ${x} ${y + ry}`}
            {...common}
          />
        </g>
      );
    }
    case "sticky": {
      const fold = Math.min(22, w * 0.18, h * 0.18);
      return (
        <g>
          <path
            d={`M ${x} ${y + 3} Q ${x} ${y} ${x + 3} ${y} L ${x + w - 3} ${y} Q ${x + w} ${y} ${x + w} ${y + 3} L ${x + w} ${y + h - fold} L ${x + w - fold} ${y + h} L ${x + 3} ${y + h} Q ${x} ${y + h} ${x} ${y + h - 3} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeDasharray={dashed ? "7 5" : undefined}
          />
          <path
            d={`M ${x + w - fold} ${y + h} L ${x + w - fold} ${y + h - fold} L ${x + w} ${y + h - fold}`}
            fill="none"
            stroke={stroke}
            strokeWidth={1.2}
            opacity={0.55}
          />
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
    case "sticky":
      return 0.9;
    default:
      return 1;
  }
}

function ShapeNodeInner({ shape, selected }: Props) {
  const { rect, text, style, textStyle } = shape;
  const token = colorToken(style.color);
  const paint =
    shape.shapeType === "sticky"
      ? {
          fill: style.hex ?? token.soft,
          stroke: style.hex ?? token.base,
          text: style.hex ? (style.deco === "fill" ? "#293845" : TEXT_COLOR) : TEXT_COLOR,
          dashed: style.deco === "dash",
        }
      : shapePaint(style);
  const { x, y, w, h } = rect;
  const fs = textStyle?.fontSize ?? 18;
  const lineHeight = fs * LINE;
  const maxTextWidth = Math.max(24, (w - PAD * 2) * textWidthFactor(shape.shapeType));
  const lines = wrapText(text, maxTextWidth, fs, { bold: (textStyle?.fontWeight ?? 400) >= 600 });
  const totalH = lines.length * lineHeight;
  const startY = y + h / 2 - totalH / 2 + lineHeight * 0.75;
  const align = textStyle?.align ?? "center";
  const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
  const textX = align === "left" ? x + PAD : align === "right" ? x + w - PAD : x + w / 2;
  const comments = shape.comments?.filter((c) => !c.resolved).length ?? 0;
  const textColor = textStyle?.color ?? (paint.fill === "none" ? "var(--canvas-text)" : paint.text);

  return (
    <g>
      {geometryFor(shape, paint.fill, paint.stroke, paint.dashed)}
      {text ? (
        <text
          textAnchor={anchor}
          fontFamily="Dinsical, system-ui, sans-serif"
          fontSize={fs}
          fontWeight={textStyle?.fontWeight ?? 400}
          fontStyle={textStyle?.italic ? "italic" : "normal"}
          textDecoration={textStyle?.underline ? "underline" : undefined}
          fill={textColor}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {lines.map((ln, i) => (
            <tspan key={i} x={textX} y={startY + i * lineHeight}>
              {ln || " "}
            </tspan>
          ))}
        </text>
      ) : null}
      {selected ? (
        <rect
          data-export-ignore="true"
          x={x - 3}
          y={y - 3}
          width={w + 6}
          height={h + 6}
          rx={7}
          fill="none"
          stroke="#8b3fd9"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      ) : null}
      {comments > 0 ? (
        <g data-export-ignore="true" pointerEvents="none">
          <circle cx={x + w - 2} cy={y + 2} r={9} fill="#8b3fd9" stroke="#fff" strokeWidth={1.5} />
          <text x={x + w - 2} y={y + 6} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
            {comments}
          </text>
        </g>
      ) : null}
      {shape.link ? (
        <text data-export-ignore="true" x={x + 2} y={y - 5} fontSize={12} fill="#2f7bd4" pointerEvents="none">
          ↗
        </text>
      ) : null}
    </g>
  );
}

export const ShapeNode = memo(ShapeNodeInner);
