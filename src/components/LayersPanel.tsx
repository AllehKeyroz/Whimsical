import { useMemo } from "react";
import { useStore } from "../store";
import type { BoardObject, Connector } from "../types";
import { hasText } from "../types";
import { iconLabel } from "../lib/iconLibrary";
import { Icon } from "./icons";

function labelOf(o: BoardObject): string {
  if (o.objectType === "connector") return o.label || "Conector";
  if (o.objectType === "image") return o.alt || "Imagem";
  if (o.objectType === "icon") return o.iconSet === "emoji" ? o.icon : iconLabel(o.icon);
  if (hasText(o)) return (o.text || "").split("\n")[0] || (o.objectType === "frame" ? "Frame" : o.objectType === "shape" ? "Forma" : "Texto");
  return "Objeto";
}

function iconOf(o: BoardObject) {
  if (o.objectType === "connector") return <Icon name="connector" size={14} />;
  if (o.objectType === "frame") return <Icon name="frame" size={14} />;
  if (o.objectType === "text") return <Icon name="text" size={14} />;
  if (o.objectType === "image") return <Icon name="image" size={14} />;
  if (o.objectType === "icon") return <Icon name="sparkles" size={14} />;
  return <Icon name="rect" size={14} />;
}

export function LayersPanel() {
  const board = useStore((s) => s.board);
  const selection = useStore((s) => s.selection);
  const open = useStore((s) => s.layersOpen);
  const toggleLayers = useStore((s) => s.toggleLayers);
  const select = useStore((s) => s.select);
  const toggleHidden = useStore((s) => s.toggleHidden);
  const toggleLocked = useStore((s) => s.toggleLocked);
  const reorderObject = useStore((s) => s.reorderObject);
  const zoomToObject = useStore((s) => s.zoomToObject);

  const { roots, childrenOf, connectors } = useMemo(() => {
    const all = Object.values(board.objects);
    const children = new Map<string, BoardObject[]>();
    for (const o of all) {
      if (o.objectType === "connector") continue;
      if (o.parentId) {
        const list = children.get(o.parentId) ?? [];
        list.push(o);
        children.set(o.parentId, list);
      }
    }
    for (const list of children.values()) list.sort((a, b) => b.order - a.order);
    return {
      roots: all.filter((o) => o.objectType !== "connector" && !o.parentId).sort((a, b) => b.order - a.order),
      childrenOf: children,
      connectors: all.filter((o): o is Connector => o.objectType === "connector").sort((a, b) => b.order - a.order),
    };
  }, [board.objects]);

  if (!open) return null;

  const renderRow = (o: BoardObject, depth: number) => {
    const active = selection.includes(o.id);
    const kids = childrenOf.get(o.id) ?? [];
    return (
      <div key={o.id} className="layer-group">
        <div
          className={`layer-row ${active ? "active" : ""} ${o.hidden ? "hidden" : ""} ${o.locked ? "locked" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => select(o.id, false)}
          onDoubleClick={() => zoomToObject(o.id)}
          title={labelOf(o)}
        >
          <span className="layer-icon">{iconOf(o)}</span>
          <span className="layer-name">
            {o.groupId ? <span className="layer-group-dot" title="Agrupado" /> : null}
            {labelOf(o)}
            {o.objectType === "frame" && kids.length ? <small>{kids.length}</small> : null}
          </span>
          <span className="layer-actions" onClick={(e) => e.stopPropagation()}>
            <button title={o.hidden ? "Mostrar" : "Ocultar"} onClick={() => toggleHidden(o.id)}>
              <Icon name={o.hidden ? "eyeOff" : "eye"} size={13} />
            </button>
            <button title={o.locked ? "Desbloquear" : "Bloquear"} onClick={() => toggleLocked(o.id)}>
              <Icon name={o.locked ? "lock" : "unlock"} size={13} />
            </button>
            <button title="Subir camada" onClick={() => reorderObject(o.id, 1)}>
              <Icon name="chevronUp" size={13} />
            </button>
            <button title="Descer camada" onClick={() => reorderObject(o.id, -1)}>
              <Icon name="chevronDown" size={13} />
            </button>
          </span>
        </div>
        {kids.map((k) => renderRow(k, depth + 1))}
      </div>
    );
  };

  return (
    <aside className="layers-panel" aria-label="Camadas">
      <div className="layers-head">
        <span>Camadas</span>
        <button title="Fechar painel" onClick={toggleLayers}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="layers-scroll">
        {roots.length === 0 ? <div className="layers-empty">Nenhum objeto ainda.</div> : roots.map((o) => renderRow(o, 0))}
        {connectors.length ? <div className="layers-section">Conectores</div> : null}
        {connectors.map((c) => (
          <div
            key={c.id}
            className={`layer-row ${selection.includes(c.id) ? "active" : ""} ${c.hidden ? "hidden" : ""}`}
            style={{ paddingLeft: 8 }}
            onClick={() => select(c.id, false)}
            title={labelOf(c)}
          >
            <span className="layer-icon">{iconOf(c)}</span>
            <span className="layer-name">{labelOf(c)}</span>
            <span className="layer-actions" onClick={(e) => e.stopPropagation()}>
              <button title={c.hidden ? "Mostrar" : "Ocultar"} onClick={() => toggleHidden(c.id)}>
                <Icon name={c.hidden ? "eyeOff" : "eye"} size={13} />
              </button>
              <button title={c.locked ? "Desbloquear" : "Bloquear"} onClick={() => toggleLocked(c.id)}>
                <Icon name={c.locked ? "lock" : "unlock"} size={13} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
