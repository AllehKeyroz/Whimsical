import { useEffect, useRef, useState } from "react";
import type { Connector } from "../types";
import type { RouteResult } from "../geometry";
import { useStore } from "../store";

interface Props {
  connector: Connector;
  route: RouteResult;
  zoom: number;
  toScreen: (p: { x: number; y: number }) => { x: number; y: number };
}

export function ConnectorLabelEditor({ connector, route, zoom, toScreen }: Props) {
  const updateObject = useStore((s) => s.updateObject);
  const setEditing = useStore((s) => s.setEditing);
  const pushHistory = useStore((s) => s.pushHistory);
  const [value, setValue] = useState(connector.label);
  const historyPushed = useRef(false);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const p = toScreen(route.mid);
  const fontPx = Math.max(10, 13 * zoom);
  return (
    <input
      ref={ref}
      className="text-editor label-editor"
      value={value}
      onChange={(e) => {
        if (!historyPushed.current) {
          pushHistory();
          historyPushed.current = true;
        }
        setValue(e.target.value);
        updateObject(connector.id, { label: e.target.value } as never, false);
      }}
      onBlur={() => setEditing(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          updateObject(connector.id, { label: value } as never, false);
          setEditing(null);
        }
      }}
      style={{
        left: p.x - Math.max(70, value.length * fontPx * 0.28),
        top: p.y - fontPx * 1.7,
        width: Math.max(140, value.length * fontPx * 0.62 + 24),
        height: fontPx * 2.1,
        fontSize: fontPx,
        padding: `${2 * zoom}px ${6 * zoom}px`,
      }}
    />
  );
}
