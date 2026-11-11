import { useStore } from "../store";
import { Icon } from "./icons";

export function BoardBottomBar() {
  const camera = useStore((s) => s.camera);
  const layersOpen = useStore((s) => s.layersOpen);
  const past = useStore((s) => s.past);
  const future = useStore((s) => s.future);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const zoomAt = useStore((s) => s.zoomAt);
  const fitView = useStore((s) => s.fitView);
  const autoLayout = useStore((s) => s.autoLayout);
  const mindMapLayout = useStore((s) => s.mindMapLayout);
  const setHelpOpen = useStore((s) => s.setHelpOpen);

  const zoomBy = (factor: number) => {
    const el = document.querySelector<HTMLElement>(".canvas-container");
    zoomAt({ x: (el?.clientWidth ?? window.innerWidth) / 2, y: (el?.clientHeight ?? window.innerHeight) / 2 }, factor);
  };

  const resetZoom = () => {
    const el = document.querySelector<HTMLElement>(".canvas-container");
    zoomAt({ x: (el?.clientWidth ?? window.innerWidth) / 2, y: (el?.clientHeight ?? window.innerHeight) / 2 }, 1 / camera.zoom);
  };

  return (
    <div className="canvas-bottom" style={{ right: layersOpen ? 292 : 16 }}>
      <button className="cb-btn" title="Desfazer (Ctrl+Z)" disabled={!past.length} onClick={undo}>
        <Icon name="undo" size={18} />
      </button>
      <button className="cb-btn" title="Refazer (Ctrl+Y)" disabled={!future.length} onClick={redo}>
        <Icon name="redo" size={18} />
      </button>
      <span className="cb-sep" />
      <button className="cb-btn" title="Layout automático (dagre)" onClick={autoLayout}>
        <Icon name="layout" size={18} />
      </button>
      <button className="cb-btn" title="Layout de mapa mental" onClick={mindMapLayout}>
        <Icon name="sparkles" size={18} />
      </button>
      <span className="cb-sep" />
      <button className="cb-btn" title="Diminuir zoom" onClick={() => zoomBy(1 / 1.2)}>
        <Icon name="zoomOut" size={18} />
      </button>
      <button className="cb-zoom" title="Clique para 100%" onClick={resetZoom}>
        {Math.round(camera.zoom * 100)}%
      </button>
      <button className="cb-btn" title="Aumentar zoom" onClick={() => zoomBy(1.2)}>
        <Icon name="zoomIn" size={18} />
      </button>
      <button className="cb-btn" title="Centralizar (0)" onClick={() => {
        const el = document.querySelector<HTMLElement>(".canvas-container");
        fitView(el?.clientWidth ?? window.innerWidth, el?.clientHeight ?? window.innerHeight);
      }}>
        <Icon name="fit" size={18} />
      </button>
      <span className="cb-sep" />
      <button className="cb-btn" title="Ajuda e atalhos" onClick={() => setHelpOpen(true)}>
        <Icon name="help" size={18} />
      </button>
    </div>
  );
}
