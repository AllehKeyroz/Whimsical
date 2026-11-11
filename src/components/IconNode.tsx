import { createElement, memo, useEffect, useState } from "react";
import type { IconObject } from "../types";
import { getLoadedIconLibrary, loadIconLibrary, type IconMap } from "../lib/iconLibrary";
import { colorToken } from "../palette";

interface Props {
  icon: IconObject;
  selected: boolean;
}

function IconNodeInner({ icon, selected }: Props) {
  const [icons, setIcons] = useState<IconMap | null>(getLoadedIconLibrary());
  useEffect(() => {
    if (icons) return;
    let alive = true;
    void loadIconLibrary().then((lib) => {
      if (alive) setIcons(lib);
    });
    return () => {
      alive = false;
    };
  }, [icons]);

  const { x, y, w, h } = icon.rect;
  const size = Math.min(w, h);
  const color = icon.style.hex ?? colorToken(icon.style.color).base;
  const node = icons?.[icon.icon] ?? null;
  const comments = icon.comments?.filter((c) => !c.resolved).length ?? 0;
  const strokeWidth = icon.strokeWidth ?? 2;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="transparent" stroke="none" />
      {icon.iconSet === "emoji" ? (
        <text
          x={x + w / 2}
          y={y + h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily='"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
          fontSize={size * 0.88}
          fill="var(--canvas-text)"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {icon.icon}
        </text>
      ) : node ? (
        <g
          transform={`translate(${x + (w - size) / 2}, ${y + (h - size) / 2}) scale(${size / 24})`}
          style={{ pointerEvents: "none" }}
        >
          {node.map(([tag, attrs], i) =>
            createElement(tag, {
              fill: "none",
              stroke: color,
              strokeWidth,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              ...attrs,
              key: i,
            }),
          )}
        </g>
      ) : (
        <g style={{ pointerEvents: "none" }} opacity={0.5}>
          <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) * 0.3} fill="none" stroke={color} strokeWidth={2} />
          <path
            d={`M ${x + w / 2 - size * 0.15} ${y + h / 2} h ${size * 0.3} M ${x + w / 2} ${y + h / 2 - size * 0.15} v ${size * 0.3}`}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      )}
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
      {icon.link ? (
        <text data-export-ignore="true" x={x + w + 4} y={y + 12} fontSize={12} fill="#2f7bd4" pointerEvents="none">
          ↗
        </text>
      ) : null}
    </g>
  );
}

export const IconNode = memo(IconNodeInner);
