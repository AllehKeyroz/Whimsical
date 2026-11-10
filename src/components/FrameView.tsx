import { memo } from "react";
import type { Frame } from "../types";

interface Props {
  frame: Frame;
  selected: boolean;
}

function FrameViewInner({ frame, selected }: Props) {
  const { rect, text } = frame;
  const { x, y, w, h } = rect;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill="none" stroke="#C3CFD9" strokeWidth={2} />
      <text
        x={x + 2}
        y={y - 8}
        fontFamily="Dinsical, system-ui, sans-serif"
        fontSize={13}
        fontWeight={500}
        fill="#788896"
        style={{ userSelect: "none" }}
      >
        {text}
      </text>
      {selected ? <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={4} fill="none" stroke="#8b3fd9" strokeWidth={1.5} pointerEvents="none" /> : null}
    </g>
  );
}

export const FrameView = memo(FrameViewInner);
