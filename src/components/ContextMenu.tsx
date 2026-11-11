import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { Icon } from "./icons";

export function ContextMenu() {
  const menu = useStore((s) => s.contextMenu);
  const camera = useStore((s) => s.camera);
  const settings = useStore((s) => s.settings);
  const close = useStore((s) => s.openContextMenu);
  const paste = useStore((s) => s.paste);
  const selectAll = useStore((s) => s.selectAll);
  const fitView = useStore((s) => s.fitView);
  const toggleGrid = useStore((s) => s.toggleGrid);
  const toggleSnap = useStore((s) => s.toggleSnap);
  const addText = useStore((s) => s.addText);
  const addShape = useStore((s) => s.addShape);
  const addFrame = useStore((s) => s.addFrame);
  const returnToDashboard = useStore((s) => s.returnToDashboard);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(null);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, close]);

  if (!menu) return null;
  const world = { x: (menu.x - camera.x) / camera.zoom, y: (menu.y - camera.y) / camera.zoom };

  const run = (fn: () => void | Promise<void>) => {
    close(null);
    void fn();
  };

  return (
    <div
      ref={ref}
      className="canvas-menu"
      style={{ left: Math.min(menu.x, window.innerWidth - 240), top: Math.min(menu.y, window.innerHeight - 360) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button onClick={() => run(paste)}>
        <Icon name="copy" /> Colar <kbd>Ctrl+V</kbd>
      </button>
      <button onClick={() => run(selectAll)}>
        <Icon name="layers" /> Selecionar tudo <kbd>Ctrl+A</kbd>
      </button>
      <div className="menu-sep" />
      <button
        onClick={() =>
          run(() => {
            addText({ x: world.x, y: world.y, w: 220, h: 36 });
          })
        }
      >
        <Icon name="text" /> Novo texto
      </button>
      <button
        onClick={() =>
          run(() => {
            addShape("sticky", { x: world.x, y: world.y, w: 220, h: 150 });
          })
        }
      >
        <Icon name="sticky" /> Nova nota
      </button>
      <button
        onClick={() =>
          run(() => {
            addFrame({ x: world.x, y: world.y, w: 480, h: 360 });
          })
        }
      >
        <Icon name="frame" /> Novo frame
      </button>
      <div className="menu-sep" />
      <button
        onClick={() =>
          run(() => {
            const canvas = document.querySelector<HTMLElement>(".canvas-container");
            fitView(canvas?.clientWidth ?? window.innerWidth, canvas?.clientHeight ?? window.innerHeight);
          })
        }
      >
        <Icon name="fit" /> Centralizar board <kbd>0</kbd>
      </button>
      <button onClick={() => run(toggleGrid)}>
        <Icon name="grid" /> Grade {settings.grid ? "ligada" : "desligada"}
      </button>
      <button onClick={() => run(toggleSnap)}>
        <Icon name="magnet" /> Encaixe {settings.snap ? "ligado" : "desligado"}
      </button>
      <div className="menu-sep" />
      <button onClick={() => run(returnToDashboard)}>
        <Icon name="dashboard" /> Meus boards
      </button>
    </div>
  );
}
