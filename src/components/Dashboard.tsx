import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useStore } from "../store";
import type { Board, BoardMeta, BoardObject, Folder } from "../types";
import { aabbOfRect, boundsOf, rectCenter } from "../geometry";
import { getBoard } from "../lib/storage";
import type { TemplateId } from "../lib/templates";
import { thumbnailColor } from "../lib/export";
import { Icon, type IconName } from "./icons";
import { Modal } from "./Modals";

const STAR_KEY = "kdsflux.star.workspace";

function when(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return `hoje ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function BoardThumb({ board, width = 300, height = 150 }: { board: Board; width?: number; height?: number }) {
  const render = useMemo(() => {
    const objects = Object.values(board.objects).filter((o) => !o.hidden);
    const rects = objects
      .filter((o): o is Exclude<BoardObject, { objectType: "connector" }> => o.objectType !== "connector" && "rect" in o)
      .map((o) => aabbOfRect(o.rect, o.rotation ?? 0));
    const b = boundsOf(rects);
    if (!rects.length) return null;
    const pad = 20;
    const vbW = Math.max(1, b.w + pad * 2);
    const vbH = Math.max(1, b.h + pad * 2);
    const scale = Math.min((width - 16) / vbW, (height - 16) / vbH);
    const ox = (width - vbW * scale) / 2 - b.x * scale + pad * scale;
    const oy = (height - vbH * scale) / 2 - b.y * scale + pad * scale;
    const elements: React.ReactNode[] = [];
    for (const o of objects) {
      if (o.objectType === "connector") continue;
      if (!("rect" in o)) continue;
      const r = o.rect;
      const x = r.x * scale + ox;
      const y = r.y * scale + oy;
      const w = Math.max(2, r.w * scale);
      const h = Math.max(2, r.h * scale);
      if (o.objectType === "frame") {
        elements.push(
          <rect key={o.id} x={x} y={y} width={w} height={h} fill="none" stroke="#405063" strokeWidth={1} rx={2} />,
        );
      } else if (o.objectType === "image") {
        elements.push(<rect key={o.id} x={x} y={y} width={w} height={h} fill="#2a3542" rx={2} />);
      } else if (o.objectType === "icon") {
        elements.push(
          <circle
            key={o.id}
            cx={x + w / 2}
            cy={y + h / 2}
            r={Math.max(2, Math.min(w, h) * 0.35)}
            fill={thumbnailColor(o.style)}
          />,
        );
      } else if (o.objectType === "text") {
        elements.push(
          <rect key={o.id} x={x} y={y + h * 0.25} width={w * 0.9} height={Math.max(2, h * 0.35)} fill="#6e7f92" rx={1} />,
        );
      } else {
        elements.push(
          <rect
            key={o.id}
            x={x}
            y={y}
            width={w}
            height={h}
            fill={thumbnailColor(o.style)}
            stroke="rgba(0,0,0,.18)"
            strokeWidth={0.6}
            rx={Math.min(3, h / 3)}
          />,
        );
      }
    }
    for (const c of objects) {
      if (c.objectType !== "connector") continue;
      const from = board.objects[c.fromId];
      const to = board.objects[c.toId];
      if (!from || !to || from.objectType === "connector" || to.objectType === "connector") continue;
      if (!("rect" in from) || !("rect" in to)) continue;
      const a = rectCenter(from.rect);
      const d = rectCenter(to.rect);
      elements.push(
        <line
          key={c.id}
          x1={a.x * scale + ox}
          y1={a.y * scale + oy}
          x2={d.x * scale + ox}
          y2={d.y * scale + oy}
          stroke="#6b7d91"
          strokeWidth={0.8}
          opacity={0.75}
        />,
      );
    }
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {elements}
      </svg>
    );
  }, [board.objects, width, height]);

  if (!render) {
    return (
      <div className="thumb-empty" style={{ width, height }}>
        <Icon name="frame" size={28} />
        <span>Board vazio</span>
      </div>
    );
  }
  return <div className="board-thumb">{render}</div>;
}

function EmptyFolderArt() {
  return (
    <svg className="ws-empty-art" width="190" height="150" viewBox="0 0 190 150" aria-hidden="true">
      <defs>
        <linearGradient id="folderGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b3fd9" />
          <stop offset="1" stopColor="#5b0fb0" />
        </linearGradient>
      </defs>
      <g style={{ filter: "drop-shadow(0 0 18px rgba(139,63,217,.35))" }}>
        <path
          d="M22 42c0-6 4-10 10-10h41l13 14h72c6 0 10 4 10 10v60c0 6-4 10-10 10H32c-6 0-10-4-10-10z"
          fill="#171022"
          stroke="url(#folderGrad)"
          strokeWidth="3"
        />
        <path d="M22 60h152" stroke="url(#folderGrad)" strokeWidth="2" opacity=".8" />
        <g stroke="#a983e8" strokeWidth="2" fill="none" strokeLinecap="round">
          <circle cx="73" cy="84" r="8" />
          <path d="M60 108a13 13 0 0 1 26 0" />
          <circle cx="102" cy="78" r="9" />
          <path d="M87 106a15 15 0 0 1 30 0" />
          <circle cx="131" cy="86" r="7" />
          <path d="M120 108a11 11 0 0 1 22 0" />
        </g>
      </g>
    </svg>
  );
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function UserCell({ name }: { name: string }) {
  return (
    <span className="ws-user-cell">
      <span className="ws-user-dot">{name.trim().charAt(0).toUpperCase() || "A"}</span>
      {name}
    </span>
  );
}

function FolderCard({
  folder,
  count,
  onOpen,
  onDelete,
}: {
  folder: Folder;
  count: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="ws-folder-card">
      <button className="ws-folder-open" onClick={onOpen} title={`Abrir ${folder.name}`}>
        <Icon name="folder" size={26} />
        <b>{folder.name}</b>
        <small>{count} board{count === 1 ? "" : "s"}</small>
      </button>
      <button
        className="ws-folder-delete"
        title="Excluir pasta"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Icon name="trash" size={14} />
      </button>
    </article>
  );
}

function FolderTable({
  folders,
  counts,
  owner,
  onOpen,
  onDelete,
}: {
  folders: Folder[];
  counts: Record<string, number>;
  owner: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Criado</th>
            <th>Por</th>
            <th>Modificado</th>
            <th>Por</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => (
            <tr key={folder.id} onClick={() => onOpen(folder.id)}>
              <td>
                <span className="ws-table-name">
                  <Icon name="folder" size={17} />
                  {folder.name}
                  <small>{counts[folder.id] ?? 0}</small>
                </span>
              </td>
              <td>{fmtDate(folder.createdAt)}</td>
              <td>
                <UserCell name={owner} />
              </td>
              <td>{fmtDate(folder.createdAt)}</td>
              <td>
                <UserCell name={owner} />
              </td>
              <td>
                <button
                  className="ws-row-action"
                  title="Excluir pasta"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(folder.id);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoardTable({
  boards,
  owner,
  onOpen,
  onDelete,
}: {
  boards: BoardMeta[];
  owner: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Criado</th>
            <th>Por</th>
            <th>Modificado</th>
            <th>Por</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {boards.map((board) => (
            <tr key={board.id} onClick={() => onOpen(board.id)}>
              <td>
                <span className="ws-table-name">
                  <Icon name="board" size={17} />
                  {board.title}
                  <small>{board.count} objeto{board.count === 1 ? "" : "s"}</small>
                </span>
              </td>
              <td>{fmtDate(board.createdAt)}</td>
              <td>
                <UserCell name={owner} />
              </td>
              <td>{fmtDate(board.updatedAt)}</td>
              <td>
                <UserCell name={owner} />
              </td>
              <td>
                <button
                  className="ws-row-action"
                  title="Excluir board"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(board.id);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function EmptyWorkspace({ onCreate, onSearch }: { onCreate: () => void; onSearch: () => void }) {
  return (
    <div className="ws-empty">
      <EmptyFolderArt />
      <div className="ws-shortcuts">
        <button onClick={onCreate}>
          <span>Criar novo…</span>
          <span className="keys">
            <kbd>Alt</kbd>
            <kbd>Ctrl</kbd>
            <kbd>N</kbd>
          </span>
        </button>
        <button onClick={onSearch}>
          <span>Buscar comandos</span>
          <span className="keys">
            <kbd>Ctrl</kbd>
            <kbd>K</kbd>
          </span>
        </button>
      </div>
    </div>
  );
}

function ActionCard({
  variant,
  icon,
  label,
  onClick,
}: {
  variant: "board" | "doc" | "template" | "folder";
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`ws-action ${variant}`} onClick={onClick}>
      <Icon name={icon} size={34} />
      <b>+ {label}</b>
    </button>
  );
}

function BoardCard({
  meta,
  board,
  folders,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
}: {
  meta: BoardMeta;
  board: Board | undefined;
  folders: Folder[];
  onOpen: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <article className="ws-board-card">
      <button className="ws-board-open" onClick={onOpen} title={`Abrir ${meta.title}`}>
        <BoardThumb board={board ?? fallbackBoard(meta.id, meta.title)} />
      </button>
      <div className="ws-board-meta">
        <div className="ws-board-title-row">
          {renaming !== null ? (
            <input
              autoFocus
              value={renaming}
              onChange={(e) => setRenaming(e.target.value)}
              onBlur={() => {
                onRename(renaming);
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRename(renaming);
                  setRenaming(null);
                }
                if (e.key === "Escape") setRenaming(null);
              }}
            />
          ) : (
            <b title="Abrir board" onClick={onOpen}>
              {meta.title}
            </b>
          )}
          <div className="ws-board-actions">
            <button title="Renomear" onClick={() => setRenaming(meta.title)}>
              <Icon name="type" size={13} />
            </button>
            <button title="Duplicar" onClick={onDuplicate}>
              <Icon name="copy" size={13} />
            </button>
            <button title="Excluir" className="danger" onClick={onDelete}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        </div>
        <div className="ws-board-sub">
          <small>
            {meta.count} objeto{meta.count === 1 ? "" : "s"} · {when(meta.updatedAt)}
          </small>
          <select
            className="ws-board-folder"
            value={meta.folderId ?? ""}
            title="Mover para pasta"
            onChange={(e) => onMove(e.target.value || null)}
          >
            <option value="">Sem pasta</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </article>
  );
}

function fallbackBoard(id: string, title: string): Board {
  return { id, title, fontFamily: "Dinsical", objects: {}, version: 2, createdAt: Date.now(), updatedAt: Date.now() };
}

export function Dashboard() {
  const boards = useStore((s) => s.boards);
  const settings = useStore((s) => s.settings);
  const organization = settings.organization || "Minha organização";
  const team = `Equipe ${organization}`;
  const openBoard = useStore((s) => s.openBoard);
  const createNewBoard = useStore((s) => s.createNewBoard);
  const duplicateBoard = useStore((s) => s.duplicateBoard);
  const removeBoard = useStore((s) => s.removeBoard);
  const renameBoard = useStore((s) => s.renameBoard);
  const setBoardFolder = useStore((s) => s.setBoardFolder);
  const updateSettings = useStore((s) => s.updateSettings);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const setTemplatesOpen = useStore((s) => s.setTemplatesOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const cloud = useStore((s) => s.cloud);

  const [fullBoards, setFullBoards] = useState<Record<string, Board>>({});
  const [commandOpen, setCommandOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      return localStorage.getItem("kdsflux.viewMode") === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  const [starred, setStarred] = useState(() => {
    try {
      return localStorage.getItem(STAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [toast, setToast] = useState<string | null>(null);
  const avatarRef = useRef<HTMLDivElement | null>(null);

  const filter = settings.workspaceFilter || "all";
  const folders = settings.folders;

  const boardKey = boards.map((b) => `${b.id}:${b.updatedAt}`).join(",");
  useEffect(() => {
    let cancelled = false;
    const ids = boards.map((b) => b.id);
    void Promise.all(ids.map((id) => getBoard(id))).then((list) => {
      if (cancelled) return;
      const map: Record<string, Board> = {};
      for (const b of list) if (b) map[b.id] = b;
      setFullBoards(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardKey]);

  useEffect(() => {
    if (!avatarOpen) return;
    const onDown = (e: PointerEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [avatarOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void createNewBoard("blank", undefined, targetFolder);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const scriptFilter = filter;
  const filtered = useMemo(() => {
    let list = [...boards];
    if (scriptFilter === "private") list = list.filter((b) => !b.folderId);
    else if (scriptFilter !== "all" && scriptFilter !== "recent") list = list.filter((b) => b.folderId === scriptFilter);
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [boards, scriptFilter]);

  const folderNameActive = folders.find((f) => f.id === filter)?.name;
  const currentLabel =
    filter === "recent" ? "Recentes" : filter === "private" ? "Meus boards" : folderNameActive ?? team;
  const targetFolder = filter !== "all" && filter !== "recent" && filter !== "private" ? filter : null;
  const newBoard = (template: TemplateId = "blank") => void createNewBoard(template, undefined, targetFolder);

  const createFolder = () => {
    const name = folderName.trim();
    if (!name) return;
    const folder: Folder = { id: nanoid(), name: name.slice(0, 60), createdAt: Date.now() };
    updateSettings({ folders: [...folders, folder], workspaceFilter: folder.id });
    setFolderName("");
    setFolderOpen(false);
    setToast("Pasta criada");
  };

  const deleteFolder = (id: string) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    if (!confirm(`Excluir a pasta “${folder.name}”? Os boards dentro dela serão mantidos em “Todos”.`)) return;
    for (const b of boards.filter((b) => b.folderId === id)) void setBoardFolder(b.id, null);
    updateSettings({
      folders: folders.filter((f) => f.id !== id),
      workspaceFilter: filter === id ? "all" : filter,
    });
    setToast("Pasta excluída");
  };

  const toggleViewMode = () => {
    const next = viewMode === "grid" ? "list" : "grid";
    setViewMode(next);
    try {
      localStorage.setItem("kdsflux.viewMode", next);
    } catch {
      /* ignore */
    }
  };

  const visibleFolders = useMemo(() => {
    if (filter === "all" || filter === "recent") return folders;
    if (filter === "private") return [];
    return folders.filter((f) => f.id === filter);
  }, [folders, filter]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const board of boards) {
      if (!board.folderId) continue;
      counts[board.folderId] = (counts[board.folderId] ?? 0) + 1;
    }
    return counts;
  }, [boards]);

  const copyWorkspaceLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Link do workspace copiado");
    } catch {
      setToast(window.location.href);
    }
    setAvatarOpen(false);
  };

  const handleRename = (id: string, title: string) => {
    const clean = title.trim();
    if (clean) void renameBoard(id, clean);
  };

  return (
    <div className="ws-main">
      <header className="ws-topbar">
        <div className="ws-crumb">
          <button className="ws-menu-btn" title="Mostrar/ocultar sidebar" onClick={toggleSidebar}>
            <Icon name="panelLeft" size={17} />
          </button>
          <button className="ws-crumb-link" onClick={() => updateSettings({ workspaceFilter: "all" })}>
            <Icon name="users" size={16} />
            <span>Teams</span>
          </button>
          <span className="ws-crumb-sep">/</span>
          <button className="ws-crumb-current" onClick={() => updateSettings({ workspaceFilter: "all" })} title={organization}>
            <Icon name="folder" size={16} />
            <span>{currentLabel}</span>
            <Icon name="chevronDown" size={13} />
          </button>
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
        </div>

        <div className="ws-top-actions">
          <div className="ws-presence" title="Presença da equipe">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} style={{ opacity: 0.45 + i * 0.13 }} />
            ))}
          </div>
          <button className="ws-share" onClick={() => void copyWorkspaceLink()}>
            <Icon name="share" size={15} /> Compartilhar
          </button>
          <button className="ws-icon-btn" title="Buscar comandos (Ctrl+K)" onClick={() => setCommandOpen(true)}>
            <Icon name="search" size={17} />
          </button>
          <div className="ws-avatar-wrap" ref={avatarRef}>
            <button className="ws-avatar" onClick={() => setAvatarOpen((v) => !v)} title={settings.userName}>
              {(settings.userName || "A").trim().charAt(0).toUpperCase()}
            </button>
            <span className="ws-notif">{Math.max(1, boards.length)}</span>
            {avatarOpen ? (
              <div className="ws-avatar-menu">
                <div className="ws-avatar-head">
                  <span className="ws-avatar big">{(settings.userName || "A").trim().charAt(0).toUpperCase()}</span>
                  <div>
                    <b>{settings.userName}</b>
                    <small>{organization}</small>
                  </div>
                </div>
                <button onClick={() => { setAvatarOpen(false); setAuthOpen(true); }}>
                  <Icon name={cloud.user ? "cloud" : "cloudOff"} size={15} />
                  {cloud.user ? "Nuvem conectada" : "Conectar Supabase"}
                </button>
                <button onClick={toggleTheme}>
                  <Icon name={settings.theme === "dark" ? "sun" : "moon"} size={15} />
                  {settings.theme === "dark" ? "Tema claro" : "Tema escuro"}
                </button>
                <button onClick={() => { setAvatarOpen(false); setTemplatesOpen(true); }}>
                  <Icon name="palette" size={15} /> Templates & temas
                </button>
                <button onClick={() => { setAvatarOpen(false); setHelpOpen(true); }}>
                  <Icon name="help" size={15} /> Ajuda e atalhos
                </button>
                <button onClick={() => void copyWorkspaceLink()}>
                  <Icon name="link" size={15} /> Copiar link
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="ws-content">
        <div className="ws-actions">
          <ActionCard variant="board" icon="board" label="Novo board" onClick={() => newBoard("blank")} />
          <ActionCard variant="doc" icon="doc" label="Novo doc" onClick={() => newBoard("doc")} />
          <ActionCard variant="template" icon="layout" label="Novo a partir de template" onClick={() => setTemplatesOpen(true)} />
          <ActionCard variant="folder" icon="folder" label="Nova pasta" onClick={() => setFolderOpen(true)} />
        </div>

        {filtered.length === 0 && visibleFolders.length === 0 ? (
          <EmptyWorkspace onCreate={() => newBoard("blank")} onSearch={() => setCommandOpen(true)} />
        ) : (
          <section className="ws-recent">
            <div className="ws-recent-head">
              <h2>{currentLabel}</h2>
              <span>
                {visibleFolders.length > 0
                  ? `${visibleFolders.length} pasta${visibleFolders.length === 1 ? "" : "s"} · `
                  : ""}
                {filtered.length} board{filtered.length === 1 ? "" : "s"}
              </span>
              <span className="spacer" />
              <div className="ws-view-toggle" role="group" aria-label="Modo de visualização">
                <button
                  className={viewMode === "grid" ? "active" : ""}
                  title="Ver em grade"
                  onClick={() => {
                    if (viewMode !== "grid") toggleViewMode();
                  }}
                >
                  <Icon name="grid" size={15} />
                </button>
                <button
                  className={viewMode === "list" ? "active" : ""}
                  title="Ver em lista"
                  onClick={() => {
                    if (viewMode !== "list") toggleViewMode();
                  }}
                >
                  <Icon name="list" size={15} />
                </button>
              </div>
            </div>

            {visibleFolders.length > 0 ? (
              viewMode === "list" ? (
                <FolderTable
                  folders={visibleFolders}
                  counts={folderCounts}
                  owner={settings.userName}
                  onOpen={(id) => updateSettings({ workspaceFilter: id })}
                  onDelete={deleteFolder}
                />
              ) : (
                <div className="ws-folder-grid">
                  {visibleFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      count={folderCounts[folder.id] ?? 0}
                      onOpen={() => updateSettings({ workspaceFilter: folder.id })}
                      onDelete={() => deleteFolder(folder.id)}
                    />
                  ))}
                </div>
              )
            ) : null}

            {filtered.length > 0 ? (
              viewMode === "list" ? (
                <BoardTable
                  boards={filtered}
                  owner={settings.userName}
                  onOpen={(id) => void openBoard(id)}
                  onDelete={(id) => {
                    if (confirm(`Excluir “${boards.find((b) => b.id === id)?.title ?? "board"}”?`)) {
                      void removeBoard(id);
                    }
                  }}
                />
              ) : (
                <div className="ws-board-grid">
                  {filtered.map((b) => (
                    <BoardCard
                      key={b.id}
                      meta={b}
                      board={fullBoards[b.id]}
                      folders={folders}
                      onOpen={() => void openBoard(b.id)}
                      onRename={(title) => handleRename(b.id, title)}
                      onDuplicate={() => void duplicateBoard(b.id)}
                      onDelete={() => {
                        if (confirm(`Excluir “${b.title}”?`)) void removeBoard(b.id);
                      }}
                      onMove={(folderId) => void setBoardFolder(b.id, folderId)}
                    />
                  ))}
                </div>
              )
            ) : (
              <p className="ws-section-empty">Nenhum board nesta pasta. Crie um novo board para começar.</p>
            )}
          </section>
        )}
      </main>

      <div className="ws-floating">
        <button className="ws-fab" title="Ajuda" onClick={() => setHelpOpen(true)}>
          <Icon name="help" size={19} />
        </button>
      </div>

      {toast ? <div className="ws-toast">{toast}</div> : null}

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        boards={boards}
        onCreate={() => newBoard("blank")}
        onCreateDoc={() => newBoard("doc")}
        onTemplate={() => setTemplatesOpen(true)}
        onFolder={() => setFolderOpen(true)}
        onOpenBoard={(id) => void openBoard(id)}
      />

      <Modal
        open={folderOpen}
        title="Nova pasta"
        subtitle="Organize boards por time, cliente ou projeto."
        onClose={() => setFolderOpen(false)}
      >
        <div className="folder-form">
          <input
            autoFocus
            className="field"
            value={folderName}
            placeholder="Nome da pasta"
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createFolder();
            }}
          />
          <div className="inline-row">
            <button className="secondary-btn" onClick={() => setFolderOpen(false)}>
              Cancelar
            </button>
            <button className="primary-btn" disabled={!folderName.trim()} onClick={createFolder}>
              Criar pasta
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CommandPalette({
  open,
  onClose,
  boards,
  onCreate,
  onCreateDoc,
  onTemplate,
  onFolder,
  onOpenBoard,
}: {
  open: boolean;
  onClose: () => void;
  boards: BoardMeta[];
  onCreate: () => void;
  onCreateDoc: () => void;
  onTemplate: () => void;
  onFolder: () => void;
  onOpenBoard: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const actions = useMemo(
    () => [
      { id: "new", label: "Novo board", hint: "Alt Ctrl N", icon: "board" as IconName, run: onCreate },
      { id: "doc", label: "Novo doc", hint: "", icon: "doc" as IconName, run: onCreateDoc },
      { id: "template", label: "Novo a partir de template", hint: "", icon: "layout" as IconName, run: onTemplate },
      { id: "folder", label: "Nova pasta", hint: "", icon: "folder" as IconName, run: onFolder },
    ],
    [onCreate, onCreateDoc, onTemplate, onFolder],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actionResults = actions
      .filter((a) => !q || a.label.toLowerCase().includes(q))
      .map((a) => ({ kind: "action" as const, id: a.id, label: a.label, hint: a.hint, icon: a.icon, run: a.run }));
    const boardResults = boards
      .filter((b) => !q || b.title.toLowerCase().includes(q))
      .slice(0, 12)
      .map((b) => ({
        kind: "board" as const,
        id: b.id,
        label: b.title,
        hint: `${b.count} objeto${b.count === 1 ? "" : "s"}`,
        icon: "file" as IconName,
        run: () => onOpenBoard(b.id),
      }));
    return [...actionResults, ...boardResults];
  }, [query, actions, boards, onOpenBoard]);

  const exec = (index: number) => {
    const item = results[index];
    if (!item) return;
    onClose();
    item.run();
  };

  return (
    <Modal open={open} title="Comandos" subtitle="Crie um board, abra um existente ou execute uma ação." onClose={onClose}>
      <div className="command-search">
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          value={query}
          placeholder="Digite um comando ou nome de board…"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              exec(active);
            }
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <div className="command-results">
        {results.length === 0 ? <div className="command-empty">Nada encontrado.</div> : null}
        {results.map((r, i) => (
          <button
            key={`${r.kind}-${r.id}`}
            className={`command-row ${i === active ? "active" : ""}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => exec(i)}
          >
            <span className="command-icon">
              <Icon name={r.icon} size={16} />
            </span>
            <span className="command-label">{r.label}</span>
            <span className="command-kind">{r.kind === "board" ? "Board" : "Comando"}</span>
            {r.hint ? <span className="command-hint">{r.hint}</span> : null}
          </button>
        ))}
      </div>
    </Modal>
  );
}
