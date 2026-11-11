import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { ShapeType, Tool } from "../types";
import { Icon, ShapeIcon, type IconName } from "./icons";

const SHAPES: { type: ShapeType; label: string; key: string }[] = [
  { type: "rect", label: "Retângulo", key: "R" },
  { type: "pill", label: "Pílula", key: "P" },
  { type: "ellipse", label: "Elipse", key: "O" },
  { type: "diamond", label: "Decisão", key: "D" },
  { type: "triangle", label: "Triângulo", key: "" },
  { type: "hexagon", label: "Hexágono", key: "" },
  { type: "cylinder", label: "Cilindro", key: "" },
  { type: "parallelogram", label: "Paralelogramo", key: "" },
  { type: "document", label: "Documento", key: "" },
  { type: "sticky", label: "Nota adesiva", key: "S" },
];

const TOOLS: { tool: Tool; label: string; key: string; icon: IconName }[] = [
  { tool: "select", label: "Selecionar", key: "V", icon: "cursor" },
  { tool: "pan", label: "Mover tela", key: "H", icon: "hand" },
  { tool: "connect", label: "Conector", key: "C", icon: "connector" },
  { tool: "text", label: "Texto", key: "T", icon: "text" },
  { tool: "shape:sticky", label: "Nota adesiva", key: "S", icon: "sticky" },
  { tool: "frame", label: "Frame", key: "F", icon: "frame" },
  { tool: "image", label: "Imagem", key: "I", icon: "image" },
];

export function ToolPalette() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const returnToDashboard = useStore((s) => s.returnToDashboard);
  const setTemplatesOpen = useStore((s) => s.setTemplatesOpen);
  const toggleLayers = useStore((s) => s.toggleLayers);
  const setIconPickerOpen = useStore((s) => s.setIconPickerOpen);
  const [shapesOpen, setShapesOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!shapesOpen) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShapesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShapesOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [shapesOpen]);

  const pickShape = (type: ShapeType) => {
    setTool(`shape:${type}` as Tool);
    setShapesOpen(false);
  };

  const pickTool = (tool: Tool) => {
    setTool(tool);
    setShapesOpen(false);
  };

  return (
    <div ref={wrapRef} className="tool-palette" role="toolbar" aria-label="Ferramentas do board">
      <button className="tp-btn" title="Meus boards" onClick={() => { setShapesOpen(false); void returnToDashboard(); }}>
        <Icon name="dashboard" size={19} />
      </button>
      <button className="tp-btn" title="Templates" onClick={() => { setShapesOpen(false); setTemplatesOpen(true); }}>
        <Icon name="layout" size={19} />
      </button>
      <button className="tp-btn" title="Camadas" onClick={() => { setShapesOpen(false); toggleLayers(); }}>
        <Icon name="layers" size={19} />
      </button>
      <span className="tp-sep" />

      {TOOLS.slice(0, 2).map((t) => (
        <button
          key={t.tool}
          className={`tp-btn ${tool === t.tool ? "active" : ""}`}
          title={`${t.label} (${t.key})`}
          onClick={() => pickTool(t.tool)}
        >
          <Icon name={t.icon} size={19} />
        </button>
      ))}

      <button
        className={`tp-btn ${tool.startsWith("shape:") ? "active" : ""}`}
        title="Formas"
        onClick={() => setShapesOpen((v) => !v)}
      >
        <Icon name="rect" size={19} />
      </button>

      {TOOLS.slice(2).map((t) => (
        <button
          key={t.tool}
          className={`tp-btn ${tool === t.tool ? "active" : ""}`}
          title={`${t.label} (${t.key})`}
          onClick={() => pickTool(t.tool)}
        >
          <Icon name={t.icon} size={19} />
        </button>
      ))}

      <button
        className="tp-btn"
        title="Inserir ícone"
        onClick={() => {
          setShapesOpen(false);
          setIconPickerOpen(true);
        }}
      >
        <Icon name="sparkles" size={19} />
      </button>

      <span className="tp-sep" />
      <button className="tp-btn add" title="Adicionar forma" onClick={() => setShapesOpen((v) => !v)}>
        <Icon name="plus" size={19} />
      </button>

      {shapesOpen ? (
        <div className="shape-palette">
          <div className="shape-palette-title">Formas</div>
          <div className="shape-palette-grid">
            {SHAPES.map((s) => (
              <button
                key={s.type}
                className={`shape-palette-item ${tool === `shape:${s.type}` ? "active" : ""}`}
                title={s.label}
                onClick={() => pickShape(s.type)}
              >
                <ShapeIcon type={s.type} size={22} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
