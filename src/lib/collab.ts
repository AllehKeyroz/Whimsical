import type { Board } from "../types";

export interface Peer {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  at: number;
  self?: boolean;
}

export type CollabStatus = "off" | "connecting" | "connected" | "error";

export interface CollabHandlers {
  onBoard: (board: Board, at: number) => void;
  onPeers: (peers: Peer[]) => void;
  onChat: (message: ChatMessage) => void;
  onStatus: (status: CollabStatus, detail?: string) => void;
}

const COLORS = ["#8b3fd9", "#2484d4", "#26aea0", "#E8833A", "#D3455B", "#6558F5", "#e6b725"];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Lightweight collaboration transport.
 *
 * - Uses BroadcastChannel for real-time sync between tabs/windows on the same
 *   browser (zero configuration).
 * - Optionally uses a WebSocket relay for cross-device sync. The relay only
 *   fans messages out to the room; it does not persist or authenticate.
 *
 * Board updates are last-write-wins snapshots. That is intentionally simple:
 * it is perfect for a demo/small team and can later be replaced by a CRDT.
 */
export class CollabClient {
  readonly clientId = randomId();
  private room: string;
  private userName: string;
  private relayUrl: string;
  private handlers: CollabHandlers;
  private channel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private peers = new Map<string, Peer>();
  private seen = new Set<string>();
  private heartbeat: number | null = null;
  private reconnect: number | null = null;
  private closed = false;
  private lastBoard: Board | null = null;
  private sendTimer: number | null = null;
  private pendingBoard: Board | null = null;

  constructor(room: string, userName: string, relayUrl: string, handlers: CollabHandlers) {
    this.room = room;
    this.userName = userName;
    this.relayUrl = relayUrl.trim();
    this.handlers = handlers;
  }

  connect() {
    this.closed = false;
    this.handlers.onStatus("connecting");
    try {
      this.channel = new BroadcastChannel(`whim-room-${this.room}`);
      this.channel.onmessage = (event) => this.receive(event.data);
    } catch {
      this.channel = null;
    }
    if (this.relayUrl) this.connectWs();
    else this.handlers.onStatus("connected", "Abas do navegador");
    this.announce();
    this.heartbeat = window.setInterval(() => {
      this.announce();
      this.prunePeers();
    }, 5000);
  }

  private connectWs() {
    try {
      const sep = this.relayUrl.includes("?") ? "&" : "?";
      const url = `${this.relayUrl}${sep}room=${encodeURIComponent(this.room)}&client=${this.clientId}&name=${encodeURIComponent(this.userName)}`;
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.handlers.onStatus("connected", "Servidor");
        this.announce();
      };
      this.ws.onmessage = (event) => {
        try {
          this.receive(JSON.parse(String(event.data)));
        } catch {
          /* ignore malformed */
        }
      };
      this.ws.onerror = () => this.handlers.onStatus("error", "Falha no relay");
      this.ws.onclose = () => {
        this.ws = null;
        if (this.closed) return;
        this.handlers.onStatus("connecting", "Reconectando…");
        this.reconnect = window.setTimeout(() => this.connectWs(), 3000);
      };
    } catch {
      this.handlers.onStatus("error", "Relay inválido");
    }
  }

  disconnect() {
    this.closed = true;
    if (this.sendTimer) window.clearTimeout(this.sendTimer);
    if (this.heartbeat) window.clearInterval(this.heartbeat);
    if (this.reconnect) window.clearTimeout(this.reconnect);
    this.post({ type: "leave", sender: this.clientId, at: Date.now() });
    this.channel?.close();
    this.channel = null;
    this.ws?.close();
    this.ws = null;
    this.peers.clear();
    this.handlers.onPeers([]);
    this.handlers.onStatus("off");
  }

  sendBoard(board: Board) {
    this.lastBoard = board;
    this.pendingBoard = board;
    if (this.sendTimer) return;
    this.sendTimer = window.setTimeout(() => {
      this.sendTimer = null;
      const pending = this.pendingBoard;
      this.pendingBoard = null;
      if (pending) this.post({ type: "board", board: pending, sender: this.clientId, at: Date.now() });
    }, 60);
  }

  setUserName(name: string) {
    this.userName = name;
    this.announce();
  }

  sendChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const msg: ChatMessage = { id: randomId(), author: this.userName, text: trimmed, at: Date.now() };
    this.handlers.onChat({ ...msg, self: true });
    this.post({ type: "chat", message: msg, sender: this.clientId, at: Date.now() });
  }

  private announce() {
    this.post({
      type: "presence",
      peer: { id: this.clientId, name: this.userName, color: colorFor(this.clientId), lastSeen: Date.now() },
      sender: this.clientId,
      at: Date.now(),
    });
  }

  private post(message: Record<string, unknown>) {
    const payload = { ...message, mid: randomId() };
    try {
      this.channel?.postMessage(payload);
    } catch {
      /* ignore */
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    }
  }

  private receive(raw: unknown) {
    if (!raw || typeof raw !== "object") return;
    const msg = raw as Record<string, unknown>;
    const sender = typeof msg.sender === "string" ? msg.sender : "";
    if (sender === this.clientId) return;
    if (typeof msg.mid === "string") {
      if (this.seen.has(msg.mid)) return;
      this.seen.add(msg.mid);
      if (this.seen.size > 800) {
        const first = this.seen.values().next().value;
        if (first) this.seen.delete(first);
      }
    }
    if (msg.type === "presence" && msg.peer) {
      const p = msg.peer as Partial<Peer>;
      if (!p.id) return;
      const existed = this.peers.has(p.id);
      this.peers.set(p.id, {
        id: p.id,
        name: p.name || "Convidado",
        color: p.color || colorFor(p.id),
        lastSeen: Date.now(),
      });
      if (!existed) {
        if (this.lastBoard) this.post({ type: "board", board: this.lastBoard, sender: this.clientId, at: Date.now() });
        this.announce();
      }
      this.handlers.onPeers([...this.peers.values()]);
    } else if (msg.type === "board" && msg.board) {
      this.lastBoard = msg.board as Board;
      this.handlers.onBoard(msg.board as Board, typeof msg.at === "number" ? msg.at : Date.now());
    } else if (msg.type === "chat" && msg.message) {
      const m = msg.message as ChatMessage;
      this.handlers.onChat({ ...m, self: false });
    } else if (msg.type === "leave") {
      this.peers.delete(sender);
      this.handlers.onPeers([...this.peers.values()]);
    }
  }

  private prunePeers() {
    const cutoff = Date.now() - 16000;
    let changed = false;
    for (const [id, p] of this.peers) {
      if (p.lastSeen < cutoff) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) this.handlers.onPeers([...this.peers.values()]);
  }
}
