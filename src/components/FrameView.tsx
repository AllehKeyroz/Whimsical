import { memo } from "react";
import type { Frame } from "../types";
import { colorToken } from "../palette";

interface Props {
  frame: Frame;
  selected: boolean;
}

function FrameViewInner({ frame, selected }: Props) {
  const { rect, text, textStyle, style } = frame;
  const { x, y, w, h } = rect;
  const token = colorToken(style.color);
  const fill = style.deco === "fill" ? style.hex ?? token.soft : "none";
  const stroke = style.hex ?? token.base;
  const comments = frame.comments?.filter((c) => !c.resolved).length ?? 0;
  const fs = textStyle?.fontSize ?? 13;
  const labelColor =
    textStyle?.color ??
    style.hex ??
    (style.color === "smoke" || style.color === "white" ? "var(--canvas-text)" : token.base);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={style.deco === "dash" ? "7 5" : undefined}
        opacity={style.deco === "fill" ? 0.55 : 1}
      />
      <text
        x={x + 2}
        y={y - 8}
        fontFamily="Dinsical, system-ui, sans-serif"
        fontSize={fs}
        fontWeight={textStyle?.fontWeight ?? 500}
        fontStyle={textStyle?.italic ? "italic" : "normal"}
        textDecoration={textStyle?.underline ? "underline" : undefined}
        fill={labelColor}
        style={{ userSelect: "none" }}
      >
        {text}
      </text>
      {selected ? (
        <rect
          data-export-ignore="true"
          x={x - 3}
          y={y - 3}
          width={w + 6}
          height={h + 6}
          rx={6}
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
      {frame.link ? (
        <text data-export-ignore="true" x={x + w - 14} y={y + 14} fontSize={12} fill="#2f7bd4">
          ↗
        </text>
      ) : null}
    </g>
  );
}

export const FrameView = memo(FrameViewInner);
