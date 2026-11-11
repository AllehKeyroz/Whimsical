import { useMemo } from "react";
import { useStore } from "../store";
import { COLORS } from "../palette";
import { aabbOfRect, routeConnector } from "../geometry";
import type { Connector } from "../types";

const MIND_COLORS = COLORS.filter((c) => !["white", "smoke", "slate", "gray"].includes(c.name));

/**
 * Compact branch-color picker for mind maps. It replaces the regular context
 * bar (which is hidden for mind maps) and only appears when a branch line is
 * selected.
 */
export function MindColorBar() {
  const board = useStore((s) => s.board);
  const selection = useStore((s) => s.selection);
  const camera = useStore((s) => s.camera);
  const editingId = useStore((s) => s.editingId);
  const presentation = useStore((s) => s.presentation);
  const setStyle = useStore((s) => s.setStyle);

  const connector =
    selection.length === 1 ? board.objects[selection[0]] : null;
  const target = connector && connector.objectType === "connector" ? (connector as Connector) : null;

  const pos = useMemo(() => {
    if (!target) return null;
    const from = board.objects[target.fromId];
    const to = board.objects[target.toId];
    const fromRect =
      from && from.objectType !== "connector" && "rect" in from
        ? aabbOfRect(from.rect, from.rotation ?? 0)
        : null;
    const toRect =
      to && to.objectType !== "connector" && "rect" in to
        ? aabbOfRect(to.rect, to.rotation ?? 0)
        : null;
    const route = routeConnector(target, fromRect, toRect);
    return {
      x: route.mid.x * camera.zoom + camera.x,
      y: route.mid.y * camera.zoom + camera.y - 44,
    };
  }, [target, board.objects, camera]);

  if (!target || !target.mind || !pos || editingId || presentation) return null;

  return (
    <div
      className="mind-colorbar"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span>Cor do ramo</span>
      {MIND_COLORS.map((color) => (
        <button
          key={color.name}
          className={target.style.color === color.name ? "active" : ""}
          style={{ background: color.base }}
          title={color.label}
          onClick={() => setStyle(target.id, { color: color.name, deco: "outline" })}
        />
      ))}
    </div>
  );
}
