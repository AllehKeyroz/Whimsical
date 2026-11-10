import { memo } from "react";
import type { Connector, Rect } from "../types";
import { endpointMarkup, routeConnector } from "../geometry";
import { colorToken } from "../palette";

interface Props {
  connector: Connector;
  fromRect: Rect | null;
  toRect: Rect | null;
  obstacles: Rect[];
  selected: boolean;
}

function ConnectorViewInner({ connector, fromRect, toRect, obstacles, selected }: Props) {
  const route = routeConnector(connector, fromRect, toRect, obstacles);
  const stroke = selected ? "#8b3fd9" : colorToken(connector.style.color).base;
  const dashed = connector.style.deco === "dash";
  const width = selected ? 4 : connector.style.deco === "fill" ? 4.5 : 3.5;

  const points = route.points;
  const start = points[0];
  const end = points[points.length - 1];
  const prevEnd = points[points.length - 2] ?? start;
  const nextStart = points[1] ?? end;
  const startDir = { x: start.x - nextStart.x, y: start.y - nextStart.y };
  const endDir = { x: end.x - prevEnd.x, y: end.y - prevEnd.y };

  const startMarkers = endpointMarkup(start, startDir, connector.fromEndpoint, connector.fromCardinality);
  const endMarkers = endpointMarkup(end, endDir, connector.toEndpoint, connector.toCardinality);

  return (
    <g>
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
        <text
          x={route.mid.x}
          y={route.mid.y - 6}
          textAnchor="middle"
          fontFamily="Dinsical, system-ui, sans-serif"
          fontSize={13}
          fill={stroke}
        >
          {connector.label}
        </text>
      ) : null}
      <path
        d={route.d}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        pointerEvents="stroke"
        style={{ cursor: "pointer" }}
        data-connector-id={connector.id}
      />
    </g>
  );
}

export const ConnectorView = memo(ConnectorViewInner);
