import { memo } from "react";
import type { Connector, TextStyle, Vec } from "../types";
import { endpointMarkup, type RouteResult } from "../geometry";
import { colorToken } from "../palette";
import { measure } from "../lib/text";

interface Props {
  connector: Connector;
  route: RouteResult;
  selected: boolean;
}

function ConnectorViewInner({ connector, route, selected }: Props) {
  const stroke =
    connector.style.hex ??
    (connector.style.color === "gray" ? "var(--connector-stroke)" : colorToken(connector.style.color).base);
  const dashed = connector.style.deco === "dash";
  const width = connector.style.deco === "fill" ? 4.2 : 3;
  const points = route.points;
  const start = points[0];
  const end = points[points.length - 1];
  const prevEnd = points[points.length - 2] ?? start;
  const nextStart = points[1] ?? end;
  const startDir: Vec = { x: start.x - nextStart.x, y: start.y - nextStart.y };
  const endDir: Vec = { x: end.x - prevEnd.x, y: end.y - prevEnd.y };

  const startMarkers = endpointMarkup(start, startDir, connector.fromEndpoint, connector.fromCardinality);
  const endMarkers = endpointMarkup(end, endDir, connector.toEndpoint, connector.toCardinality);
  const labelStyle: Partial<TextStyle> = connector.labelStyle ?? {};
  const labelColor =
    labelStyle.color ?? (connector.style.color === "gray" ? "var(--canvas-text)" : stroke);
  const fs = labelStyle.fontSize ?? 13;
  const labelWidth = connector.label ? measure(connector.label, fs, (labelStyle.fontWeight ?? 400) >= 600) : 0;

  return (
    <g>
      {selected ? (
        <path
          data-export-ignore="true"
          d={route.d}
          fill="none"
          stroke="#8b3fd9"
          strokeWidth={width + 5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.28}
          pointerEvents="none"
        />
      ) : null}
      <path
        d={route.d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "8 6" : undefined}
      />
      {[...startMarkers, ...endMarkers].map((m, i) => (
        <path
          key={i}
          d={m.d}
          fill={m.fill ? stroke : "none"}
          stroke={m.stroke ? stroke : "none"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {connector.label ? (
        <g>
          <rect
            x={route.mid.x - labelWidth / 2 - 5}
            y={route.mid.y - fs - 2}
            width={labelWidth + 10}
            height={fs + 8}
            rx={4}
            fill="var(--canvas-bg)"
            opacity={0.92}
            pointerEvents="none"
          />
          <text
            x={route.mid.x}
            y={route.mid.y - 5}
            textAnchor="middle"
            fontFamily="Dinsical, system-ui, sans-serif"
            fontSize={fs}
            fontWeight={labelStyle.fontWeight ?? 400}
            fontStyle={labelStyle.italic ? "italic" : "normal"}
            fill={labelColor}
            pointerEvents="none"
          >
            {connector.label}
          </text>
        </g>
      ) : null}
      {connector.link ? (
        <text
          data-export-ignore="true"
          x={route.mid.x + 8}
          y={route.mid.y + 4}
          fontSize={12}
          fill="#2f7bd4"
          pointerEvents="none"
        >
          ↗
        </text>
      ) : null}
      <path
        d={route.d}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        pointerEvents="stroke"
        style={{ cursor: "pointer" }}
        data-connector-id={connector.id}
        data-export-ignore="true"
      />
    </g>
  );
}

export const ConnectorView = memo(ConnectorViewInner);
