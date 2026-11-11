import type { Board, Settings } from "../types";
import { normalizeBoard, normalizeSettings } from "./schema";

const DB_NAME = "whimsical-clone";
const DB_VERSION = 1;
const STORE_BOARDS = "boards";
const STORE_SETTINGS = "settings";

const LS_BOARDS = "whim.boards.v2";
const LS_SETTINGS = "whim.settings.v2";
const LS_LEGACY_BOARD = "whim.board.v1";

/**
 * Boards/settings are stored per signed-in account, so two people using the
 * same browser never see each other's data. `null` means the anonymous/legacy
 * scope used before the first login.
 */
let scope: string | null = null;
let dbPromise: Promise<IDBDatabase | null> | null = null;

export function getStorageScope(): string | null {
  return scope;
}

export function setStorageScope(next: string | null): void {
  const clean = next ? next.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) : null;
  if (clean === scope) return;
  scope = clean || null;
  dbPromise = null;
}

function dbName(): string {
  return scope ? `${DB_NAME}:${scope}` : DB_NAME;
}

function lsKey(base: string): string {
  return scope ? `${base}:${scope}` : base;
}


function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(dbName(), DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_BOARDS)) db.createObjectStore(STORE_BOARDS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function lsRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsWrite(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export async function listBoards(): Promise<Board[]> {
  const db = await openDB();
  let raw: unknown[] = [];
  if (db) {
    try {
      raw = await tx<unknown[]>(db, STORE_BOARDS, "readonly", (s) => s.getAll());
    } catch {
      raw = [];
    }
  } else {
    raw = lsRead<unknown[]>(lsKey(LS_BOARDS), []);
  }
  const out: Board[] = [];
  for (const item of raw) {
    const board = normalizeBoard(item);
    if (board) out.push(board);
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getBoard(id: string): Promise<Board | null> {
  const db = await openDB();
  let raw: unknown = null;
  if (db) {
    try {
      raw = await tx<unknown>(db, STORE_BOARDS, "readonly", (s) => s.get(id));
    } catch {
      raw = null;
    }
  } else {
    const all = lsRead<unknown[]>(lsKey(LS_BOARDS), []);
    raw = all.find((b) => !!b && typeof b === "object" && (b as { id?: string }).id === id) ?? null;
  }
  return normalizeBoard(raw);
}

export async function saveBoard(board: Board): Promise<void> {
  const db = await openDB();
  if (db) {
    try {
      await tx(db, STORE_BOARDS, "readwrite", (s) => s.put(board));
      return;
    } catch {
      /* fall through to localStorage */
    }
  }
  const all = lsRead<Board[]>(lsKey(LS_BOARDS), []);
  const next = all.filter((b) => b.id !== board.id);
  next.push(board);
  lsWrite(lsKey(LS_BOARDS), next);
}

export async function deleteBoard(id: string): Promise<void> {
  const db = await openDB();
  if (db) {
    try {
      await tx(db, STORE_BOARDS, "readwrite", (s) => s.delete(id));
      return;
    } catch {
      /* fall through */
    }
  }
  const all = lsRead<Board[]>(lsKey(LS_BOARDS), []);
  lsWrite(
    lsKey(LS_BOARDS),
    all.filter((b) => b.id !== id),
  );
}

export async function loadSettings(): Promise<Settings> {
  const db = await openDB();
  if (db) {
    try {
      const raw = await tx<unknown>(db, STORE_SETTINGS, "readonly", (s) => s.get("settings"));
      if (raw) return normalizeSettings(raw);
    } catch {
      /* fall through */
    }
  }
  return normalizeSettings(lsRead<unknown>(lsKey(LS_SETTINGS), null));
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await openDB();
  if (db) {
    try {
      await tx(db, STORE_SETTINGS, "readwrite", (s) => s.put(settings, "settings"));
      // Keep a localStorage mirror so settings survive an IDB reset.
      lsWrite(lsKey(LS_SETTINGS), settings);
      return;
    } catch {
      /* fall through */
    }
  }
  lsWrite(lsKey(LS_SETTINGS), settings);
}

/**
 * Migrates the pre-v2 single-board localStorage payload into the board store.
 * Returns the migrated board (if any) so the UI can open it.
 */
export async function migrateLegacyBoard(): Promise<Board | null> {
  let raw: unknown = null;
  try {
    const legacy = localStorage.getItem(LS_LEGACY_BOARD);
    if (legacy) raw = JSON.parse(legacy);
  } catch {
    raw = null;
  }
  if (!raw) return null;
  const board = normalizeBoard(raw);
  if (!board) return null;
  board.title = board.title === "Board sem título" ? "Meu board" : board.title;
  await saveBoard(board);
  try {
    localStorage.removeItem(LS_LEGACY_BOARD);
  } catch {
    /* ignore */
  }
  return board;
}
