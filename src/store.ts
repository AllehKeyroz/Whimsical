import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  Board,
  BoardMeta,
  BoardObject,
  Color,
  Connector,
  ConnectorType,
  Deco,
  EndpointMarker,
  Frame,
  IconObject,
  ImageObject,
  Rect,
  RelativeAnchor,
  Settings,
  Shape,
  ShapeType,
  TextObject,
  TextStyle,
  Tool,
  Vec,
} from "./types";
import { DEFAULT_TEXT_STYLE, LEFT_TEXT_STYLE } from "./types";
import { aabbOfRect, boundsOf, pointInRectRotated, rectCenter, snapAnchor, type SnapGuide } from "./geometry";
import { normalizeBoard, normalizeSettings } from "./lib/schema";
import {
  deleteBoard as deleteBoardFromStore,
  ensureStorageMigrated,
  getBoard,
  listBoards,
  loadSettings,
  migrateLegacyBoard,
  saveBoard,
  saveSettings,
  setStorageScope,
} from "./lib/storage";
import { createBoard, TEMPLATES, type TemplateId } from "./lib/templates";
import { boardBounds } from "./lib/export";
import { CollabClient, type ChatMessage, type CollabStatus, type Peer } from "./lib/collab";
import {
  buildFlowchartObjects,
  detectMermaidKind,
  parseMermaidEr,
  parseMermaidFlowchart,
  renderMermaidImage,
  type MermaidBuildResult,
} from "./lib/mermaid";
import { mergeCloudState } from "./lib/cloudMerge";
import { buildOutlineMindMap, layoutMindMapRects, looksLikeOutline } from "./lib/outline";
import {
  cloudChangePassword,
  cloudDeleteBoard,
  cloudListBoards,
  cloudListFolders,
  cloudReplaceFolders,
  cloudGetProfile,
  cloudSignIn,
  cloudSignOut,
  cloudSignUp,
  cloudUpdateProfile,
  cloudUpsertBoard,
  getCloudSession,
  isSupabaseConfigured,
  onCloudAuthChange,
  subscribeToBoardChanges,
  type BoardChangePayload,
} from "./lib/supabase";

const MIND_BRANCH_COLORS: Color[] = [
  "purple",
  "blue",
  "orange",
  "green",
  "red",
  "indigo",
  "mint",
  "crimson",
  "yellow",
  "brown",
];

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface ConnectorDefaults {
  color: Color;
  deco: Deco;
  connectorType: ConnectorType;
  fromEndpoint: EndpointMarker;
  toEndpoint: EndpointMarker;
}

export interface ContextMenuState {
  x: number;
  y: number;
  objectId: string | null;
}

export interface CollabState {
  room: string | null;
  status: CollabStatus;
  detail?: string;
  peers: Peer[];
  messages: ChatMessage[];
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export type CloudStatus = "off" | "connecting" | "online" | "error";

export interface CloudState {
  configured: boolean;
  initialized: boolean;
  user: { id: string; email: string | null; name: string } | null;
  status: CloudStatus;
  error: string | null;
  lastSync: number | null;
  syncing: boolean;
}

export interface BoardState {
  ready: boolean;
  view: "dashboard" | "board";
  board: Board;
  boards: BoardMeta[];
  settings: Settings;
  selection: string[];
  camera: Camera;
  tool: Tool;
  editingId: string | null;
  connectFrom: string | null;
  contextMenu: ContextMenuState | null;
  searchOpen: boolean;
  helpOpen: boolean;
  templatesOpen: boolean;
  shareOpen: boolean;
  layersOpen: boolean;
  iconPickerOpen: boolean;
  commentsOpen: boolean;
  mermaidOpen: boolean;
  sidebarOpen: boolean;
  toast: string | null;
  authOpen: boolean;
  integrationsOpen: boolean;
  cloud: CloudState;
  presentation: boolean;
  presentationFrameId: string | null;
  past: Board[];
  future: Board[];
  dirty: number;
  saveState: SaveState;
  defaultConnector: ConnectorDefaults;
  collab: CollabState;
  guides: SnapGuide[];

  init: () => Promise<void>;
  refreshBoards: () => Promise<void>;
  schedulePersist: () => void;
  persistNow: () => Promise<void>;

  setTool: (tool: Tool) => void;
  setEditing: (id: string | null) => void;
  setConnectFrom: (id: string | null) => void;
  setCamera: (camera: Camera) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (screen: Vec, factor: number) => void;
  fitView: (w: number, h: number) => void;
  zoomToObject: (id: string) => void;
  setGuides: (guides: SnapGuide[]) => void;

  openContextMenu: (menu: ContextMenuState | null) => void;
  setSearchOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setTemplatesOpen: (open: boolean) => void;
  setShareOpen: (open: boolean) => void;
  setIconPickerOpen: (open: boolean) => void;
  setCommentsOpen: (open: boolean) => void;
  setMermaidOpen: (open: boolean) => void;
  setAuthOpen: (open: boolean) => void;
  setIntegrationsOpen: (open: boolean) => void;
  showToast: (text: string) => void;
  toggleLayers: () => void;
  toggleSidebar: () => void;

  initCloud: () => Promise<void>;
  signInCloud: (email: string, password: string) => Promise<string | null>;
  signUpCloud: (email: string, password: string, name: string, organization: string) => Promise<string | null>;
  signOutCloud: () => Promise<void>;
  changeCloudPassword: (password: string) => Promise<string | null>;
  syncCloud: () => Promise<void>;
  pushLocalToCloud: () => Promise<void>;
  startPresentation: () => void;
  stopPresentation: () => void;
  nextFrame: (dir: 1 | -1) => void;

