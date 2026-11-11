import { memo } from "react";
import type { TextObject } from "../types";
import { wrapText } from "../lib/text";
import { colorToken, shapePaint } from "../palette";


interface Props {
  text: TextObject;
  selected: boolean;
}

function TextViewInner({ text: t, selected }: Props) {
  const { rect, text, textStyle, style } = t;
  const { x, y, w } = rect;
  const fs = textStyle?.fontSize ?? 18;
  const color =
    t.mindNode && !t.mindRoot
      ? "var(--canvas-text)"
      : (textStyle?.color ??
        style.hex ??
        (style.deco === "fill"
          ? colorToken(style.color).onStrong
          : style.color !== "gray"
            ? colorToken(style.color).base
            : "var(--canvas-text)"));
  const lineHeight = fs * 1.333;
  const align = textStyle?.align ?? "left";
  const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
  const textX = align === "left" ? x : align === "right" ? x + w : x + w / 2;
  const lines = wrapText(text, Math.max(24, w), fs, { bold: (textStyle?.fontWeight ?? 400) >= 600 });
  const comments = t.comments?.filter((c) => !c.resolved).length ?? 0;
  const paint = shapePaint(style);
  const totalH = lines.length * lineHeight;
  const startY = y + (rect.h - totalH) / 2 + fs;
  return (
    <g>
      {paint.fill !== "none" ? (
        <rect
          x={x}
          y={y}
          width={w}
          height={rect.h}
          rx={t.mindRoot ? 8 : 4}
          fill={paint.fill}
          stroke={paint.stroke}
          strokeWidth={t.mindRoot ? 0 : 1.5}
          strokeDasharray={paint.dashed ? "7 5" : undefined}
        />
      ) : (
        <rect x={x} y={y} width={w} height={rect.h} fill="transparent" stroke="none" />
      )}
      <text
        x={textX}
        y={startY}
        textAnchor={anchor}
        fontFamily="Dinsical, system-ui, sans-serif"
        fontSize={fs}
        fontWeight={textStyle?.fontWeight ?? 400}
        fontStyle={textStyle?.italic ? "italic" : "normal"}
        textDecoration={textStyle?.underline ? "underline" : undefined}
        fill={color}
        opacity={t.mindNode && !t.mindRoot ? 0.86 : 1}
        style={{ userSelect: "none" }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={textX} y={startY + i * lineHeight}>
            {ln || " "}
          </tspan>
        ))}
      </text>
      {selected ? (
        <rect
          data-export-ignore="true"
          x={x - 4}
          y={y - 4}
          width={w + 8}
          height={rect.h + 8}
          rx={t.mindNode ? 6 : 4}
          fill="none"
          stroke={t.mindNode ? "#2f7bd4" : "#8b3fd9"}
          strokeWidth={t.mindNode ? 1.2 : 1.5}
          strokeDasharray={t.mindNode ? undefined : "4 3"}
          pointerEvents="none"
        />
      ) : null}
      {comments > 0 ? (
        <g data-export-ignore="true" pointerEvents="none">
          <circle cx={x + w + 2} cy={y - 2} r={9} fill="#8b3fd9" stroke="#fff" strokeWidth={1.5} />
          <text x={x + w + 2} y={y + 2} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
            {comments}
          </text>
        </g>
      ) : null}
      {t.link ? (
        <text data-export-ignore="true" x={x + w + 4} y={y + 12} fontSize={12} fill="#2f7bd4" pointerEvents="none">
          ↗
        </text>
      ) : null}
    </g>
  );
}

export const TextView = memo(TextViewInner);
