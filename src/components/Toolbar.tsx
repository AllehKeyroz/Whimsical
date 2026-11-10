import { useRef } from "react";
import { useStore } from "../store";
import { COLORS } from "../palette";
import type { Board, Tool } from "../types";

const TOOLS: { tool: Tool; label: string; icon: string; key: string }[] = [
  { tool: "select", label: "Selecionar", icon: "▣", key: "V" },
  { tool: "pan", label: "Mover tela", icon: "✥", key: "H" },
  { tool: "shape:rect", label: "Retângulo", icon: "▭", key: "R" },
  { tool: "shape:pill", label: "Pílula", icon: "⬭", key: "P" },
  { tool: "shape:ellipse", label: "Elipse", icon: "◯", key: "O" },
  { tool: "shape:diamond", label: "Decisão", icon: "◇", key: "D" },
  { tool: "text", label: "Texto", icon: "T", key: "T" },
  { tool: "frame", label: "Frame", icon: "▢", key: "F" },
  { tool: "connect", label: "Conector", icon: "↗", key: "C" },
];

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const board = useStore((s) => s.board);
  const camera = useStore((s) => s.camera);
  const zoomAt = useStore((s) => s.zoomAt);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const autoLayout = useStore((s) => s.autoLayout);
  const newBoard = useStore((s) => s.newBoard);
  const loadBoard = useStore((s) => s.loadBoard);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    download(blob, `${slug(board.title)}.whim.json`);
  };

  const exportSVG = () => {
    const svg = document.querySelector(".board-svg") as SVGSVGElement | null;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll(".resize-handle").forEach((n) => n.remove());
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    download(blob, `${slug(board.title)}.svg`);
  };

  const exportPNG = async () => {
    const svg = document.querySelector(".board-svg") as SVGSVGElement | null;
    if (!svg) return;
    const w = svg.clientWidth;
    const h = svg.clientHeight;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    try {
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = await getFontCss();
      clone.insertBefore(style, clone.firstChild);
    } catch {
      /* sem fonte embutida */
    }
    const data = new XMLSerializer().serializeToString(clone);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.fillStyle = "#fbfcfd";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => b && download(b, `${slug(board.title)}.png`));
    };
    img.onerror = () => alert("Falha ao exportar PNG");
    img.src = url;
  };

  const fitCanvas = () => {
    const el = document.querySelector(".canvas-container");
    useStore
      .getState()
      .fitView(el?.clientWidth || window.innerWidth, el?.clientHeight || window.innerHeight);
  };

  const zoomBy = (factor: number) => {
    const el = document.querySelector(".canvas-container");
    const w = el?.clientWidth ?? window.innerWidth;
    const h = el?.clientHeight ?? window.innerHeight;
    zoomAt({ x: w / 2, y: h / 2 }, factor);
  };

  const loadSeed = async () => {
    const res = await fetch("/seed-dayan.json");
    if (!res.ok) return;
    const b = (await res.json()) as Board;
    loadBoard(b);
    fitCanvas();
  };

  const onImport = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const b = JSON.parse(String(reader.result)) as Board;
        if (b && b.objects) loadBoard(b);
      } catch {
        alert("Arquivo inválido");
      }
    };
    reader.readAsText(f);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <span className="logo">◈</span>
        <input
          className="title-input"
          value={board.title}
          onChange={(e) => useStore.setState({ board: { ...board, title: e.target.value } })}
        />
      </div>

      <div className="toolbar-center">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            className={`tool-btn ${tool === t.tool ? "active" : ""}`}
            title={`${t.label} (${t.key})`}
            onClick={() => setTool(t.tool)}
          >
            <span className="tool-icon">{t.icon}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-right">
        <button className="tool-btn" title="Desfazer (Ctrl+Z)" onClick={undo}>↶</button>
        <button className="tool-btn" title="Refazer (Ctrl+Y)" onClick={redo}>↷</button>
        <button className="tool-btn" title="Layout automático (dagre)" onClick={autoLayout}>⌗</button>
        <button className="tool-btn" title="Centralizar" onClick={fitCanvas}>⤢</button>
        <button className="tool-btn" title="Abrir board de exemplo (Dayan Siebra)" onClick={loadSeed}>Exemplo</button>
        <span className="sep" />
        <button className="tool-btn" title="Exportar JSON" onClick={exportJSON}>JSON</button>
        <button className="tool-btn" title="Exportar SVG" onClick={exportSVG}>SVG</button>
        <button className="tool-btn" title="Exportar PNG" onClick={exportPNG}>PNG</button>
        <button className="tool-btn" title="Importar JSON" onClick={() => fileRef.current?.click()}>Import</button>
        <button className="tool-btn" title="Novo board" onClick={() => { if (confirm("Criar novo board?")) newBoard(); }}>＋</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
        />
        <span className="sep" />
        <button className="tool-btn" title="Zoom -" onClick={() => zoomBy(1 / 1.2)}>−</button>
        <span className="zoom-label">{Math.round(camera.zoom * 100)}%</span>
        <button className="tool-btn" title="Zoom +" onClick={() => zoomBy(1.2)}>＋</button>
      </div>
    </header>
  );
}

let fontCssCache: string | null = null;

async function getFontCss(): Promise<string> {
  if (fontCssCache) return fontCssCache;
  const res = await fetch("/fonts/Dinsical.woff2");
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  fontCssCache = `@font-face{font-family:"Dinsical";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:100 900;font-style:normal;}`;
  return fontCssCache;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "board";
}
