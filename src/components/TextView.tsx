import { memo } from "react";
import type { TextObject } from "../types";
import { wrapText } from "../lib/text";
import { colorToken, TEXT_COLOR } from "../palette";

interface Props {
  text: TextObject;
  selected: boolean;
}

function TextViewInner({ text: t, selected }: Props) {
  const { rect, text, fontSize, style } = t;
  const { x, y, w, h } = rect;
  const color = style.hex ?? (style.deco === "fill" ? colorToken(style.color).onStrong : TEXT_COLOR);
  const lines = wrapText(text, Math.max(24, w), fontSize);
  const lineHeight = fontSize * 1.333;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="transparent" stroke="none" />
      <text x={x} y={y + lineHeight * 0.8} fontFamily="Dinsical, system-ui, sans-serif" fontSize={fontSize} fill={color} style={{ userSelect: "none" }}>
        {lines.map((ln, i) => (
          <tspan key={i} x={x} y={y + lineHeight * (i + 0.8)}>
            {ln || " "}
          </tspan>
        ))}
      </text>
      {selected ? <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={4} fill="none" stroke="#8b3fd9" strokeWidth={1.5} pointerEvents="none" /> : null}
    </g>
  );
}

export const TextView = memo(TextViewInner);
