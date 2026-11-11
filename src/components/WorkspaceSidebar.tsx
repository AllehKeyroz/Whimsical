import { useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { useStore } from "../store";
import { getBoard, saveBoard } from "../lib/storage";
import type { BoardMeta, Folder } from "../types";
import { Icon } from "./icons";

const WORKSPACE = "KDS BRASIL";
const TEAM = "Everyone at KDS BRASIL";
const PROMO_KEY = "whim.promo.dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

function boardIcon(b: BoardMeta) {
  return b.folderId ? "file" : "board";
}

export function WorkspaceSidebar() {
  const boards = useStore((s) => s.boards);
  const settings = useStore((s) => s.settings);
  const board = useStore((s) => s.board);
  const view = useStore((s) => s.view);
  const openBoard = useStore((s) => s.openBoard);
  const createNewBoard = useStore((s) => s.createNewBoard);
  const returnToDashboard = useStore((s) => s.returnToDashboard);
  const updateSettings = useStore((s) => s.updateSettings);
  const setTemplatesOpen = useStore((s) => s.setTemplatesOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const refreshBoards = useStore((s) => s.refreshBoards);
  const cloud = useStore((s) => s.cloud);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [privateOpen, setPrivateOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [promoDismissed, setPromoDismissed] = useState(() => {
    try {
      return localStorage.getItem(PROMO_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const filter = settings.workspaceFilter || "all";
  const setFilter = (workspaceFilter: string) => updateSettings({ workspaceFilter });

  const rootBoards = useMemo(() => boards.filter((b) => !b.folderId), [boards]);
  const byFolder = useMemo(() => {
    const map = new Map<string, BoardMeta[]>();
    for (const b of boards) {
      if (!b.folderId) continue;
      const list = map.get(b.folderId) ?? [];
      list.push(b);
      map.set(b.folderId, list);
    }
    return map;
  }, [boards]);

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
    } else {
      alert("Use o menu do navegador → Instalar app / Adicionar à tela inicial.");
    }
  };

  const dismissPromo = () => {
    setPromoDismissed(false);
    try {
      localStorage.setItem(PROMO_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const newBoard = () => {
    const folderId = filter !== "all" && filter !== "recent" && filter !== "private" ? filter : null;
    void createNewBoard("blank", undefined, folderId);
  };

  const createFolder = () => {
    const name = window.prompt("Nome da pasta");
    if (!name?.trim()) return;
    const folder: Folder = { id: nanoid(), name: name.trim().slice(0, 60), createdAt: Date.now() };
    updateSettings({ folders: [...settings.folders, folder], workspaceFilter: folder.id });
  };

  const removeFolder = async (folder: Folder) => {
    if (!confirm(`Remover a pasta “${folder.name}”? Os boards continuam em Todos.`)) return;
    const affected = boards.filter((b) => b.folderId === folder.id);
    for (const meta of affected) {
      const b = await getBoard(meta.id);
      if (!b) continue;
      b.folderId = null;
      b.updatedAt = Date.now();
      await saveBoard(b);
    }
    updateSettings({
      folders: settings.folders.filter((f) => f.id !== folder.id),
      workspaceFilter: filter === folder.id ? "all" : filter,
    });
    await refreshBoards();
  };

  const activeBoardId = view === "board" ? board.id : null;

  const renderBoard = (b: BoardMeta, indented = false) => (
    <button
      key={b.id}
      className={`ws-file-row ${activeBoardId === b.id ? "active" : ""} ${indented ? "indented" : ""}`}
      onClick={() => void openBoard(b.id)}
      title={`${b.title} · ${b.count} objetos`}
    >
      <Icon name={boardIcon(b) as never} size={14} />
      <span>{b.title}</span>
      <small>{b.count}</small>
    </button>
  );

  return (
    <aside className="ws-sidebar">
      <div className="ws-switch-row">
        <button className="ws-collapse" title="Recolher sidebar" onClick={toggleSidebar}>
          <Icon name="panelLeft" size={17} />
        </button>
        <button
          className="ws-brand"
          onClick={() => (view === "board" ? void returnToDashboard() : setFilter("all"))}
          title={WORKSPACE}
        >
          <span className="ws-logo">K</span>
          <span className="ws-brand-name">{WORKSPACE}</span>
          <Icon name="chevronDown" size={14} />
        </button>
        <button className="ws-plus" title="Novo board" onClick={newBoard}>
          <Icon name="plus" size={16} />
        </button>
      </div>

      <nav className="ws-nav" aria-label="Workspace">
        <button className={`ws-nav-item ${filter === "recent" ? "active" : ""}`} onClick={() => setFilter("recent")}>
          <Icon name="clock" size={16} />
          <span>Recentes</span>
        </button>

        <div className="ws-section">
          <button className="ws-section-head" onClick={() => setPrivateOpen((v) => !v)}>
            <Icon name={privateOpen ? "chevronDown" : "chevronRight"} size={13} />
            <span>PRIVADO</span>
          </button>
          {privateOpen ? (
            <button
              className={`ws-nav-item ws-sub ${filter === "private" ? "active" : ""}`}
              onClick={() => setFilter("private")}
            >
              <Icon name="folder" size={15} />
              <span>Meus boards</span>
              <em>{rootBoards.length}</em>
            </button>
          ) : null}
        </div>

        <div className="ws-section">
          <button className="ws-section-head" onClick={() => setTeamsOpen((v) => !v)}>
            <Icon name={teamsOpen ? "chevronDown" : "chevronRight"} size={13} />
            <span>EQUIPES</span>
          </button>
          {teamsOpen ? (
            <button
              className={`ws-nav-item ws-sub ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              <Icon name="folder" size={15} />
              <span>{TEAM}</span>
            </button>
          ) : null}
        </div>

        <div className="ws-files-head">
          <span>ARQUIVOS</span>
          <span className="ws-files-actions">
            <button title="Nova pasta" onClick={createFolder}>
              <Icon name="folder" size={14} />
              <Icon name="plus" size={10} />
            </button>
            <button title="Novo board" onClick={newBoard}>
              <Icon name="plus" size={14} />
            </button>
          </span>
        </div>

        <div className="ws-files">
          {settings.folders.map((folder) => {
            const list = byFolder.get(folder.id) ?? [];
            return (
              <div key={folder.id} className="ws-folder-group">
                <div className={`ws-folder-row ${filter === folder.id ? "active" : ""}`}>
                  <button className="ws-folder-open" onClick={() => setFilter(folder.id)} title={folder.name}>
                    <Icon name="folder" size={15} />
                    <span>{folder.name}</span>
                    <em>{list.length}</em>
                  </button>
                  <button className="ws-folder-remove" title="Remover pasta" onClick={() => void removeFolder(folder)}>
                    <Icon name="close" size={12} />
                  </button>
                </div>
                {list.map((b) => renderBoard(b, true))}
              </div>
            );
          })}
          {rootBoards.length ? <div className="ws-files-label">Sem pasta</div> : null}
          {rootBoards.map((b) => renderBoard(b))}
          {boards.length === 0 ? <div className="ws-files-empty">Nenhum board ainda.</div> : null}
        </div>
      </nav>

      <button className={`ws-cloud ${cloud.user ? cloud.status : ""}`} onClick={() => setAuthOpen(true)}>
        <span className="ws-cloud-icon">
          <Icon name={cloud.configured ? "cloud" : "cloudOff"} size={18} />
        </span>
        <span className="ws-cloud-text">
          <b>{cloud.user ? cloud.user.name : cloud.configured ? "Entrar na nuvem" : "Conectar Supabase"}</b>
          <small>
            {cloud.user
              ? cloud.status === "error"
                ? "Erro de sincronização"
                : cloud.syncing
                  ? "Sincronizando…"
                  : "Nuvem conectada"
              : cloud.configured
                ? "Supabase configurado"
                : "Sincronize entre dispositivos"}
          </small>
        </span>
        {cloud.user ? <span className={`cloud-dot ${cloud.status}`} /> : <Icon name="chevronRight" size={14} />}
      </button>

      {promoDismissed ? (
        <div className="ws-promo">
          <button className="ws-promo-dismiss" title="Dispensar" onClick={dismissPromo}>
            <Icon name="close" size={13} />
          </button>
          <button className="ws-promo-body" onClick={() => void installApp()}>
            <span className="ws-promo-icon">
              <Icon name="download" size={21} />
            </span>
            <span>
              <b>Baixe o app</b>
              <small>Melhor experiência no desktop</small>
            </span>
          </button>
        </div>
      ) : null}

      <button className="ws-footer" onClick={() => setTemplatesOpen(true)}>
        <Icon name="palette" size={16} />
        <span>Templates & temas</span>
      </button>
    </aside>
  );
}
