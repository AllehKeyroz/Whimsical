import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStore } from "../store";
import type { BoardObject } from "../types";
import { hasText } from "../types";
import { TEMPLATES } from "../lib/templates";
import { iconLabel } from "../lib/iconLibrary";
import { Icon } from "./icons";

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  wide,
  className,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""} ${className ?? ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function HelpModal() {
  const open = useStore((s) => s.helpOpen);
  const setOpen = useStore((s) => s.setHelpOpen);
  return (
    <Modal
      open={open}
      title="Atalhos e gestos"
      subtitle="Tudo que dá para fazer sem sair do teclado."
      onClose={() => setOpen(false)}
      wide
    >
      <div className="help-grid">
        <div>
          <h3>Navegação</h3>
          <Row keys="V" label="Selecionar" />
          <Row keys="H / Espaço" label="Mover a tela" />
          <Row keys="Ctrl + scroll" label="Zoom no cursor" />
          <Row keys="Scroll / Shift + scroll" label="Mover horizontal/vertical" />
          <Row keys="0" label="Centralizar board" />
          <Row keys="1" label="Zoom 100%" />
          <Row keys="Dois dedos" label="Pinch zoom no touch" />
        </div>
        <div>
          <h3>Edição</h3>
          <Row keys="Ctrl + Z / Y" label="Desfazer / refazer" />
          <Row keys="Ctrl + C / X / V" label="Copiar / recortar / colar" />
          <Row keys="Ctrl + D" label="Duplicar" />
          <Row keys="Ctrl + A" label="Selecionar tudo" />
          <Row keys="Ctrl + G / Shift + Ctrl + G" label="Agrupar / desagrupar" />
          <Row keys="Setas / Shift + setas" label="Mover 1px / 10px" />
          <Row keys="Delete" label="Excluir" />
          <Row keys="Enter / duplo clique" label="Editar texto" />
          <Row keys="Ctrl + clique" label="Abrir link do objeto" />
          <Row keys="L" label="Bloquear/desbloquear" />
          <Row keys="Ctrl + S" label="Salvar agora" />
        </div>
        <div>
          <h3>Ferramentas</h3>
          <Row keys="R / O / P / D" label="Retângulo / elipse / pílula / decisão" />
          <Row keys="T / F / C / S / I" label="Texto / frame / conector / nota / imagem" />
          <Row keys="Ctrl + K" label="Buscar no board" />
          <Row keys="?" label="Esta ajuda" />
        </div>
        <div>
          <h3>Gestos</h3>
          <Row keys="Arrastar alça" label="Redimensionar" />
          <Row keys="Arrastar bolinha azul" label="Criar conector" />
          <Row keys="Botão +" label="Criar nó conectado" />
          <Row keys="Botão direito" label="Menu de contexto" />
          <Row keys="Duplo clique no vazio" label="Novo texto" />
          <Row keys="Soltar sobre frame" label="Mover para dentro do frame" />
        </div>
      </div>
      <div className="help-note">
        Dica: arraste o botão <b>+</b> ao lado de uma forma para criar um nó já conectado. Arraste uma forma para dentro de um frame para vinculá-la.
      </div>
    </Modal>
  );
}

function Row({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="help-row">
      <kbd>{keys}</kbd>
      <span>{label}</span>
    </div>
  );
}

function objectLabel(o: BoardObject): string {
  if (o.objectType === "connector") return o.label || "Conector";
  if (o.objectType === "image") return o.alt || "Imagem";
  if (o.objectType === "icon") return o.iconSet === "emoji" ? o.icon : iconLabel(o.icon);
  if (hasText(o)) return (o.text || "").split("\n")[0] || (o.objectType === "frame" ? "Frame" : "Texto");
  return "Objeto";
}

export function SearchPalette() {
  const open = useStore((s) => s.searchOpen);
  const setOpen = useStore((s) => s.setSearchOpen);
  const board = useStore((s) => s.board);
  const select = useStore((s) => s.select);
  const zoomToObject = useStore((s) => s.zoomToObject);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(board.objects)
      .filter((o) => objectLabel(o).toLowerCase().includes(q) || (o.link ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.order - a.order)
      .slice(0, 18);
  }, [board.objects, query]);

  const go = (id: string) => {
    select(id, false);
    zoomToObject(id);
    setOpen(false);
  };

  return (
    <Modal open={open} title="Buscar no board" subtitle="Encontre qualquer forma, texto, frame ou conector." onClose={() => setOpen(false)}>
      <div className="search-box">
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          value={query}
          placeholder="Digite para buscar…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) go(results[0].id);
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <div className="search-results">
        {query && results.length === 0 ? <div className="search-empty">Nada encontrado.</div> : null}
        {results.map((o) => (
          <button key={o.id} className="search-result" onClick={() => go(o.id)}>
            <span className={`result-type ${o.objectType}`}>{o.objectType === "connector" ? "↗" : o.objectType === "frame" ? "▢" : o.objectType === "text" ? "T" : o.objectType === "image" ? "▣" : "▭"}</span>
            <span className="result-label">{objectLabel(o)}</span>
            <span className="result-kind">{o.objectType}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function TemplateGallery() {
  const open = useStore((s) => s.templatesOpen);
  const setOpen = useStore((s) => s.setTemplatesOpen);
  const createNewBoard = useStore((s) => s.createNewBoard);
  const filter = useStore((s) => s.settings.workspaceFilter);
  const folderId = filter !== "all" && filter !== "recent" && filter !== "private" ? filter : null;
  return (
    <Modal
      open={open}
      title="Novo board"
      subtitle="Escolha um template ou comece em branco."
      onClose={() => setOpen(false)}
      wide
    >
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="template-card large"
            onClick={() => {
              void createNewBoard(t.id, undefined, folderId);
              setOpen(false);
            }}
          >
            <span className="template-icon">{t.icon}</span>
            <b>{t.name}</b>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function SharePanel() {
  const open = useStore((s) => s.shareOpen);
  const setOpen = useStore((s) => s.setShareOpen);
  const board = useStore((s) => s.board);
  const settings = useStore((s) => s.settings);
  const collab = useStore((s) => s.collab);
  const startCollab = useStore((s) => s.startCollab);
  const leaveCollab = useStore((s) => s.leaveCollab);
  const sendChat = useStore((s) => s.sendChat);
  const updateSettings = useStore((s) => s.updateSettings);
  const [room, setRoom] = useState("");
  const [chat, setChat] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && collab.room) setRoom(collab.room);
  }, [open, collab.room]);

  const link = `${window.location.origin}${window.location.pathname}#/board/${board.id}${collab.room ? `?room=${encodeURIComponent(collab.room)}` : ""}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(link);
    }
  };

  return (
    <Modal open={open} title="Compartilhar e colaborar" subtitle="Sincronização em tempo real por sala." onClose={() => setOpen(false)}>
      <div className="share-section">
        <label className="field-label">Seu nome</label>
        <input
          className="field"
          value={settings.userName}
          onChange={(e) => updateSettings({ userName: e.target.value.slice(0, 40) })}
        />
      </div>

      {!collab.room ? (
        <>
          <div className="share-section">
            <label className="field-label">Sala</label>
            <div className="inline-row">
              <input
                className="field"
                value={room}
                placeholder="ex.: time-produto"
                onChange={(e) => setRoom(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && room.trim()) startCollab(room);
                }}
              />
              <button
                className="secondary-btn"
                onClick={() => setRoom(Math.random().toString(36).slice(2, 8))}
              >
                Gerar código
              </button>
              <button className="primary-btn" disabled={!room.trim()} onClick={() => startCollab(room)}>
                Entrar
              </button>
            </div>
          </div>
          <div className="share-help">
            <p>
              <b>Abas do mesmo navegador</b> sincronizam automaticamente pelo BroadcastChannel. Para sincronizar entre
              dispositivos, rode <code>npm run collab</code> e informe o endereço do relay abaixo.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="share-section">
            <div className="share-status">
              <span className={`status-dot ${collab.status}`} />
              <b>{collab.status === "connected" ? "Conectado" : collab.status === "connecting" ? "Conectando…" : "Offline"}</b>
              <span>{collab.detail ?? (collab.status === "connected" ? "Sincronizando" : "")}</span>
              <span className="spacer" />
              <span>{collab.peers.length + 1} na sala</span>
            </div>
            <div className="inline-row">
              <input className="field room-code" readOnly value={collab.room} />
              <button className="primary-btn" onClick={() => void copy()}>
                {copied ? "Copiado!" : "Copiar link"}
              </button>
              <button className="secondary-btn" onClick={leaveCollab}>
                Sair
              </button>
            </div>
          </div>
          <div className="share-section">
            <label className="field-label">Pessoas</label>
            <div className="peer-list">
              <div className="peer">
                <i style={{ background: "#8b3fd9" }} />
                {settings.userName} <small>(você)</small>
              </div>
              {collab.peers.map((p) => (
                <div key={p.id} className="peer">
                  <i style={{ background: p.color }} />
                  {p.name}
                </div>
              ))}
            </div>
          </div>
          <div className="share-section chat">
            <label className="field-label">Chat da sala</label>
            <div className="chat-log">
              {collab.messages.length === 0 ? <div className="chat-empty">Nenhuma mensagem ainda.</div> : null}
              {collab.messages.map((m) => (
                <div key={`${m.id}-${m.at}`} className={`chat-msg ${m.self ? "self" : ""}`}>
                  <b>{m.author}</b>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>
            <div className="inline-row">
              <input
                className="field"
                value={chat}
                placeholder="Escreva uma mensagem…"
                onChange={(e) => setChat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chat.trim()) {
                    sendChat(chat);
                    setChat("");
                  }
                }}
              />
              <button
                className="primary-btn"
                disabled={!chat.trim()}
                onClick={() => {
                  sendChat(chat);
                  setChat("");
                }}
              >
                Enviar
              </button>
            </div>
          </div>
        </>
      )}

      <div className="share-section">
        <label className="field-label">Relay WebSocket (opcional)</label>
        <input
          className="field"
          value={settings.relayUrl}
          placeholder="ws://localhost:8787"
          onChange={(e) => updateSettings({ relayUrl: e.target.value })}
        />
        <small className="field-hint">
          Sem relay, a colaboração funciona entre abas do mesmo navegador. Com relay, funciona entre dispositivos na mesma
          rede (ou internet, se hospedado). A sala é o controle de acesso — não use para dados sensíveis.
        </small>
      </div>
    </Modal>
  );
}

const MERMAID_SAMPLE = `flowchart TD
  A([Início]) --> B[Receber lead]
  B --> C{Qualificado?}
  C -->|Sim| D[Agendar reunião]
  C -->|Não| E[Nutrição]
  D --> F([Fim])
  E --> F`;

export function MermaidModal() {
  const open = useStore((s) => s.mermaidOpen);
  const setOpen = useStore((s) => s.setMermaidOpen);
  const importMermaid = useStore((s) => s.importMermaid);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText("");
      setBusy(false);
    }
  }, [open]);

  const run = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await importMermaid(text);
    setBusy(false);
    if (ok) setOpen(false);
  };

  return (
    <Modal
      open={open}
      title="Colar Mermaid"
      subtitle="Cole o código. Fluxogramas viram formas editáveis; outros diagramas entram como imagem."
      onClose={() => setOpen(false)}
      wide
    >
      <div className="agent-box">
        <textarea
          autoFocus
          value={text}
          placeholder={MERMAID_SAMPLE}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void run();
          }}
        />
        <div className="agent-chips">
          <button onClick={() => setText(MERMAID_SAMPLE)}>Fluxograma de exemplo</button>
          <button onClick={() => setText("graph LR\n  A[Ideia] --> B[Pesquisa]\n  B --> C[Protótipo]\n  C --> D[Lançamento]")}>
            Pipeline LR
          </button>
          <button onClick={() => setText("sequenceDiagram\n  Cliente->>API: Requisição\n  API->>Banco: Consulta\n  Banco-->>API: Resultado\n  API-->>Cliente: Resposta")}>
            Sequência
          </button>
        </div>
        <div className="agent-actions">
          <span>Ctrl + Enter para importar</span>
          <button className="primary-btn" disabled={!text.trim() || busy} onClick={() => void run()}>
            <Icon name="code" size={15} /> {busy ? "Importando…" : "Importar Mermaid"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function CommentsPanel() {
  const open = useStore((s) => s.commentsOpen);
  const setOpen = useStore((s) => s.setCommentsOpen);
  const board = useStore((s) => s.board);
  const select = useStore((s) => s.select);
  const zoomToObject = useStore((s) => s.zoomToObject);
  const resolveComment = useStore((s) => s.resolveComment);
  const deleteComment = useStore((s) => s.deleteComment);

  const items = useMemo(
    () =>
      Object.values(board.objects).flatMap((o) =>
        (o.comments ?? []).map((comment) => ({ object: o, comment })),
      ),
    [board.objects],
  );

  return (
    <Modal
      open={open}
      title="Comentários"
      subtitle={`${items.filter((i) => !i.comment.resolved).length} em aberto · ${items.length} no total`}
      onClose={() => setOpen(false)}
    >
      {items.length === 0 ? (
        <div className="comments-panel-empty">Nenhum comentário neste board ainda.</div>
      ) : (
        <div className="comments-panel-list">
          {items.map(({ object, comment }) => (
            <div key={comment.id} className={`comments-panel-item ${comment.resolved ? "resolved" : ""}`}>
              <div className="comments-panel-head">
                <b>{comment.author}</b>
                <small>{objectLabel(object)}</small>
                <span>{new Date(comment.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <p>{comment.text}</p>
              <div className="comments-panel-actions">
                <button
                  onClick={() => {
                    select(object.id, false);
                    zoomToObject(object.id);
                    setOpen(false);
                  }}
                >
                  Ir para o objeto
                </button>
                <button onClick={() => resolveComment(object.id, comment.id)}>
                  {comment.resolved ? "Reabrir" : "Resolver"}
                </button>
                <button className="danger" onClick={() => deleteComment(object.id, comment.id)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function PresentationBar() {
  const presentation = useStore((s) => s.presentation);
  const board = useStore((s) => s.board);
  const frameId = useStore((s) => s.presentationFrameId);
  const stop = useStore((s) => s.stopPresentation);
  const nextFrame = useStore((s) => s.nextFrame);
  if (!presentation) return null;
  const frame = frameId ? board.objects[frameId] : null;
  return (
    <div className="presentation-bar">
      <button className="present-btn" onClick={() => nextFrame(-1)} title="Anterior">
        <Icon name="arrowLeft" />
      </button>
      <div className="present-title">
        <small>{frame && hasText(frame) ? "Frame" : "Apresentação"}</small>
        <b>{frame && hasText(frame) ? frame.text : board.title}</b>
      </div>
      <button className="present-btn" onClick={() => nextFrame(1)} title="Próximo">
        <Icon name="arrowRight" />
      </button>
      <button className="present-btn close" onClick={stop} title="Sair (Esc)">
        <Icon name="close" />
      </button>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <span className="logo-mark big">◈</span>
      <h1>Whimsical</h1>
      <p>Carregando seus boards…</p>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="loading-screen error">
          <h1>Algo deu errado</h1>
          <p>{this.state.error.message}</p>
          <div className="inline-row">
            <button className="primary-btn" onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <button
              className="secondary-btn"
              onClick={() => {
                void useStore.getState().returnToDashboard();
                this.setState({ error: null });
              }}
            >
              Voltar aos boards
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
