import { memo } from "react";
import type { ImageObject } from "../types";

interface Props {
  image: ImageObject;
  selected: boolean;
}

function ImageNodeInner({ image, selected }: Props) {
  const { rect, src, alt } = image;
  const { x, y, w, h } = rect;
  const comments = image.comments?.filter((c) => !c.resolved).length ?? 0;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#eef2f6" stroke="#c3cfd9" strokeWidth={1} />
      <image href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: "none" }}>
        {alt ? <title>{alt}</title> : null}
      </image>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke="#c3cfd9" strokeWidth={1} pointerEvents="none" />
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
      {image.link ? (
        <text data-export-ignore="true" x={x + 4} y={y + 14} fontSize={12} fill="#2f7bd4" pointerEvents="none">
          ↗
        </text>
      ) : null}
    </g>
  );
}

export const ImageNode = memo(ImageNodeInner);