  select: (id: string | null, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  selectConnected: (id: string) => void;

  addShape: (shapeType: ShapeType, rect: Rect, opts?: { text?: string; parentId?: string | null }) => string;
  addText: (rect: Rect) => string;
  addFrame: (rect: Rect) => string;
  addImage: (rect: Rect, src: string, alt?: string) => string;
  addIcon: (rect: Rect, icon: string, iconSet: "lucide" | "emoji", color?: string, strokeWidth?: number) => string;
  addIconAtCenter: (icon: string, iconSet: "lucide" | "emoji", color?: string, size?: number) => string;
  addSvgIconAtCenter: (svgData: string, svgPlate?: string, size?: number) => string;
  addConnector: (fromId: string, toId: string, type?: ConnectorType) => string | null;
  addConnectorToPoint: (fromId: string, point: Vec, type?: ConnectorType) => string | null;
  quickAdd: (shapeId: string, direction?: "right" | "left" | "up" | "down") => string | null;
  addMindChild: (shapeId: string) => string | null;
  addMindSibling: (shapeId: string) => string | null;
  toggleMindCollapse: (id: string) => void;
  startMindMap: () => string;
  reflowMindMap: () => void;
  createConnectedNode: (fromId: string, point: Vec) => string | null;

  updateObject: (id: string, patch: Partial<BoardObject>, history?: boolean) => void;
  updateRect: (id: string, rect: Rect, history?: boolean) => void;
  setRects: (updates: Record<string, Rect>, history?: boolean) => void;
  moveSelection: (dx: number, dy: number, history?: boolean) => void;
  zoomToSelection: () => void;
  importMermaid: (text: string) => Promise<boolean>;
  importMindMap: (text: string) => boolean;
  nudgeSelection: (dx: number, dy: number) => void;
  setStyle: (id: string, patch: { color?: Color; deco?: Deco; hex?: string }) => void;
  setStyleForSelection: (patch: { color?: Color; deco?: Deco; hex?: string }) => void;
  setTextStyle: (id: string, patch: Partial<TextStyle>) => void;
  setTextStyleForSelection: (patch: Partial<TextStyle>) => void;
  setText: (id: string, text: string) => void;
  setBoardTitle: (title: string) => void;
  rotateSelection: () => void;
  swapEndpoints: (id: string) => void;
  applyConnectorDefaults: (id: string) => void;
  setConnectorEndpoint: (
    id: string,
    end: "from" | "to",
    patch: { shapeId?: string; rel?: RelativeAnchor; point?: Vec | null },
  ) => void;
  setConnectorBend: (id: string, bend: Vec | null, history?: boolean) => void;
  setLink: (id: string, link: string) => void;
  addComment: (id: string, text: string) => void;
  resolveComment: (id: string, commentId: string) => void;
  deleteComment: (id: string, commentId: string) => void;

  deleteSelection: () => void;
  duplicateSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  paste: () => void;

  bringToFront: () => void;
  sendToBack: () => void;
  reorderObject: (id: string, dir: 1 | -1) => void;
  toggleHidden: (id?: string) => void;
  toggleLocked: (id?: string) => void;

  alignSelection: (edge: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  distributeSelection: (axis: "h" | "v") => void;
  autoLayout: () => void;
  mindMapLayout: () => void;
  frameToContents: (id: string) => void;
  reparentSelection: (frameId: string | null) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  loadBoard: (board: Board) => void;
  openBoard: (id: string) => Promise<void>;
  createNewBoard: (template?: TemplateId, title?: string, folderId?: string | null) => Promise<void>;
  duplicateBoard: (id: string) => Promise<void>;
  removeBoard: (id: string) => Promise<void>;
  renameBoard: (id: string, title: string) => Promise<void>;
  setBoardFolder: (id: string, folderId: string | null) => Promise<void>;
  importBoard: (raw: unknown) => Promise<boolean>;
  openExample: () => Promise<void>;
  returnToDashboard: () => Promise<void>;

  updateSettings: (patch: Partial<Settings>) => void;
  toggleTheme: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;

  startCollab: (room: string) => void;
  leaveCollab: () => void;
  sendChat: (text: string) => void;
}

let orderCounter = 1;
let saveTimer: number | undefined;
let pasteCount = 0;
let lastNudgeAt = 0;
let pendingHistory: Board | null = null;
let initPromise: Promise<void> | null = null;
let collabClient: CollabClient | null = null;
let clipboard: BoardObject[] = [];
let toastTimer: number | undefined;
let cloudInitPromise: Promise<void> | null = null;
let cloudAuthUnsub: (() => void) | null = null;
let cloudSyncingPromise: Promise<void> | null = null;
let cloudSaveTimer: number | undefined;
let cloudRealtimeUnsub: (() => void) | null = null;
let cloudPollTimer: number | undefined;
let cloudPollBusy = false;

export const INTERNAL_CLIPBOARD_PREFIX = "KDS FLUX — ";

export function hasClipboard(): boolean {
  return clipboard.length > 0;
}

function withOrder<T extends BoardObject>(o: T): T {
  return { ...o, order: orderCounter++ };
}

function touch(board: Board): Board {
  return { ...board, updatedAt: Date.now() };
}

function metaOf(board: Board): BoardMeta {
  return {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    count: Object.keys(board.objects).length,
    folderId: board.folderId ?? null,
  };
}

function sortMeta(a: BoardMeta, b: BoardMeta) {
  return b.updatedAt - a.updatedAt;
}

export function cloudErrorMessage(raw: string | null | undefined): string {
  const message = raw || "Falha ao sincronizar com o Supabase.";
  if (/Invalid login credentials/i.test(message)) return "E-mail ou senha inválidos.";
  if (/Email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar.";
  if (/Error sending confirmation email|Error sending recovery email/i.test(message)) {
    return "O Supabase não consegue enviar e-mails. Habilite ENABLE_EMAIL_AUTOCONFIRM=true no Supabase (e reinicie o auth) ou crie o usuário em Authentication → Users.";
  }
  if (/User already registered/i.test(message)) return "Este e-mail já está cadastrado. Use a aba Entrar.";
  if (/rate limit/i.test(message)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/Could not find the table|PGRST205/i.test(message)) {
    return "Tabelas da nuvem não encontradas. Execute supabase/schema.sql no Supabase.";
  }
  if (/Invalid API key|JWT|apikey/i.test(message)) return "URL ou anon key do Supabase inválida.";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) {
    return "Não foi possível conectar ao Supabase. Verifique a URL e a rede.";
  }
  return message;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expandSelection(
  board: Board,
  ids: string[],
  opts: { groups?: boolean; descendants?: boolean } = {},
): string[] {
  const groups = opts.groups ?? true;
  const descendants = opts.descendants ?? true;
  const out = new Set(ids.filter((id) => !!board.objects[id]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const o of Object.values(board.objects)) {
      if (out.has(o.id)) continue;
      const groupHit = groups && o.groupId && [...out].some((id) => board.objects[id]?.groupId === o.groupId);
      const childHit = descendants && o.parentId && out.has(o.parentId);
      if (groupHit || childHit) {
        out.add(o.id);
        changed = true;
      }
    }
  }
  return [...out];
}

function rectObjects(board: Board, ids: string[]): (Shape | Frame | TextObject | ImageObject | IconObject)[] {
  return ids
    .map((id) => board.objects[id])
    .filter(
      (o): o is Shape | Frame | TextObject | ImageObject | IconObject =>
        !!o && o.objectType !== "connector" && "rect" in o && !!o.rect,
    );
}

function frameAt(board: Board, point: Vec): Frame | null {
  const frames = Object.values(board.objects)
    .filter((o): o is Frame => o.objectType === "frame" && !o.hidden && !!o.rect)
    .filter((f) => pointInRectRotated(point, f.rect, f.rotation ?? 0))
    .sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h);
  return frames[0] ?? null;
}

function isDescendant(board: Board, childId: string, ancestorId: string): boolean {
  let cur = board.objects[childId]?.parentId ?? null;
  let guard = 0;
  while (cur && guard++ < 100) {
    if (cur === ancestorId) return true;
    cur = board.objects[cur]?.parentId ?? null;
  }
  return false;
}

function collectTranslation(board: Board, ids: string[], dx: number, dy: number): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  const seen = new Set<string>();
  const queue = [...ids];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const o = board.objects[id];
    if (!o || o.hidden) continue;
    if ("rect" in o && o.rect) {
      out[id] = { ...o.rect, x: o.rect.x + dx, y: o.rect.y + dy };
    }
    for (const c of Object.values(board.objects)) {
      if (c.parentId === id) queue.push(c.id);
    }
  }
  return out;
}

function normalizeOrders(board: Board): Board {
  const sorted = Object.values(board.objects).sort((a, b) => a.order - b.order);
  const objects: Record<string, BoardObject> = {};
  sorted.forEach((o, i) => {
    objects[o.id] = { ...o, order: i + 1 };
  });
  orderCounter = Math.max(orderCounter, sorted.length + 1);
  return { ...board, objects };
}

function parseHash(): { boardId?: string; room?: string } {
  if (typeof window === "undefined") return {};
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const boardId = parts[0] === "board" && parts[1] ? parts[1] : undefined;
  const params = new URLSearchParams(query ?? "");
  return { boardId, room: params.get("room") ?? undefined };
}

function writeHash(boardId: string | null, room?: string | null) {
  if (typeof window === "undefined") return;
  const base = boardId ? `#/board/${boardId}` : "#/";
  const suffix = room ? `?room=${encodeURIComponent(room)}` : "";
  try {
    window.history.replaceState(null, "", `${base}${suffix}`);
  } catch {
    /* ignore */
  }
}

function slugTitle(title: string) {
  return title.trim() || "Board sem título";
}

const empty: Board = createBoard("Board sem título", "blank");

const SCOPED_STORAGE_KEY = "kdsflux.storage.scoped";

export const useStore = create<BoardState>((set, get) => {
  /**
   * Switches the local cache to the signed-in account and loads its boards.
   *
   * The first login also adopts boards created before this feature existed.
   * Without it, those boards would look "lost" even though they are still in
   * the anonymous scope. The one-time flag prevents a second account from
   * inheriting them.
   */
  const activateCloudUser = async (user: {
    id: string;
    email: string | null;
    name: string;
    organization?: string | null;
  }) => {
    const previousBoards = await listBoards();
    const previousSettings = await loadSettings();
    let adoptLegacy = false;
    try {
      adoptLegacy = !localStorage.getItem(SCOPED_STORAGE_KEY) && previousBoards.length > 0;
    } catch {
      adoptLegacy = previousBoards.length > 0;
    }

    setStorageScope(user.id);
    let boards = await listBoards();
    if (!boards.length && adoptLegacy) {
      for (const legacy of previousBoards) await saveBoard(legacy);
      await saveSettings(previousSettings);
      boards = await listBoards();
      try {
        localStorage.setItem(SCOPED_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }

    let settings = await loadSettings();
    let organization = user.organization?.trim() || settings.organization;
    let userName = settings.userName;
    const remoteProfile = await cloudGetProfile(user.id);
    if (!remoteProfile.error && remoteProfile.profile) {
      organization = remoteProfile.profile.organization_name?.trim() || organization;
      const profileName = remoteProfile.profile.display_name?.trim();
      if (profileName) userName = profileName.slice(0, 40);
    } else if (user.name) {
      userName = user.name.slice(0, 40);
    }
    if (organization !== settings.organization || userName !== settings.userName) {
      settings = { ...settings, organization, userName };
      await saveSettings(settings);
    }

    const hash = parseHash();
    const current =
      (hash.boardId ? boards.find((b) => b.id === hash.boardId) : null) ??
      (settings.lastBoardId ? boards.find((b) => b.id === settings.lastBoardId) : null) ??
      null;
    const board = current ?? empty;
    orderCounter = Math.max(1, ...Object.values(board.objects).map((o) => o.order + 1));
    set({
      settings,
      boards: boards.map(metaOf).sort(sortMeta),
      board,
      view: hash.boardId && current ? "board" : "dashboard",
      past: [],
      future: [],
      selection: [],
      editingId: null,
      connectFrom: null,
      contextMenu: null,
      dirty: get().dirty + 1,
    });
    startRealtime(user.id);
    startPolling();
  };

  const deactivateCloudUser = async () => {
    cloudRealtimeUnsub?.();
    cloudRealtimeUnsub = null;
    stopPolling();
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = undefined;
    }
    if (cloudSaveTimer) {
      window.clearTimeout(cloudSaveTimer);
      cloudSaveTimer = undefined;
    }
    setStorageScope(null);
    const settings = await loadSettings();
    const boards = await listBoards();
    const board = boards[0] ?? empty;
    orderCounter = Math.max(1, ...Object.values(board.objects).map((o) => o.order + 1));
    set({
      settings,
      boards: boards.map(metaOf).sort(sortMeta),
      board,
      view: "dashboard",
      past: [],
      future: [],
      selection: [],
      editingId: null,
      connectFrom: null,
      contextMenu: null,
      dirty: get().dirty + 1,
    });
  };

  const applyRealtimeBoard = async (payload: BoardChangePayload) => {
    try {
      if (payload.eventType === "DELETE") {
        await get().refreshBoards();
        return;
      }
      const row = payload.new as { document?: unknown; folder_id?: string | null };
      const incoming = normalizeBoard(row.document);
      if (!incoming) return;
      if (row.folder_id !== undefined) incoming.folderId = row.folder_id;
      const current = get().board;
      if (incoming.id === current.id) {
        if (incoming.updatedAt > current.updatedAt) {
          await saveBoard(incoming);
          set({
            board: incoming,
            past: [],
            future: [],
            selection: [],
            editingId: null,
            dirty: get().dirty + 1,
          });
          get().showToast("Board atualizado por integração.");
        }
        return;
      }
      const meta = get().boards.find((b) => b.id === incoming.id);
      if (!meta || incoming.updatedAt > meta.updatedAt) {
        await saveBoard(incoming);
        get().showToast("Novo conteúdo recebido da integração.");
      }
      await get().refreshBoards();
    } catch {
      /* realtime is best-effort */
    }
  };

  const startRealtime = (userId: string) => {
    if (cloudRealtimeUnsub) return;
    cloudRealtimeUnsub = subscribeToBoardChanges(userId, (payload) => {
      void applyRealtimeBoard(payload);
    });
  };

  const pollCloud = async () => {
    if (cloudPollBusy) return;
    const user = get().cloud.user;
    if (!user) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    cloudPollBusy = true;
    try {
      const remote = await cloudListBoards(user.id);
      if (remote.error) return;
      const current = get().board;
      let metaChanged = false;
      let appliedCurrent = false;
      for (const row of remote.rows) {
        const incoming = normalizeBoard(row.document);
        if (!incoming) continue;
        incoming.folderId = row.folder_id ?? incoming.folderId ?? null;
        if (incoming.id === current.id) {
          if (incoming.updatedAt > current.updatedAt) {
            await saveBoard(incoming);
            set({
              board: incoming,
              past: [],
              future: [],
              selection: [],
              editingId: null,
              dirty: get().dirty + 1,
            });
            appliedCurrent = true;
          }
          continue;
        }
        const meta = get().boards.find((b) => b.id === incoming.id);
        if (!meta || incoming.updatedAt > meta.updatedAt) {
          await saveBoard(incoming);
          metaChanged = true;
        }
      }
      if (metaChanged) await get().refreshBoards();
      if (appliedCurrent) get().showToast("Board atualizado por integração.");
    } catch {
      /* polling is best-effort */
    } finally {
      cloudPollBusy = false;
    }
  };

  const startPolling = () => {
    if (cloudPollTimer) return;
    void pollCloud();
    cloudPollTimer = window.setInterval(() => void pollCloud(), 2500);
  };

  const stopPolling = () => {
    if (!cloudPollTimer) return;
    window.clearInterval(cloudPollTimer);
    cloudPollTimer = undefined;
  };

  const cloudSaveBoard = (board: Board) => {
    const user = get().cloud.user;
    if (!user) return;
    void cloudUpsertBoard(board, user.id).then((err) => {
      if (err) set({ cloud: { ...get().cloud, status: "error", error: cloudErrorMessage(err) } });
      else set({ cloud: { ...get().cloud, status: "online", error: null, lastSync: Date.now() } });
    });
  };

  const cloudRemoveBoard = (id: string) => {
    const user = get().cloud.user;
    if (!user) return;
    void cloudDeleteBoard(id).then((err) => {
      if (err) set({ cloud: { ...get().cloud, status: "error", error: cloudErrorMessage(err) } });
    });
  };

  const commit = (next: Board, history = true) => {
    const current = get().board;
    const past = get().past;
    const base = history ? current : pendingHistory;
    const shouldPush = !!base && past[past.length - 1] !== base;
    const board = touch(next);
    set({
      board,
      past: shouldPush ? [...past.slice(-49), base] : past,
      future: [],
      dirty: get().dirty + 1,
    });
    pendingHistory = null;
    collabClient?.sendBoard(board);
    get().schedulePersist();
  };

  return {
    ready: false,
    view: "dashboard",
    board: empty,
    boards: [],
    settings: {
      theme: "dark",
      grid: true,
      snap: true,
      language: "pt",
      userName: "Alessandro",
      organization: "Minha organização",
      lastBoardId: null,
      relayUrl: "",
      folders: [],
      workspaceFilter: "all",
    },
    selection: [],
    camera: { x: 0, y: 0, zoom: 1 },
    tool: "select",
    editingId: null,
    connectFrom: null,
    contextMenu: null,
    searchOpen: false,
    helpOpen: false,
    templatesOpen: false,
    shareOpen: false,
    layersOpen: false,
    iconPickerOpen: false,
    commentsOpen: false,
    mermaidOpen: false,
    sidebarOpen: true,
    toast: null,
    authOpen: false,
    integrationsOpen: false,
    cloud: {
      configured: isSupabaseConfigured(),
      initialized: false,
      user: null,
      status: isSupabaseConfigured() ? "connecting" : "off",
      error: null,
      lastSync: null,
      syncing: false,
    },
    presentation: false,
    presentationFrameId: null,
    past: [],
    future: [],
    dirty: 0,
    saveState: "idle",
    defaultConnector: {
      color: "gray",
      deco: "outline",
      connectorType: "elbow",
      fromEndpoint: "none",
      toEndpoint: "arrow",
    },
    collab: { room: null, status: "off", peers: [], messages: [] },
    guides: [],

    init: () => {
      if (get().ready) return Promise.resolve();
      if (initPromise) return initPromise;
      initPromise = (async () => {
        await ensureStorageMigrated();
        const settings = await loadSettings();
        const migrated = await migrateLegacyBoard();
        let boards = await listBoards();
        if (migrated && !boards.some((b) => b.id === migrated.id)) boards = await listBoards();
        const hash = parseHash();
        const current =
          (hash.boardId ? boards.find((b) => b.id === hash.boardId) : null) ??
          (settings.lastBoardId ? boards.find((b) => b.id === settings.lastBoardId) : null) ??
          null;
        const board = current ?? empty;
        orderCounter = Math.max(1, ...Object.values(board.objects).map((o) => o.order + 1));
        set({
          ready: true,
          settings,
          boards: boards.map(metaOf).sort(sortMeta),
          board,
          view: hash.boardId && current ? "board" : "dashboard",
          camera: { x: 0, y: 0, zoom: 1 },
        });
        if (hash.room) get().startCollab(hash.room);
      })();
      return initPromise;
    },

    refreshBoards: async () => {
      const boards = await listBoards();
      set({ boards: boards.map(metaOf).sort(sortMeta) });
    },

    schedulePersist: () => {
      if (saveTimer) window.clearTimeout(saveTimer);
      set({ saveState: "saving" });
      saveTimer = window.setTimeout(() => {
        void get().persistNow();
      }, 450);
    },

    persistNow: async () => {
      if (saveTimer) {
        window.clearTimeout(saveTimer);
        saveTimer = undefined;
      }
      const { board, settings, boards } = get();
      try {
        await saveBoard(board);
        await saveSettings(settings);
        const next = boards.filter((b) => b.id !== board.id);
        next.push(metaOf(board));
        set({ saveState: "saved", boards: next.sort(sortMeta) });
        const cloudUser = get().cloud.user;
        if (cloudUser) {
          const snapshot = board;
          if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer);
          cloudSaveTimer = window.setTimeout(async () => {
            const currentUser = get().cloud.user;
            if (!currentUser) return;
            const err = await cloudUpsertBoard(snapshot, currentUser.id);
            if (err) {
              set({ cloud: { ...get().cloud, status: "error", error: cloudErrorMessage(err) } });
            } else {
              set({
                cloud: { ...get().cloud, status: "online", error: null, lastSync: Date.now() },
              });
            }
          }, 1200);
        }
      } catch {
        set({ saveState: "error" });
      }
    },

    setTool: (tool) => set({ tool, connectFrom: null }),
    setEditing: (id) => {
      set({ editingId: id });
      if (!id) get().reflowMindMap();
    },
    setConnectFrom: (id) => set({ connectFrom: id }),

    setCamera: (camera) => set({ camera }),
    panBy: (dx, dy) =>
      set((s) => ({ camera: { ...s.camera, x: s.camera.x + dx, y: s.camera.y + dy } })),
    zoomAt: (screen, factor) => {
      const { camera } = get();
      const zoom = Math.min(4, Math.max(0.08, camera.zoom * factor));
      const k = zoom / camera.zoom;
      const x = screen.x - (screen.x - camera.x) * k;
      const y = screen.y - (screen.y - camera.y) * k;
      set({ camera: { x, y, zoom } });
    },
    fitView: (w, h) => {
      const board = get().board;
      const objects = Object.values(board.objects).filter((o) => !o.hidden);
      if (objects.length === 0) {
        set({ camera: { x: w / 2, y: h / 2, zoom: 1 } });
        return;
      }
      const b = boardBounds(board);
      const pad = 64;
      const zoom = Math.min(1.5, Math.max(0.08, Math.min((w - pad * 2) / Math.max(1, b.w), (h - pad * 2) / Math.max(1, b.h))));
      const x = w / 2 - (b.x + b.w / 2) * zoom;
      const y = h / 2 - (b.y + b.h / 2) * zoom;
      set({ camera: { x, y, zoom } });
    },
    zoomToObject: (id) => {
      const board = get().board;
      const o = board.objects[id];
      if (!o || !("rect" in o) || !o.rect) return;
      const el = typeof document !== "undefined" ? document.querySelector(".canvas-container") : null;
      const w = el?.clientWidth || 1200;
      const h = el?.clientHeight || 800;
      const r = aabbOfRect(o.rect, o.rotation ?? 0);
      const zoom = Math.min(1.6, Math.max(0.2, Math.min((w - 160) / Math.max(1, r.w), (h - 160) / Math.max(1, r.h))));
      set({
        camera: {
          zoom,
          x: w / 2 - (r.x + r.w / 2) * zoom,
          y: h / 2 - (r.y + r.h / 2) * zoom,
        },
      });
    },
    setGuides: (guides) => set({ guides }),

    openContextMenu: (menu) => set({ contextMenu: menu }),
    setSearchOpen: (open) => set({ searchOpen: open }),
    setHelpOpen: (open) => set({ helpOpen: open }),
    setTemplatesOpen: (open) => set({ templatesOpen: open }),
    setShareOpen: (open) => set({ shareOpen: open }),
    setIconPickerOpen: (open) => set({ iconPickerOpen: open }),
    setCommentsOpen: (open) => set({ commentsOpen: open }),
    setMermaidOpen: (open) => set({ mermaidOpen: open }),
    showToast: (text) => {
      if (toastTimer) window.clearTimeout(toastTimer);
      set({ toast: text });
      toastTimer = window.setTimeout(() => set({ toast: null }), 3000);
    },
    toggleLayers: () => set((s) => ({ layersOpen: !s.layersOpen })),
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setAuthOpen: (open) => set({ authOpen: open }),
    setIntegrationsOpen: (open) => set({ integrationsOpen: open }),

    initCloud: () => {
      if (cloudInitPromise) return cloudInitPromise;
      cloudInitPromise = (async () => {
        const configured = isSupabaseConfigured();
        set({ cloud: { ...get().cloud, configured, status: configured ? "connecting" : "off", error: null } });
        if (!configured) {
          set({ cloud: { ...get().cloud, initialized: true } });
          return;
        }
        try {
          if (!cloudAuthUnsub) {
            cloudAuthUnsub = onCloudAuthChange((user) => {
              if (user) {
                const name = user.user_metadata?.display_name || user.email?.split("@")[0] || "Usuário";
                const signed = {
  id: user.id,
  email: user.email ?? null,
  name: String(name),
  organization: (user.user_metadata?.organization_name as string | undefined) ?? null,
};
                const already = get().cloud.user?.id === user.id;
                set({
                  cloud: {
                    ...get().cloud,
                    user: signed,
                    status: "online",
                    error: null,
                  },
                });
                if (!already) {
                  void activateCloudUser(signed).then(() => get().syncCloud());
                }
              } else {
                void deactivateCloudUser().then(() => {
                  set({
                    cloud: { ...get().cloud, user: null, status: "off", lastSync: null, syncing: false, error: null },
                  });
                });
              }
            });
          }
          const { user, error } = await getCloudSession();
          if (error) {
            set({ cloud: { ...get().cloud, status: "error", error: cloudErrorMessage(error) } });
            return;
          }
          if (!user) {
            set({ cloud: { ...get().cloud, status: "off", syncing: false } });
            return;
          }
          const name = user.user_metadata?.display_name || user.email?.split("@")[0] || "Usuário";
          const signed = {
  id: user.id,
  email: user.email ?? null,
  name: String(name),
  organization: (user.user_metadata?.organization_name as string | undefined) ?? null,
};
          set({
            cloud: {
              ...get().cloud,
              user: signed,
              status: "online",
              error: null,
            },
          });
          await activateCloudUser(signed);
          await get().syncCloud();
        } finally {
          set({ cloud: { ...get().cloud, initialized: true } });
        }
      })();
      return cloudInitPromise;
    },

    signInCloud: async (email, password) => {
      set({ cloud: { ...get().cloud, status: "connecting", error: null } });
      const { user, error } = await cloudSignIn(email, password);
      if (error || !user) {
        const message = cloudErrorMessage(error);
        set({ cloud: { ...get().cloud, status: "error", error: message } });
        return message;
      }
      const name = user.user_metadata?.display_name || user.email?.split("@")[0] || "Usuário";
      const signed = {
  id: user.id,
  email: user.email ?? null,
  name: String(name),
  organization: (user.user_metadata?.organization_name as string | undefined) ?? null,
};
      set({
        cloud: {
          ...get().cloud,
          user: signed,
          status: "online",
          error: null,
        },
        authOpen: false,
      });
      await activateCloudUser(signed);
      get().showToast("Conectado ao Supabase.");
      void cloudUpdateProfile(user.id, String(name), get().settings.organization);
      await get().syncCloud();
      return null;
    },

    signUpCloud: async (email, password, name, organization) => {
      set({ cloud: { ...get().cloud, status: "connecting", error: null } });
      const result = await cloudSignUp(email, password, name, organization);
      if (result.error) {
        const message = cloudErrorMessage(result.error);
        set({ cloud: { ...get().cloud, status: "error", error: message } });
        return message;
      }
      if (result.needsConfirmation) {
        set({ cloud: { ...get().cloud, status: "off", error: null }, authOpen: false });
        get().showToast("Conta criada. Confirme o e-mail para entrar.");
        return null;
      }
      if (result.user) {
        const display = name.trim() || result.user.email?.split("@")[0] || "Usuário";
        const org = organization.trim() || display;
        const signed = {
          id: result.user.id,
          email: result.user.email ?? null,
          name: display,
          organization: org,
        };
        set({
          cloud: {
            ...get().cloud,
            user: signed,
            status: "online",
            error: null,
          },
          authOpen: false,
        });
        await activateCloudUser(signed);
        void cloudUpdateProfile(result.user.id, display, org);
        await get().syncCloud();
      }
      return null;
    },

    changeCloudPassword: async (password) => {
      const error = await cloudChangePassword(password);
      if (error) return cloudErrorMessage(error);
      get().showToast("Senha alterada.");
      return null;
    },

    signOutCloud: async () => {
      await cloudSignOut();
      cloudSyncingPromise = null;
      cloudInitPromise = null;
      await deactivateCloudUser();
      set({
        cloud: {
          configured: isSupabaseConfigured(),
          initialized: true,
          user: null,
          status: "off",
          error: null,
          lastSync: null,
          syncing: false,
        },
      });
      get().showToast("Você saiu. Faça login para acessar seus boards.");
    },

    syncCloud: () => {
      const user = get().cloud.user;
      if (!user) {
        set({ authOpen: true });
        return Promise.resolve();
      }
      if (cloudSyncingPromise) return cloudSyncingPromise;
      cloudSyncingPromise = (async () => {
        set({ cloud: { ...get().cloud, syncing: true, status: "connecting", error: null } });
        try {
          const [localBoards, remote, remoteFolders] = await Promise.all([
            listBoards(),
            cloudListBoards(user.id),
            cloudListFolders(user.id),
          ]);
          if (remote.error) throw new Error(remote.error);
          if (remoteFolders.error) throw new Error(remoteFolders.error);
          const merged = mergeCloudState(localBoards, remote.rows, get().settings.folders, remoteFolders.rows);
          const settings = { ...get().settings, folders: merged.folders };
          set({ settings });
          await saveSettings(settings);
          for (const board of merged.toLocal) await saveBoard(board);
          for (const board of merged.toCloud) {
            const err = await cloudUpsertBoard(board, user.id);
            if (err) throw new Error(err);
          }
          const folderError = await cloudReplaceFolders(merged.folders, user.id);
          if (folderError) throw new Error(folderError);
          const current = get().board;
          const downloaded = merged.toLocal.find((b) => b.id === current.id);
          if (downloaded) {
            set({
              board: downloaded,
              past: [],
              future: [],
              selection: [],
              editingId: null,
              dirty: get().dirty + 1,
            });
          }
          await get().refreshBoards();
          set({
            cloud: { ...get().cloud, syncing: false, status: "online", error: null, lastSync: Date.now() },
          });
          get().showToast(
            `Nuvem sincronizada: ${merged.toLocal.length} baixado(s), ${merged.toCloud.length} enviado(s).`,
          );
        } catch (error) {
          const message = cloudErrorMessage(
            error instanceof Error ? error.message : "Falha ao sincronizar com o Supabase.",
          );
          set({ cloud: { ...get().cloud, syncing: false, status: "error", error: message } });
          get().showToast(`Falha na nuvem: ${message}`);
        }
      })().finally(() => {
        cloudSyncingPromise = null;
      });
      return cloudSyncingPromise;
    },

    pushLocalToCloud: async () => {
      const user = get().cloud.user;
      if (!user) {
        set({ authOpen: true });
        return;
      }
      set({ cloud: { ...get().cloud, syncing: true, status: "connecting", error: null } });
      try {
        const boards = await listBoards();
        for (const board of boards) {
          const err = await cloudUpsertBoard(board, user.id);
          if (err) throw new Error(err);
        }
        const folderError = await cloudReplaceFolders(get().settings.folders, user.id);
        if (folderError) throw new Error(folderError);
        set({ cloud: { ...get().cloud, syncing: false, status: "online", error: null, lastSync: Date.now() } });
        get().showToast(`${boards.length} board(s) enviados para a nuvem.`);
      } catch (error) {
        const message = cloudErrorMessage(error instanceof Error ? error.message : "Falha ao enviar boards.");
        set({ cloud: { ...get().cloud, syncing: false, status: "error", error: message } });
        get().showToast(`Falha ao enviar: ${message}`);
      }
    },

    startPresentation: () => {
      const frames = Object.values(get().board.objects)
        .filter((o): o is Frame => o.objectType === "frame" && !o.hidden)
        .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
      const first = frames[0]?.id ?? null;
      set({ presentation: true, presentationFrameId: first, selection: [], editingId: null, contextMenu: null });
      if (first) get().zoomToObject(first);
    },
    stopPresentation: () => set({ presentation: false, presentationFrameId: null }),
    nextFrame: (dir) => {
      const frames = Object.values(get().board.objects)
        .filter((o): o is Frame => o.objectType === "frame" && !o.hidden)
        .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
      if (frames.length === 0) return;
      const current = get().presentationFrameId;
      const idx = Math.max(0, frames.findIndex((f) => f.id === current));
      const next = frames[(idx + dir + frames.length) % frames.length];
      set({ presentationFrameId: next.id, presentation: true });
      get().zoomToObject(next.id);
    },

    select: (id, additive) => {
      if (id === null) {
        set({ selection: [], editingId: null });
        return;
      }
      const board = get().board;
      if (!board.objects[id]) return;
      const expanded = expandSelection(board, [id], { groups: true, descendants: false });
      const cur = get().selection;
      if (additive) {
        const exists = expanded.every((x) => cur.includes(x));
        set({
          selection: exists ? cur.filter((x) => !expanded.includes(x)) : [...new Set([...cur, ...expanded])],
        });
      } else {
        set({ selection: expanded });
      }
    },
    selectMany: (ids) => {
      set({ selection: expandSelection(get().board, ids, { groups: true, descendants: false }) });
    },
    clearSelection: () => set({ selection: [], editingId: null, contextMenu: null }),
    selectAll: () => {
      const board = get().board;
      set({
        selection: Object.values(board.objects)
          .filter((o) => !o.hidden)
          .map((o) => o.id),
      });
    },
    selectConnected: (id) => {
      const board = get().board;
      const ids = new Set([id]);
      for (const o of Object.values(board.objects)) {
        if (o.objectType !== "connector") continue;
        if (o.fromId === id) ids.add(o.toId);
        if (o.toId === id) ids.add(o.fromId);
      }
      get().selectMany([...ids].filter((x) => !!board.objects[x]));
    },

    addShape: (shapeType, rect, opts = {}) => {
      const id = nanoid();
      const sticky = shapeType === "sticky";
      const shape: Shape = withOrder({
        id,
        objectType: "shape",
        parentId: opts.parentId ?? frameAt(get().board, rectCenter(rect))?.id ?? null,
        groupId: null,
        shapeType,
        rect,
        style: sticky ? { color: "yellow", deco: "fill" } : { color: "gray", deco: "outline" },
        text: opts.text ?? "",
        textStyle: { ...DEFAULT_TEXT_STYLE, align: "center" },
        order: 0,
      });
      const board = get().board;
      commit({ ...board, objects: { ...board.objects, [id]: shape } });
      set({ selection: [id], tool: "select" });
      return id;
    },

    addText: (rect) => {
      const id = nanoid();
      const t: TextObject = withOrder({
        id,
        objectType: "text",
        parentId: null,
        groupId: null,
        rect,
        style: { color: "gray", deco: "transparent" },
        text: "Texto",
        textStyle: { ...LEFT_TEXT_STYLE, fontSize: 18 },
        order: 0,
      });
      const board = get().board;
      commit({ ...board, objects: { ...board.objects, [id]: t } });
      set({ selection: [id], tool: "select", editingId: id });
      return id;
    },

    addFrame: (rect) => {
      const id = nanoid();
      const f: Frame = withOrder({
        id,
        objectType: "frame",
        parentId: null,
        groupId: null,
        rect,
        style: { color: "smoke", deco: "outline" },
        text: "Frame",
        textStyle: { ...LEFT_TEXT_STYLE, fontSize: 13, fontWeight: 500 },
        order: 0,
      });
      const board = get().board;
      commit({ ...board, objects: { ...board.objects, [id]: f } });
      set({ selection: [id], tool: "select" });
      return id;
    },

    addImage: (rect, src, alt) => {
      const id = nanoid();
      const image: ImageObject = withOrder({
        id,
        objectType: "image",
        parentId: frameAt(get().board, rectCenter(rect))?.id ?? null,
        groupId: null,
        rect,
        src,
        alt,
        order: 0,
      });
      const board = get().board;
      commit({ ...board, objects: { ...board.objects, [id]: image } });
      set({ selection: [id], tool: "select" });
      return id;
    },

    addIcon: (rect, icon, iconSet, color, strokeWidth = 2) => {
      const id = nanoid();
      const iconObject: IconObject = withOrder({
        id,
        objectType: "icon",
        parentId: frameAt(get().board, rectCenter(rect))?.id ?? null,
        groupId: null,
        rect,
        icon,
        iconSet,
        style: { color: "purple", deco: "outline", hex: color },
        strokeWidth,
        order: 0,
      });
      const board = get().board;
      commit({ ...board, objects: { ...board.objects, [id]: iconObject } });
      set({ selection: [id], tool: "select" });
      return id;
    },

    addIconAtCenter: (icon, iconSet, color, size = 96) => {
      const el = typeof document !== "undefined" ? document.querySelector(".canvas-container") : null;
      const w = el?.clientWidth || 1200;
      const h = el?.clientHeight || 800;
      const camera = get().camera;
      const world = {
        x: (w / 2 - camera.x) / camera.zoom,
        y: (h / 2 - camera.y) / camera.zoom,
      };
      const count = Object.values(get().board.objects).filter((o) => o.objectType === "icon").length;
      const offset = (count % 6) * 16;
      const rect = { x: world.x - size / 2 + offset, y: world.y - size / 2 + offset, w: size, h: size };
      return get().addIcon(rect, icon, iconSet, color);
    },

    addSvgIconAtCenter: (svgData, svgPlate, size = 96) => {
      const el = typeof document !== "undefined" ? document.querySelector(".canvas-container") : null;
      const w = el?.clientWidth || 1200;
      const h = el?.clientHeight || 800;
      const camera = get().camera;
      const world = {
        x: (w / 2 - camera.x) / camera.zoom,
        y: (h / 2 - camera.y) / camera.zoom,
      };
      const count = Object.values(get().board.objects).filter((o) => o.objectType === "icon").length;
      const offset = (count % 6) * 16;
      const rect = { x: world.x - size / 2 + offset, y: world.y - size / 2 + offset, w: size, h: size };
      const id = nanoid();
      const iconObject: IconObject = withOrder({
        id,
        objectType: "icon",
        parentId: frameAt(get().board, rectCenter(rect))?.id ?? null,
        groupId: null,
        rect,
        icon: "svg",
        iconSet: "svg",
        svgData,
        svgPlate,
        style: { color: "purple", deco: "outline" },
        order: 0,
      });
      const board = get().board;
      commit({ ...board, objects: { ...board.objects, [id]: iconObject } });
      set({ selection: [id], tool: "select" });
      return id;
    },

    addConnector: (fromId, toId, type) => {
      if (fromId === toId) return null;
      const board = get().board;
      const from = board.objects[fromId];
      const to = board.objects[toId];
      if (!from || !to || from.objectType === "connector" || to.objectType === "connector") return null;
      if (!("rect" in from) || !("rect" in to) || !from.rect || !to.rect) return null;
      const fromRect = aabbOfRect(from.rect, from.rotation ?? 0);
      const toRect = aabbOfRect(to.rect, to.rotation ?? 0);
      const rel = snapAnchor(fromRect, rectCenter(toRect));
      const toRel = snapAnchor(toRect, rectCenter(fromRect));
      const dflt = get().defaultConnector;
      const id = nanoid();
      const conn: Connector = withOrder({
        id,
        objectType: "connector",
        parentId: null,
        groupId: null,
        fromId,
        toId,
        connectorType: type ?? dflt.connectorType,
        fromRel: rel,
        toRel,
        fromEndpoint: dflt.fromEndpoint,
        toEndpoint: dflt.toEndpoint,
        fromCardinality: null,
        toCardinality: null,
        style: { color: dflt.color, deco: dflt.deco },
        label: "",
        order: 0,
      });
      commit({ ...board, objects: { ...board.objects, [id]: conn } });
      set({ selection: [id] });
      return id;
    },

    addConnectorToPoint: (fromId, point, type) => {
      const board = get().board;
      const from = board.objects[fromId];
      if (!from || from.objectType === "connector" || !("rect" in from) || !from.rect) return null;
      const fromRect = aabbOfRect(from.rect, from.rotation ?? 0);
      const rel = snapAnchor(fromRect, point);
      const dflt = get().defaultConnector;
      const id = nanoid();
      const conn: Connector = withOrder({
        id,
        objectType: "connector",
        parentId: null,
        groupId: null,
        fromId,
        toId: "",
        connectorType: type ?? dflt.connectorType,
        fromRel: rel,
        toRel: { rx: 0.5, ry: 0.5 },
        fromEndpoint: dflt.fromEndpoint,
        toEndpoint: dflt.toEndpoint,
        fromCardinality: null,
        toCardinality: null,
        toPoint: point,
        style: { color: dflt.color, deco: dflt.deco },
        label: "",
        order: 0,
      });
      commit({ ...board, objects: { ...board.objects, [id]: conn } });
      set({ selection: [id] });
      return id;
    },

    quickAdd: (shapeId, direction = "right") => {
      const board = get().board;
      const src = board.objects[shapeId];
      if (!src || src.objectType === "connector" || !("rect" in src) || !src.rect) return null;
      const r = aabbOfRect(src.rect, src.rotation ?? 0);
      const c = rectCenter(r);
      const w = 192;
      const h = 96;
      const gap = 110;
      let rect: Rect;
      let rel: RelativeAnchor;
      let toRel: RelativeAnchor;
      if (direction === "left") {
        rect = { x: r.x - gap - w, y: c.y - h / 2, w, h };
        rel = { rx: 0, ry: 0.5, axis: "x" };
        toRel = { rx: 1, ry: 0.5, axis: "x" };
      } else if (direction === "up") {
        rect = { x: c.x - w / 2, y: r.y - gap - h, w, h };
        rel = { rx: 0.5, ry: 0, axis: "y" };
        toRel = { rx: 0.5, ry: 1, axis: "y" };
      } else if (direction === "down") {
        rect = { x: c.x - w / 2, y: r.y + r.h + gap, w, h };
        rel = { rx: 0.5, ry: 1, axis: "y" };
        toRel = { rx: 0.5, ry: 0, axis: "y" };
      } else {
        rect = { x: r.x + r.w + gap, y: c.y - h / 2, w, h };
        rel = { rx: 1, ry: 0.5, axis: "x" };
        toRel = { rx: 0, ry: 0.5, axis: "x" };
      }
      const newId = nanoid();
      const sourceShape = src.objectType === "shape" ? src : null;
      const shape: Shape = withOrder({
        id: newId,
        objectType: "shape",
        parentId: frameAt(board, rectCenter(rect))?.id ?? null,
        groupId: null,
        shapeType: "rect",
        rect,
        style: sourceShape ? { ...sourceShape.style } : { color: "blue", deco: "outline" },
        text: "",
        textStyle: { ...(sourceShape?.textStyle ?? DEFAULT_TEXT_STYLE), align: "center" },
        order: 0,
      });
      const dflt = get().defaultConnector;
      const conn: Connector = withOrder({
        id: nanoid(),
        objectType: "connector",
        parentId: null,
        groupId: null,
        fromId: shapeId,
        toId: newId,
        connectorType: dflt.connectorType,
        fromRel: rel,
        toRel,
        fromEndpoint: dflt.fromEndpoint,
        toEndpoint: dflt.toEndpoint,
        fromCardinality: null,
        toCardinality: null,
        style: { color: dflt.color, deco: dflt.deco },
        label: "",
        order: 0,
      });
      commit({ ...board, objects: { ...board.objects, [newId]: shape, [conn.id]: conn } });
      set({ selection: [newId] });
      return newId;
    },

    addMindChild: (shapeId) => {
      const board = get().board;
      const src = board.objects[shapeId];
      if (!src || src.objectType === "connector" || !("rect" in src) || !src.rect) return null;
      if (!board.mindMap) return get().quickAdd(shapeId, "right");
      const color =
        src.objectType === "text" && src.mindRoot
          ? MIND_BRANCH_COLORS[
              Object.values(board.objects).filter((o) => o.objectType === "connector" && o.fromId === src.id)
                .length % MIND_BRANCH_COLORS.length
            ]
          : src.objectType === "text"
            ? src.style.color
            : "blue";
      const rect = { x: src.rect.x + src.rect.w + 110, y: src.rect.y, w: 150, h: 30 };
      const id = nanoid();
      const child: TextObject = withOrder({
        id,
        objectType: "text",
        parentId: null,
        groupId: null,
        rect,
        style: { color, deco: "transparent" },
        text: "",
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 15, align: "center" },
        rotation: 0,
        order: 0,
        mindCollapsed: false,
        mindNode: true,
      });
      const conn: Connector = withOrder({
        id: nanoid(),
        objectType: "connector",
        parentId: null,
        groupId: null,
        fromId: shapeId,
        toId: id,
        connectorType: "curved",
        fromRel: { rx: 1, ry: 0.5, axis: "x" },
        toRel: { rx: 0, ry: 0.5, axis: "x" },
        fromEndpoint: "none",
        toEndpoint: "none",
        fromCardinality: null,
        toCardinality: null,
        style: { color, deco: "outline" },
        label: "",
        order: 0,
        mind: true,
      });
      commit({ ...board, objects: { ...board.objects, [id]: child, [conn.id]: conn } });
      set({ selection: [id], tool: "select" });
      get().reflowMindMap();
      return id;
    },

    addMindSibling: (shapeId) => {
      const board = get().board;
      const src = board.objects[shapeId];
      if (!src || src.objectType === "connector" || !("rect" in src) || !src.rect) return null;
      if (!board.mindMap) return get().quickAdd(shapeId, "down");
      const parentLink = Object.values(board.objects).find(
        (o): o is Connector => o.objectType === "connector" && o.toId === shapeId,
      );
      const parentId = parentLink?.fromId ?? shapeId;
      const parent = board.objects[parentId];
      if (!parent || parent.objectType === "connector" || !("rect" in parent) || !parent.rect) return null;
      const color =
        src.objectType === "text" && src.mindRoot
          ? MIND_BRANCH_COLORS[
              Object.values(board.objects).filter((o) => o.objectType === "connector" && o.fromId === src.id)
                .length % MIND_BRANCH_COLORS.length
            ]
          : src.objectType === "text"
            ? src.style.color
            : "blue";
      const y =
        Math.max(src.rect.y + src.rect.h, ...Object.values(board.objects).filter((o) => o.objectType === "text" && o.rect.y >= src.rect.y && o.rect.x === src.rect.x).map((o) => ("rect" in o ? o.rect.y + o.rect.h : 0))) + 12;
      const rect = { x: src.rect.x, y, w: 150, h: 30 };
      const id = nanoid();
      const node: TextObject = withOrder({
        id,
        objectType: "text",
        parentId: null,
        groupId: null,
        rect,
        style: { color, deco: "transparent" },
        text: "",
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 15, align: "center" },
        rotation: 0,
        order: 0,
        mindCollapsed: false,
        mindNode: true,
      });
      const conn: Connector = withOrder({
        id: nanoid(),
        objectType: "connector",
        parentId: null,
        groupId: null,
        fromId: parentId,
        toId: id,
        connectorType: "curved",
        fromRel: { rx: 1, ry: 0.5, axis: "x" },
        toRel: { rx: 0, ry: 0.5, axis: "x" },
        fromEndpoint: "none",
        toEndpoint: "none",
        fromCardinality: null,
        toCardinality: null,
        style: { color, deco: "outline" },
        label: "",
        order: 0,
        mind: true,
      });
      commit({ ...board, objects: { ...board.objects, [id]: node, [conn.id]: conn } });
      set({ selection: [id], tool: "select" });
      get().reflowMindMap();
      return id;
    },

    toggleMindCollapse: (id) => {
      const board = get().board;
      const node = board.objects[id];
      if (!node || node.objectType === "connector") return;
      const objects = { ...board.objects };
      for (const o of Object.values(objects)) {
        if (o.mindHidden) objects[o.id] = { ...o, hidden: false, mindHidden: false };
      }
      objects[id] = { ...objects[id], mindCollapsed: !node.mindCollapsed };

      const hideBranch = (parentId: string) => {
        for (const c of Object.values(objects)) {
          if (c.objectType !== "connector" || c.fromId !== parentId) continue;
          const child = objects[c.toId];
          objects[c.id] = { ...c, hidden: true, mindHidden: true };
          if (child) {
            objects[child.id] = { ...child, hidden: true, mindHidden: true };
            hideBranch(child.id);
          }
        }
      };
      for (const o of Object.values(objects)) {
        if (o.mindCollapsed) hideBranch(o.id);
      }
      commit({ ...board, objects });
      get().reflowMindMap();
    },

    createConnectedNode: (fromId, point) => {
      const board = get().board;
      const src = board.objects[fromId];
      if (!src || src.objectType === "connector" || !("rect" in src) || !src.rect) return null;
      const w = 192;
      const h = 96;
      const rect = { x: point.x - w / 2, y: point.y - h / 2, w, h };
      const newId = nanoid();
      const shape: Shape = withOrder({
        id: newId,
        objectType: "shape",
        parentId: frameAt(board, point)?.id ?? null,
        groupId: null,
        shapeType: "rect",
        rect,
        style: { color: "blue", deco: "outline" },
        text: "",
        textStyle: { ...DEFAULT_TEXT_STYLE, align: "center" },
        order: 0,
      });
      const dflt = get().defaultConnector;
      const conn: Connector = withOrder({
        id: nanoid(),
        objectType: "connector",
        parentId: null,
        groupId: null,
        fromId,
        toId: newId,
        connectorType: dflt.connectorType,
        fromRel: snapAnchor(aabbOfRect(src.rect, src.rotation ?? 0), point),
        toRel: snapAnchor(rect, rectCenter(aabbOfRect(src.rect, src.rotation ?? 0))),
        fromEndpoint: dflt.fromEndpoint,
        toEndpoint: dflt.toEndpoint,
        fromCardinality: null,
        toCardinality: null,
        style: { color: dflt.color, deco: dflt.deco },
        label: "",
        order: 0,
      });
      commit({ ...board, objects: { ...board.objects, [newId]: shape, [conn.id]: conn } });
      set({ selection: [newId] });
      return newId;
    },

    updateObject: (id, patch, history = true) => {
      const board = get().board;
      const obj = board.objects[id];
      if (!obj) return;
      commit({ ...board, objects: { ...board.objects, [id]: { ...obj, ...patch } as BoardObject } }, history);
    },

    updateRect: (id, rect, history = true) => {
      get().updateObject(id, { rect } as Partial<BoardObject>, history);
    },

    setRects: (updates, history = false) => {
      const board = get().board;
      const objects = { ...board.objects };
      let changed = false;
      for (const [id, rect] of Object.entries(updates)) {
        const o = objects[id];
        if (o && "rect" in o && o.rect) {
          objects[id] = { ...o, rect } as BoardObject;
          changed = true;
        }
      }
      if (!changed) return;
      commit({ ...board, objects }, history);
    },

    moveSelection: (dx, dy, history = false) => {
      const { board, selection } = get();
      if (selection.length === 0) return;
      const ids = expandSelection(board, selection, { groups: true, descendants: true }).filter((id) => {
        const o = board.objects[id];
        return !!o && !o.locked && o.objectType !== "connector";
      });
      const updates = collectTranslation(board, ids, dx, dy);
      get().setRects(updates, history);
    },

    nudgeSelection: (dx, dy) => {
      if (!get().selection.length) return;
      const now = Date.now();
      if (now - lastNudgeAt > 500) get().pushHistory();
      lastNudgeAt = now;
      get().moveSelection(dx, dy, false);
    },

    zoomToSelection: () => {
      const { board, selection } = get();
      const rects = selection
        .map((id) => board.objects[id])
        .filter((o): o is Shape | Frame | TextObject | ImageObject | IconObject => !!o && o.objectType !== "connector" && "rect" in o && !!o.rect)
        .map((o) => aabbOfRect(o.rect, o.rotation ?? 0));
      if (!rects.length) return;
      const b = boundsOf(rects);
      const el = typeof document !== "undefined" ? document.querySelector(".canvas-container") : null;
      const w = el?.clientWidth || 1200;
      const h = el?.clientHeight || 800;
      const pad = 150;
      const zoom = Math.min(1.25, Math.max(0.12, Math.min((w - pad) / Math.max(1, b.w), (h - pad) / Math.max(1, b.h))));
      set({ camera: { zoom, x: w / 2 - (b.x + b.w / 2) * zoom, y: h / 2 - (b.y + b.h / 2) * zoom } });
    },

    importMermaid: async (text) => {
      const clean = text.trim();
      if (!clean) return false;
      const kind = detectMermaidKind(clean);
      if (!kind) {
        if (looksLikeOutline(clean)) return get().importMindMap(clean);
        get().showToast("O texto colado não parece ser um diagrama Mermaid nem um outline.");
        return false;
      }
      const el = typeof document !== "undefined" ? document.querySelector(".canvas-container") : null;
      const w = el?.clientWidth || 1200;
      const h = el?.clientHeight || 800;
      const camera = get().camera;
      const origin = {
        x: (w / 2 - camera.x) / camera.zoom,
        y: (h / 2 - camera.y) / camera.zoom,
      };

      const commitBuilt = (built: MermaidBuildResult | null, label: string) => {
        if (!built) return false;
        const objects = { ...get().board.objects };
        for (const o of built.objects) {
          const withO = withOrder(o);
          objects[withO.id] = withO;
        }
        commit({ ...get().board, objects });
        set({ selection: built.ids, tool: "select", editingId: null });
        get().zoomToSelection();
        get().showToast(`${label}: ${built.nodeCount} formas e ${built.edgeCount} conexões.`);
        return true;
      };

      if (kind === "flowchart") {
        const parsed = parseMermaidFlowchart(clean);
        if (parsed && commitBuilt(buildFlowchartObjects(parsed, origin), "Mermaid importado")) return true;
      }

      if (kind === "diagram" && /^\s*erDiagram\b/im.test(clean)) {
        const parsed = parseMermaidEr(clean);
        if (parsed && commitBuilt(buildFlowchartObjects(parsed, origin), "ER Mermaid importado")) return true;
      }

      get().showToast("Renderizando diagrama Mermaid…");
      const image = await renderMermaidImage(clean);
      if (!image) {
        get().showToast("Não consegui interpretar esse Mermaid. Verifique a sintaxe.");
        return false;
      }
      const scale = Math.min(1, 760 / Math.max(1, image.width));
      const iw = image.width * scale;
      const ih = image.height * scale;
      const id = nanoid();
      const img: ImageObject = withOrder({
        id,
        objectType: "image",
        parentId: null,
        groupId: null,
        rect: { x: origin.x - iw / 2, y: origin.y - ih / 2, w: iw, h: ih },
        src: image.dataUrl,
        alt: "Diagrama Mermaid",
        order: 0,
      });
      commit({ ...get().board, objects: { ...get().board.objects, [id]: img } });
      set({ selection: [id], tool: "select", editingId: null });
      get().zoomToSelection();
      get().showToast("Diagrama Mermaid importado como imagem.");
      return true;
    },

    importMindMap: (text) => {
      const clean = text.trim();
      if (!clean || !looksLikeOutline(clean)) {
        get().showToast("O texto não parece ser uma lista/outline com indentação.");
        return false;
      }
      const el = typeof document !== "undefined" ? document.querySelector(".canvas-container") : null;
      const w = el?.clientWidth || 1200;
      const h = el?.clientHeight || 800;
      const camera = get().camera;
      const origin = {
        x: (w / 2 - camera.x) / camera.zoom,
        y: (h / 2 - camera.y) / camera.zoom,
      };
      const built = buildOutlineMindMap(clean, origin);
      if (!built) {
        get().showToast("Não consegui interpretar esse outline.");
        return false;
      }
      const objects = { ...get().board.objects };
      for (const o of built.objects) {
        const withO = withOrder(o);
        objects[withO.id] = withO;
      }
      commit({ ...get().board, mindMap: true, objects });
      set({
        selection: built.ids.filter((id) => objects[id]?.objectType !== "connector"),
        tool: "select",
        editingId: null,
      });
      get().zoomToSelection();
      get().showToast(`${built.count} tópicos importados como mapa mental.`);
      return true;
    },

    startMindMap: () => {
      const existingRoot = Object.values(get().board.objects).find(
        (o) => o.objectType === "text" && o.mindRoot && !o.hidden,
      );
      if (existingRoot && existingRoot.objectType === "text") {
        set({ selection: [existingRoot.id], editingId: existingRoot.id, tool: "select" });
        get().zoomToObject(existingRoot.id);
        get().showToast("Editando o mapa mental existente.");
        return existingRoot.id;
      }
      const el = typeof document !== "undefined" ? document.querySelector(".canvas-container") : null;
      const w = el?.clientWidth || 1200;
      const h = el?.clientHeight || 800;
      const camera = get().camera;
      const origin = {
        x: (w / 2 - camera.x) / camera.zoom,
        y: (h / 2 - camera.y) / camera.zoom,
      };
      const id = nanoid();
      const root: TextObject = withOrder({
        id,
        objectType: "text",
        parentId: null,
        groupId: null,
        rect: { x: origin.x - 85, y: origin.y - 20, w: 170, h: 40 },
        style: { color: "white", deco: "fill", hex: "#ffffff" },
        text: "Mapa Mental",
        textStyle: {
          ...DEFAULT_TEXT_STYLE,
          fontSize: 20,
          fontWeight: 600,
          align: "center",
          color: "#293845",
        },
        rotation: 0,
        order: 0,
        mindCollapsed: false,
        mindRoot: true,
        mindNode: true,
      });
      commit({
        ...get().board,
        mindMap: true,
        objects: { ...get().board.objects, [id]: root },
      });
      set({ selection: [id], editingId: id, tool: "select" });
      get().showToast("Mapa mental criado. Use Tab para criar um ramo e Enter para um irmão.");
      return id;
    },

    reflowMindMap: () => {
      const board = get().board;
      if (!board.mindMap) return;
      const rects = layoutMindMapRects(board.objects);
      if (!rects) return;
      const objects = { ...board.objects };
      for (const [id, rect] of Object.entries(rects)) {
        const node = objects[id];
        if (!node || node.objectType === "connector" || !("rect" in node)) continue;
        objects[id] = { ...node, rect };
      }
      commit({ ...board, objects }, false);
    },

    setStyle: (id, patch) => {
      const board = get().board;
      const o = board.objects[id];
      if (!o || !("style" in o)) return;
      commit({ ...board, objects: { ...board.objects, [id]: { ...o, style: { ...o.style, ...patch } } } });
    },

    setStyleForSelection: (patch) => {
      const board = get().board;
      const ids = expandSelection(board, get().selection, { groups: true, descendants: true });
      const objects = { ...board.objects };
      let changed = false;
      for (const id of ids) {
        const o = objects[id];
        if (o && "style" in o) {
          objects[id] = { ...o, style: { ...o.style, ...patch } } as BoardObject;
          changed = true;
        }
      }
      if (!changed) return;
      commit({ ...board, objects });
    },

    setTextStyle: (id, patch) => {
      const board = get().board;
      const o = board.objects[id];
      if (!o || !("textStyle" in o) || !o.textStyle) return;
      commit({
        ...board,
        objects: { ...board.objects, [id]: { ...o, textStyle: { ...o.textStyle, ...patch } } },
      });
    },

    setTextStyleForSelection: (patch) => {
      const board = get().board;
      const ids = expandSelection(board, get().selection, { groups: true, descendants: true });
      const objects = { ...board.objects };
      let changed = false;
      for (const id of ids) {
        const o = objects[id];
        if (o && "textStyle" in o && o.textStyle) {
          objects[id] = { ...o, textStyle: { ...o.textStyle, ...patch } } as BoardObject;
          changed = true;
        }
      }
      if (!changed) return;
      commit({ ...board, objects });
    },

    setText: (id, text) => {
      const board = get().board;
      const o = board.objects[id];
      if (!o || !("text" in o)) return;
      commit({ ...board, objects: { ...board.objects, [id]: { ...o, text } } }, false);
      if (o.objectType === "text" && (o.mindNode || o.mindRoot)) get().reflowMindMap();
    },

    setBoardTitle: (title) => {
      const board = get().board;
      // Keep the raw value while typing: trimming here would swallow spaces
      // as soon as the user presses them. Cleanup happens on blur/rename.
      commit({ ...board, title: title.slice(0, 120) }, false);
    },

    rotateSelection: () => {
      const board = get().board;
      const ids = expandSelection(board, get().selection, { groups: true, descendants: false }).filter((id) => {
        const o = board.objects[id];
        return !!o && !o.locked && o.objectType !== "connector" && "rect" in o;
      });
      if (!ids.length) return;
      const objects = { ...board.objects };
      for (const id of ids) {
        const o = objects[id];
        if (!o || !("rect" in o)) continue;
        objects[id] = { ...o, rotation: ((o.rotation ?? 0) + 90) % 360 } as BoardObject;
      }
      commit({ ...board, objects });
    },

    swapEndpoints: (id) => {
      const o = get().board.objects[id];
      if (!o || o.objectType !== "connector") return;
      get().updateObject(id, {
        fromId: o.toId,
        toId: o.fromId,
        fromRel: o.toRel,
        toRel: o.fromRel,
        fromEndpoint: o.toEndpoint,
        toEndpoint: o.fromEndpoint,
        fromCardinality: o.toCardinality,
        toCardinality: o.fromCardinality,
        fromPoint: o.toPoint,
        toPoint: o.fromPoint,
      } as Partial<BoardObject>);
    },

    applyConnectorDefaults: (id) => {
      const o = get().board.objects[id];
      if (!o || o.objectType !== "connector") return;
      set({
        defaultConnector: {
          color: o.style.color,
          deco: o.style.deco,
          connectorType: o.connectorType,
          fromEndpoint: o.fromEndpoint,
          toEndpoint: o.toEndpoint,
        },
      });
    },

    setConnectorEndpoint: (id, end, patch) => {
      const o = get().board.objects[id];
      if (!o || o.objectType !== "connector") return;
      const upd: Partial<Connector> = {};
      if (end === "from") {
        if (patch.shapeId !== undefined) upd.fromId = patch.shapeId;
        if (patch.rel !== undefined) upd.fromRel = patch.rel;
        if (patch.point !== undefined) upd.fromPoint = patch.point;
      } else {
        if (patch.shapeId !== undefined) upd.toId = patch.shapeId;
        if (patch.rel !== undefined) upd.toRel = patch.rel;
        if (patch.point !== undefined) upd.toPoint = patch.point;
      }
      get().updateObject(id, upd as Partial<BoardObject>, false);
    },

    setConnectorBend: (id, bend, history = false) => {
      get().updateObject(id, { bend } as Partial<BoardObject>, history);
    },

    setLink: (id, link) => {
      get().updateObject(id, { link: link.trim() || undefined } as Partial<BoardObject>);
    },

    addComment: (id, text) => {
      const board = get().board;
      const o = board.objects[id];
      const trimmed = text.trim();
      if (!o || !trimmed) return;
      const comments = [
        ...(o.comments ?? []),
        { id: nanoid(), author: get().settings.userName, text: trimmed, createdAt: Date.now() },
      ];
      commit({ ...board, objects: { ...board.objects, [id]: { ...o, comments } } });
    },

    resolveComment: (id, commentId) => {
      const board = get().board;
      const o = board.objects[id];
      if (!o?.comments) return;
      const comments = o.comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c));
      commit({ ...board, objects: { ...board.objects, [id]: { ...o, comments } } });
    },

    deleteComment: (id, commentId) => {
      const board = get().board;
      const o = board.objects[id];
      if (!o?.comments) return;
      const comments = o.comments.filter((c) => c.id !== commentId);
      commit({ ...board, objects: { ...board.objects, [id]: { ...o, comments } } });
    },

    deleteSelection: () => {
      const board = get().board;
      if (get().selection.length === 0) return;
      const ids = new Set(expandSelection(board, get().selection, { groups: true, descendants: true }));
      for (const id of [...ids]) {
        const o = board.objects[id];
        if (o?.objectType === "connector") ids.add(id);
      }
      // Remove connectors attached to deleted objects.
      for (const o of Object.values(board.objects)) {
        if (o.objectType === "connector" && (ids.has(o.fromId) || ids.has(o.toId))) ids.add(o.id);
      }
      const objects = { ...board.objects };
      for (const id of ids) delete objects[id];
      commit({ ...board, objects });
      set({ selection: [], editingId: null, contextMenu: null });
    },

    duplicateSelection: () => {
      const board = get().board;
      if (get().selection.length === 0) return;
      const ids = expandSelection(board, get().selection, { groups: true, descendants: true });
      const idSet = new Set(ids);
      const map: Record<string, string> = {};
      const groupMap: Record<string, string> = {};
      for (const id of ids) map[id] = nanoid();
      const objects = { ...board.objects };
      const newIds: string[] = [];
      for (const id of ids) {
        const o = board.objects[id];
        if (!o) continue;
        const nid = map[id];
        const copy = deepClone(o);
        copy.id = nid;
        if (copy.groupId) {
          groupMap[copy.groupId] ??= nanoid();
          copy.groupId = groupMap[copy.groupId];
        }
        copy.parentId = copy.parentId ? (map[copy.parentId] ?? null) : null;
        if ("rect" in copy && copy.rect) {
          copy.rect = { ...copy.rect, x: copy.rect.x + 32, y: copy.rect.y + 32 };
        }
        if (copy.objectType === "connector") {
          copy.fromId = map[copy.fromId] ?? copy.fromId;
          copy.toId = map[copy.toId] ?? copy.toId;
          if (copy.fromPoint) copy.fromPoint = { x: copy.fromPoint.x + 32, y: copy.fromPoint.y + 32 };
          if (copy.toPoint) copy.toPoint = { x: copy.toPoint.x + 32, y: copy.toPoint.y + 32 };
          if (copy.bend) copy.bend = { x: copy.bend.x + 32, y: copy.bend.y + 32 };
        }
        objects[nid] = withOrder(copy);
        newIds.push(nid);
      }
      // Duplicate connectors attached to duplicated nodes (including external endpoints).
      for (const o of Object.values(board.objects)) {
        if (o.objectType !== "connector" || idSet.has(o.id)) continue;
        if (!map[o.fromId] && !map[o.toId]) continue;
        const nid = nanoid();
        const copy = deepClone(o);
        copy.id = nid;
        copy.fromId = map[o.fromId] ?? o.fromId;
        copy.toId = map[o.toId] ?? o.toId;
        if (copy.fromPoint) copy.fromPoint = { x: copy.fromPoint.x + 32, y: copy.fromPoint.y + 32 };
        if (copy.toPoint) copy.toPoint = { x: copy.toPoint.x + 32, y: copy.toPoint.y + 32 };
        if (copy.bend) copy.bend = { x: copy.bend.x + 32, y: copy.bend.y + 32 };
        objects[nid] = withOrder(copy);
        newIds.push(nid);
      }
      commit({ ...board, objects });
      set({ selection: newIds });
    },

    copySelection: () => {
      const board = get().board;
      if (get().selection.length === 0) return;
      const ids = expandSelection(board, get().selection, { groups: true, descendants: true });
      const idSet = new Set(ids);
      const objs: BoardObject[] = [];
      for (const id of ids) {
        const o = board.objects[id];
        if (o) objs.push(deepClone(o));
      }
      for (const o of Object.values(board.objects)) {
        if (o.objectType !== "connector" || idSet.has(o.id)) continue;
        if (idSet.has(o.fromId) && idSet.has(o.toId)) objs.push(deepClone(o));
      }
      clipboard = objs;
      pasteCount = 1;
    },

    cutSelection: () => {
      get().copySelection();
      get().deleteSelection();
    },

    paste: () => {
      if (clipboard.length === 0) return;
      const board = get().board;
      const objects = { ...board.objects };
      const map: Record<string, string> = {};
      const groupMap: Record<string, string> = {};
      for (const o of clipboard) map[o.id] = nanoid();
      const offset = 32 * Math.min(8, pasteCount);
      const newIds: string[] = [];
      for (const o of clipboard) {
        const nid = map[o.id];
        const copy = deepClone(o);
        copy.id = nid;
        if (copy.groupId) {
          groupMap[copy.groupId] ??= nanoid();
          copy.groupId = groupMap[copy.groupId];
        }
        copy.parentId = copy.parentId ? (map[copy.parentId] ?? null) : null;
        if ("rect" in copy && copy.rect) {
          copy.rect = { ...copy.rect, x: copy.rect.x + offset, y: copy.rect.y + offset };
        }
        if (copy.objectType === "connector") {
          copy.fromId = map[copy.fromId] ?? copy.fromId;
          copy.toId = map[copy.toId] ?? copy.toId;
          if (copy.fromPoint) copy.fromPoint = { x: copy.fromPoint.x + offset, y: copy.fromPoint.y + offset };
          if (copy.toPoint) copy.toPoint = { x: copy.toPoint.x + offset, y: copy.toPoint.y + offset };
          if (copy.bend) copy.bend = { x: copy.bend.x + offset, y: copy.bend.y + offset };
        }
        objects[nid] = withOrder(copy);
        newIds.push(nid);
      }
      commit({ ...board, objects });
      pasteCount = Math.min(8, pasteCount + 1);
      set({ selection: newIds, contextMenu: null });
    },

    bringToFront: () => {
      const board = get().board;
      if (!get().selection.length) return;
      const max = Math.max(0, ...Object.values(board.objects).map((o) => o.order));
      const objects = { ...board.objects };
      let n = max + 1;
      for (const id of expandSelection(board, get().selection, { groups: true, descendants: true })) {
        const o = objects[id];
        if (o) objects[id] = { ...o, order: n++ };
      }
      commit(normalizeOrders({ ...board, objects }));
    },

    sendToBack: () => {
      const board = get().board;
      if (!get().selection.length) return;
      const min = Math.min(0, ...Object.values(board.objects).map((o) => o.order));
      const objects = { ...board.objects };
      let n = min - 1;
      const ids = expandSelection(board, get().selection, { groups: true, descendants: true });
      for (const id of ids) {
        const o = objects[id];
        if (o) objects[id] = { ...o, order: n-- };
      }
      commit(normalizeOrders({ ...board, objects }));
    },

    reorderObject: (id, dir) => {
      const board = get().board;
      const sorted = Object.values(board.objects).sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((o) => o.id === id);
      if (idx < 0) return;
      const target = idx + dir;
      if (target < 0 || target >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[target];
      const objects = { ...board.objects };
      objects[a.id] = { ...a, order: b.order };
      objects[b.id] = { ...b, order: a.order };
      commit(normalizeOrders({ ...board, objects }));
    },

    toggleHidden: (id) => {
      const board = get().board;
      const ids = id ? [id] : expandSelection(board, get().selection, { groups: true, descendants: true });
      if (!ids.length) return;
      const objects = { ...board.objects };
      const anyVisible = ids.some((x) => objects[x] && !objects[x].hidden);
      for (const x of ids) {
        const o = objects[x];
        if (o) objects[x] = { ...o, hidden: anyVisible };
      }
      commit({ ...board, objects });
      if (anyVisible) set({ selection: get().selection.filter((x) => !ids.includes(x)) });
    },

    toggleLocked: (id) => {
      const board = get().board;
      const ids = id ? [id] : expandSelection(board, get().selection, { groups: true, descendants: true });
      if (!ids.length) return;
      const objects = { ...board.objects };
      const anyUnlocked = ids.some((x) => objects[x] && !objects[x].locked);
      for (const x of ids) {
        const o = objects[x];
        if (o) objects[x] = { ...o, locked: anyUnlocked };
      }
      commit({ ...board, objects });
    },

    alignSelection: (edge) => {
      const board = get().board;
      const ids = expandSelection(board, get().selection, { groups: true, descendants: false });
      const items = rectObjects(board, ids).filter((o) => !o.hidden && !o.locked);
      if (items.length < 2) return;
      const b = boundsOf(items.map((o) => aabbOfRect(o.rect, o.rotation ?? 0)));
      const updates: Record<string, Rect> = {};
      const applied = new Set<string>();
      for (const o of items) {
        const r = aabbOfRect(o.rect, o.rotation ?? 0);
        let dx = 0;
        let dy = 0;
        if (edge === "left") dx = b.x - r.x;
        else if (edge === "right") dx = b.x + b.w - (r.x + r.w);
        else if (edge === "center") dx = b.x + b.w / 2 - (r.x + r.w / 2);
        else if (edge === "top") dy = b.y - r.y;
        else if (edge === "bottom") dy = b.y + b.h - (r.y + r.h);
        else if (edge === "middle") dy = b.y + b.h / 2 - (r.y + r.h / 2);
        if (!dx && !dy) continue;
        const moved = collectTranslation(board, [o.id], dx, dy);
        for (const [id, rect] of Object.entries(moved)) {
          if (!applied.has(id)) {
            updates[id] = rect;
            applied.add(id);
          }
        }
      }
      if (Object.keys(updates).length) get().setRects(updates, true);
    },

    distributeSelection: (axis) => {
      const board = get().board;
      const ids = expandSelection(board, get().selection, { groups: true, descendants: false });
      const items = rectObjects(board, ids).filter((o) => !o.hidden && !o.locked);
      if (items.length < 3) return;
      items.sort((a, b) => (axis === "h" ? a.rect.x - b.rect.x : a.rect.y - b.rect.y));
      const b = boundsOf(items.map((o) => aabbOfRect(o.rect, o.rotation ?? 0)));
      const total = axis === "h" ? b.w : b.h;
      const sizes = items.reduce((acc, o) => acc + (axis === "h" ? aabbOfRect(o.rect, o.rotation ?? 0).w : aabbOfRect(o.rect, o.rotation ?? 0).h), 0);
      const gap = (total - sizes) / (items.length - 1);
      let cursor = axis === "h" ? b.x : b.y;
      const updates: Record<string, Rect> = {};
      const applied = new Set<string>();
      for (const o of items) {
        const r = aabbOfRect(o.rect, o.rotation ?? 0);
        const size = axis === "h" ? r.w : r.h;
        const dx = axis === "h" ? cursor - r.x : 0;
        const dy = axis === "v" ? cursor - r.y : 0;
        const moved = collectTranslation(board, [o.id], dx, dy);
        for (const [id, rect] of Object.entries(moved)) {
          if (!applied.has(id)) {
            updates[id] = rect;
            applied.add(id);
          }
        }
        cursor += size + gap;
      }
      if (Object.keys(updates).length) get().setRects(updates, true);
    },

    autoLayout: () => {
      const board = get().board;
      const shapes = Object.values(board.objects).filter(
        (o): o is Shape => o.objectType === "shape" && !o.hidden,
      );
      const conns = Object.values(board.objects).filter(
        (o): o is Connector => o.objectType === "connector" && !o.hidden,
      );
      if (shapes.length === 0) return;
      void import("@dagrejs/dagre").then(({ default: dagre }) => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 110, marginx: 40, marginy: 40 });
        g.setDefaultEdgeLabel(() => ({}));
        for (const s of shapes) g.setNode(s.id, { width: s.rect.w, height: s.rect.h });
        for (const c of conns) {
          if (board.objects[c.fromId] && board.objects[c.toId]) g.setEdge(c.fromId, c.toId);
        }
        dagre.layout(g);
        const objects = { ...get().board.objects };
        for (const s of shapes) {
          const n = g.node(s.id);
          if (n) objects[s.id] = { ...s, rect: { ...s.rect, x: n.x - n.width / 2, y: n.y - n.height / 2 } } as BoardObject;
        }
        commit({ ...get().board, objects });
        get().fitView(
          document.querySelector(".canvas-container")?.clientWidth ?? 1200,
          document.querySelector(".canvas-container")?.clientHeight ?? 800,
        );
      });
    },

    mindMapLayout: () => {
      const board = get().board;
      if (board.mindMap) {
        get().showToast("O mapa mental já usa layout automático por ramos.");
        return;
      }
      const selected = get().selection.map((id) => board.objects[id]).filter(Boolean);
      const root =
        selected.find((o) => o.objectType !== "connector") ??
        Object.values(board.objects).find((o) => o.objectType === "shape" && !o.parentId) ??
        null;
      if (!root || root.objectType === "connector" || !("rect" in root) || !root.rect) return;
      const c = rectCenter(root.rect);
      const children = Object.values(board.objects).filter((o) => {
        if (o.objectType === "connector") return false;
        if (!("rect" in o) || !o.rect) return false;
        if (o.id === root.id) return false;
        if (o.parentId === root.id) return true;
        return Object.values(board.objects).some(
          (conn) =>
            conn.objectType === "connector" &&
            ((conn.fromId === root.id && conn.toId === o.id) || (conn.toId === root.id && conn.fromId === o.id)),
        );
      });
      const objects = { ...board.objects };
      const radius = Math.max(320, 180 + children.length * 24);
      children.forEach((child, i) => {
        const angle = (Math.PI * 2 * i) / Math.max(1, children.length) - Math.PI / 2;
        if (!("rect" in child) || !child.rect) return;
        const rr = radius + (i % 2 === 0 ? 0 : 80);
        objects[child.id] = {
          ...child,
          parentId: child.parentId ?? null,
          rect: {
            ...child.rect,
            x: c.x + Math.cos(angle) * rr - child.rect.w / 2,
            y: c.y + Math.sin(angle) * rr - child.rect.h / 2,
          },
        } as BoardObject;
      });
      commit({ ...board, objects });
      get().fitView(
        document.querySelector(".canvas-container")?.clientWidth ?? 1200,
        document.querySelector(".canvas-container")?.clientHeight ?? 800,
      );
    },

    frameToContents: (id) => {
      const board = get().board;
      const frame = board.objects[id];
      if (!frame || frame.objectType !== "frame") return;
      const children = Object.values(board.objects).filter(
        (o) => o.parentId === id && o.objectType !== "connector" && "rect" in o && !!o.rect,
      );
      if (!children.length) return;
      const b = boundsOf(children.map((o) => aabbOfRect((o as Shape).rect, o.rotation ?? 0)));
      const pad = 28;
      commit({
        ...board,
        objects: {
          ...board.objects,
          [id]: { ...frame, rect: { x: b.x - pad, y: b.y - pad - 20, w: b.w + pad * 2, h: b.h + pad * 2 + 20 } },
        },
      });
    },

    reparentSelection: (frameId) => {
      const board = get().board;
      const ids = expandSelection(board, get().selection, { groups: true, descendants: false });
      const objects = { ...board.objects };
      let changed = false;
      for (const id of ids) {
        const o = objects[id];
        if (!o || o.objectType === "frame" || o.objectType === "connector" || o.locked) continue;
        if (frameId && isDescendant(board, frameId, id)) continue;
        if (o.parentId !== frameId) {
          objects[id] = { ...o, parentId: frameId } as BoardObject;
          changed = true;
        }
      }
      if (changed) commit({ ...board, objects }, false);
    },

    groupSelection: () => {
      const board = get().board;
      const ids = expandSelection(board, get().selection, { groups: false, descendants: true }).filter((id) => {
        const o = board.objects[id];
        return !!o && o.objectType !== "connector";
      });
      if (ids.length < 2) return;
      const groupId = nanoid();
      const objects = { ...board.objects };
      for (const id of ids) {
        const o = objects[id];
        if (o) objects[id] = { ...o, groupId } as BoardObject;
      }
      commit({ ...board, objects });
      set({ selection: ids });
    },

    ungroupSelection: () => {
      const board = get().board;
      const groups = new Set(
        get()
          .selection.map((id) => board.objects[id]?.groupId)
          .filter((g): g is string => !!g),
      );
      if (!groups.size) return;
      const objects = { ...board.objects };
      for (const o of Object.values(objects)) {
        if (o.groupId && groups.has(o.groupId)) objects[o.id] = { ...o, groupId: null } as BoardObject;
      }
      commit({ ...board, objects });
    },

    pushHistory: () => {
      const { board, past } = get();
      if (past[past.length - 1] === board) return;
      pendingHistory = board;
    },

    undo: () => {
      const { past, future, board } = get();
      if (past.length === 0) return;
      pendingHistory = null;
      const prev = past[past.length - 1];
      set({
        board: prev,
        past: past.slice(0, -1),
        future: [board, ...future].slice(0, 50),
        selection: [],
        editingId: null,
        dirty: get().dirty + 1,
      });
      collabClient?.sendBoard(prev);
      get().schedulePersist();
    },

    redo: () => {
      const { past, future, board } = get();
      if (future.length === 0) return;
      pendingHistory = null;
      const next = future[0];
      set({
        board: next,
        future: future.slice(1),
        past: [...past, board],
        selection: [],
        editingId: null,
        dirty: get().dirty + 1,
      });
      collabClient?.sendBoard(next);
      get().schedulePersist();
    },

    loadBoard: (board) => {
      const normalized = normalizeBoard(board);
      if (!normalized) return;
      pendingHistory = null;
      orderCounter = Math.max(1, ...Object.values(normalized.objects).map((o) => o.order + 1));
      set({
        board: normalized,
        view: "board",
        past: [],
        future: [],
        selection: [],
        camera: { x: 0, y: 0, zoom: 1 },
        dirty: get().dirty + 1,
      });
      get().schedulePersist();
    },

    openBoard: async (id) => {
      if (get().view === "board" && get().board.id !== id) await get().persistNow();
      const board = await getBoard(id);
      if (!board) return;
      orderCounter = Math.max(1, ...Object.values(board.objects).map((o) => o.order + 1));
      pendingHistory = null;
      const settings = { ...get().settings, lastBoardId: id };
      set({
        board,
        view: "board",
        selection: [],
        past: [],
        future: [],
        camera: { x: 0, y: 0, zoom: 1 },
        editingId: null,
        contextMenu: null,
        settings,
        presentation: false,
      });
      await saveSettings(settings);
      writeHash(id, get().collab.room);
      window.setTimeout(() => {
        const el = document.querySelector(".canvas-container");
        get().fitView(el?.clientWidth || window.innerWidth, el?.clientHeight || window.innerHeight);
      }, 30);
    },

    createNewBoard: async (template = "blank", title, folderId = null) => {
      const info = TEMPLATES.find((t) => t.id === template);
      const fallbackTitle = template === "blank" ? "Board sem título" : info?.name || "Board sem título";
      const board = createBoard(title?.trim() || fallbackTitle, template);
      board.folderId = folderId;
      await saveBoard(board);
      cloudSaveBoard(board);
      await get().refreshBoards();
      await get().openBoard(board.id);
    },

    duplicateBoard: async (id) => {
      const source = id === get().board.id ? get().board : await getBoard(id);
      if (!source) return;
      const copy = deepClone(source);
      copy.id = nanoid();
      copy.title = `${source.title} (cópia)`;
      const ts = Date.now();
      copy.createdAt = ts;
      copy.updatedAt = ts;
      await saveBoard(copy);
      cloudSaveBoard(copy);
      await get().refreshBoards();
      await get().openBoard(copy.id);
    },

    removeBoard: async (id) => {
      const wasCurrent = get().board.id === id;
      await deleteBoardFromStore(id);
      cloudRemoveBoard(id);
      const remaining = await listBoards();
      set({ boards: remaining.map(metaOf).sort(sortMeta) });
      if (wasCurrent) {
        const next = remaining[0] ?? null;
        if (next) {
          orderCounter = Math.max(1, ...Object.values(next.objects).map((o) => o.order + 1));
          const settings = { ...get().settings, lastBoardId: next.id };
          set({
            board: next,
            view: "board",
            selection: [],
            past: [],
            future: [],
            camera: { x: 0, y: 0, zoom: 1 },
            editingId: null,
            settings,
          });
          await saveSettings(settings);
          writeHash(next.id, get().collab.room);
        } else {
          const settings = { ...get().settings, lastBoardId: null };
          set({ board: empty, view: "dashboard", selection: [], past: [], future: [], settings });
          await saveSettings(settings);
          writeHash(null, get().collab.room);
        }
      }
    },

    renameBoard: async (id, title) => {
      const clean = slugTitle(title);
      if (get().board.id === id) {
        get().setBoardTitle(clean);
        await get().persistNow();
      } else {
        const board = await getBoard(id);
        if (!board) return;
        board.title = clean;
        board.updatedAt = Date.now();
        await saveBoard(board);
        cloudSaveBoard(board);
      }
      await get().refreshBoards();
    },

    setBoardFolder: async (id, folderId) => {
      if (get().board.id === id) {
        const board = { ...get().board, folderId, updatedAt: Date.now() };
        set({ board });
        await saveBoard(board);
        cloudSaveBoard(board);
        await get().refreshBoards();
        return;
      }
      const board = await getBoard(id);
      if (!board) return;
      board.folderId = folderId;
      board.updatedAt = Date.now();
      await saveBoard(board);
      cloudSaveBoard(board);
      await get().refreshBoards();
    },

    importBoard: async (raw) => {
      const normalized = normalizeBoard(raw);
      if (!normalized) return false;
      if (await getBoard(normalized.id)) normalized.id = nanoid();
      normalized.updatedAt = Date.now();
      await saveBoard(normalized);
      cloudSaveBoard(normalized);
      await get().refreshBoards();
      await get().openBoard(normalized.id);
      return true;
    },

    openExample: async () => {
      try {
        const res = await fetch("/seed-dayan.json");
        if (!res.ok) return;
        const raw = (await res.json()) as unknown;
        const board = normalizeBoard(raw);
        if (!board) return;
        board.id = nanoid();
        board.title = "Dayan Siebra (exemplo)";
        board.folderId = null;
        board.updatedAt = Date.now();
        await saveBoard(board);
        cloudSaveBoard(board);
        await get().refreshBoards();
        await get().openBoard(board.id);
      } catch {
        /* optional */
      }
    },

    returnToDashboard: async () => {
      await get().persistNow();
      pendingHistory = null;
      const settings = { ...get().settings, lastBoardId: null };
      set({
        view: "dashboard",
        selection: [],
        past: [],
        future: [],
        editingId: null,
        contextMenu: null,
        presentation: false,
        settings,
      });
      await saveSettings(settings);
      writeHash(null, get().collab.room);
      await get().refreshBoards();
    },

    updateSettings: (patch) => {
      const settings = normalizeSettings({ ...get().settings, ...patch });
      set({ settings });
      if (patch.userName !== undefined) collabClient?.setUserName(settings.userName);
      void saveSettings(settings);
      const cloudUser = get().cloud.user;
      if (patch.folders && cloudUser) {
        void cloudReplaceFolders(settings.folders, cloudUser.id).then((err) => {
          if (err) set({ cloud: { ...get().cloud, status: "error", error: cloudErrorMessage(err) } });
          else set({ cloud: { ...get().cloud, status: "online", error: null, lastSync: Date.now() } });
        });
      }
      if (patch.organization !== undefined && cloudUser) {
        void cloudUpdateProfile(cloudUser.id, settings.userName, settings.organization).then((err) => {
          if (err) set({ cloud: { ...get().cloud, status: "error", error: cloudErrorMessage(err) } });
        });
      }
    },
    toggleTheme: () => get().updateSettings({ theme: get().settings.theme === "dark" ? "light" : "dark" }),
    toggleGrid: () => get().updateSettings({ grid: !get().settings.grid }),
    toggleSnap: () => get().updateSettings({ snap: !get().settings.snap }),

    startCollab: (room) => {
      const clean = room.trim();
      if (!clean) return;
      collabClient?.disconnect();
      const client = new CollabClient(clean, get().settings.userName, get().settings.relayUrl, {
        onBoard: (remote, at) => {
          const incoming = normalizeBoard(remote);
          if (!incoming) return;
          if (incoming.id !== get().board.id) return;
          if (incoming.updatedAt < get().board.updatedAt) {
            collabClient?.sendBoard(get().board);
            return;
          }
          set({
            board: { ...incoming, updatedAt: at },
            dirty: get().dirty + 1,
            past: get().past,
            future: get().future,
          });
          get().schedulePersist();
        },
        onPeers: (peers) => set({ collab: { ...get().collab, peers } }),
        onChat: (message) =>
          set({
            collab: { ...get().collab, messages: [...get().collab.messages, message].slice(-120) },
          }),
        onStatus: (status, detail) => set({ collab: { ...get().collab, status, detail } }),
      });
      collabClient = client;
      set({
        collab: { room: clean, status: "connecting", peers: [], messages: get().collab.messages },
      });
      client.connect();
      client.sendBoard(get().board);
      writeHash(get().board.id, clean);
    },

    leaveCollab: () => {
      collabClient?.disconnect();
      collabClient = null;
      set({ collab: { room: null, status: "off", peers: [], messages: [] } });
      writeHash(get().board.id, null);
    },

    sendChat: (text) => {
      collabClient?.sendChat(text);
    },
  };
});
