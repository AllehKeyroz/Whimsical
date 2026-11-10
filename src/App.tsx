import { useEffect } from "react";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { AlignBar } from "./components/AlignBar";
import { useStore, loadPersistedBoard, persistBoard } from "./store";
import type { Board } from "./types";

function fitCanvas() {
  const el = document.querySelector(".canvas-container");
  useStore
    .getState()
    .fitView(el?.clientWidth || window.innerWidth, el?.clientHeight || window.innerHeight);
}

export default function App() {
  useEffect(() => {
    const boot = async () => {
      const persisted = loadPersistedBoard();
      if (persisted) {
        useStore.getState().loadBoard(persisted);
        fitCanvas();
        return;
      }
      try {
        const res = await fetch("/seed-dayan.json");
        if (!res.ok) return;
        const board = (await res.json()) as Board;
        useStore.getState().loadBoard(board);
        fitCanvas();
      } catch {
        /* seed opcional */
      }
    };
    boot();

    let timer: number | undefined;
    const unsub = useStore.subscribe((s, prev) => {
      if (s.board !== prev.board) {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => persistBoard(s.board), 400);
      }
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <Canvas />
      <AlignBar />
      <div className="hint">
        Botão direito abre as opções · Duplo clique edita o texto · Ctrl+C/V copia · Ctrl+scroll dá zoom
      </div>
    </div>
  );
}
