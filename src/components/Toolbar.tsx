import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { download, exportBoardPng, exportBoardSvg, printBoard, slug } from "../lib/export";
import { Icon } from "./icons";

const STAR_KEY = "kdsflux.star.board";

export function Toolbar() {
  const board = useStore((s) => s.board);
  const settings = useStore((s) => s.settings);
  const saveState = useStore((s) => s.saveState);
  const collab = useStore((s) => s.collab);
  const setBoardTitle = useStore((s) => s.setBoardTitle);
  const persistNow = useStore((s) => s.persistNow);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const returnToDashboard = useStore((s) => s.returnToDashboard);
  const setShareOpen = useStore((s) => s.setShareOpen);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const setIconPickerOpen = useStore((s) => s.setIconPickerOpen);
  const setMermaidOpen = useStore((s) => s.setMermaidOpen);
  const setCommentsOpen = useStore((s) => s.setCommentsOpen);
  const startPresentation = useStore((s) => s.startPresentation);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const importBoard = useStore((s) => s.importBoard);
  const duplicateBoard = useStore((s) => s.duplicateBoard);
  const removeBoard = useStore((s) => s.removeBoard);

  const [menu, setMenu] = useState<"file" | null>(null);
  const [starred, setStarred] = useState(() => {
    try {
      return localStorage.getItem(STAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menu]);

  const filter = settings.workspaceFilter || "all";
  const folder = settings.folders.find((f) => f.id === filter);
  const workspaceLabel =
    filter === "recent" ? "Recentes" : filter === "private" ? "Meus boards" : folder?.name ?? `Equipe ${settings.organization || "Minha organização"}`;

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    download(blob, `${slug(board.title)}.kdsflux.json`);
    setMenu(null);
  };

  const onImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const ok = await importBoard(raw);
      if (!ok) alert("Arquivo inválido.");
    } catch {
      alert("Arquivo inválido.");
    }
  };

  const saveLabel =
    saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo" : saveState === "error" ? "Erro ao salvar" : "Local";

  return (
    <header className="board-topbar">
      <div className="board-crumb">
        <button className="ws-menu-btn" title="Mostrar/ocultar sidebar" onClick={toggleSidebar}>
          <Icon name="panelLeft" size={17} />
        </button>
        <button className="board-crumb-current" onClick={() => void returnToDashboard()} title={workspaceLabel}>
          <Icon name="folder" size={16} />
          <span>{workspaceLabel}</span>
          <Icon name="chevronDown" size={13} />
        </button>
        <span className="board-crumb-sep">/</span>
        <input
          className="board-title-input"
          value={board.title}
          aria-label="Título do board"
          onChange={(e) => setBoardTitle(e.target.value)}
          onBlur={() => void persistNow()}
        />
        <button
          className={`ws-star ${starred ? "active" : ""}`}
          title="Adicionar aos favoritos"
          onClick={() => {
            const next = !starred;
            setStarred(next);
            try {
              localStorage.setItem(STAR_KEY, next ? "1" : "0");
            } catch {
              /* ignore */
            }
          }}
        >
          <Icon name="star" size={16} />
        </button>
        <span className={`save-pill ${saveState}`}>{saveLabel}</span>
        {collab.status === "connected" ? (
          <span className="live-pill" title="Colaboração ativa">
            <i /> {collab.peers.length + 1} online
          </span>
        ) : null}
      </div>

      <div className="board-top-actions">
        <div className="ws-presence" title="Presença da equipe">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ opacity: 0.45 + i * 0.13 }} />
          ))}
        </div>
        <button className="board-share" onClick={() => setShareOpen(true)}>
          <Icon name="share" size={15} />
          <span>Compartilhar</span>
        </button>
        <button className="board-icon-btn" title="Apresentar" onClick={startPresentation}>
          <Icon name="present" size={17} />
        </button>
        <button className="board-icon-btn" title="Comentários" onClick={() => setCommentsOpen(true)}>
          <Icon name="comment" size={17} />
        </button>
        <button className="board-icon-btn" title="Buscar no board (Ctrl+K)" onClick={() => setSearchOpen(true)}>
          <Icon name="search" size={17} />
        </button>
        <button className="board-icon-btn" title="Inserir ícone" onClick={() => setIconPickerOpen(true)}>
          <Icon name="sparkles" size={17} />
        </button>
        <button className="board-icon-btn" title="Colar Mermaid" onClick={() => setMermaidOpen(true)}>
          <Icon name="code" size={17} />
        </button>
        <button className="board-icon-btn" title={settings.theme === "dark" ? "Tema claro" : "Tema escuro"} onClick={toggleTheme}>
          <Icon name={settings.theme === "dark" ? "sun" : "moon"} size={17} />
        </button>
        <button className="board-icon-btn" title="Ajuda e atalhos" onClick={() => setHelpOpen(true)}>
          <Icon name="help" size={17} />
        </button>

        <div className="toolbar-menu-wrap" ref={menu ? menuRef : undefined}>
          <button className="board-icon-btn" title="Mais" onClick={() => setMenu(menu ? null : "file")}>
            <Icon name="more" size={18} />
          </button>
          {menu === "file" ? (
            <div className="tool-menu">
              <button onClick={() => { setMenu(null); setMermaidOpen(true); }}>Colar Mermaid…</button>
              <button onClick={() => { setMenu(null); fileRef.current?.click(); }}>Importar JSON</button>
              <button onClick={exportJSON}>Exportar JSON</button>
              <button onClick={() => { setMenu(null); void exportBoardSvg(board); }}>Exportar SVG</button>
              <button onClick={() => { setMenu(null); void exportBoardPng(board, { scale: 2 }); }}>Exportar PNG</button>
              <button onClick={() => { setMenu(null); void printBoard(board); }}>Exportar PDF</button>
              <div className="menu-sep" />
              <button onClick={() => { setMenu(null); void duplicateBoard(board.id); }}>Duplicar board</button>
              <button className="danger" onClick={() => { if (confirm("Excluir este board?")) { setMenu(null); void removeBoard(board.id); } }}>
                Excluir board
              </button>
            </div>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
            e.target.value = "";
          }}
        />
      </div>
    </header>
  );
}
