import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Board, Folder } from "../types";

const LS_URL = "whim.supabase.url";
const LS_KEY = "whim.supabase.anon";

export interface SupabaseConfig {
  url: string;
  key: string;
  fromEnv: boolean;
}

export interface CloudBoardRow {
  id: string;
  owner_id: string;
  title: string;
  folder_id: string | null;
  document: Board;
  is_public?: boolean;
  share_token?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloudFolderRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

function envUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
}
function envKey(): string {
  return (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
}

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function getSupabaseConfig(): SupabaseConfig {
  let storedUrl = "";
  let storedKey = "";
  try {
    storedUrl = localStorage.getItem(LS_URL) ?? "";
    storedKey = localStorage.getItem(LS_KEY) ?? "";
  } catch {
    /* ignore */
  }
  if (storedUrl && storedKey) {
    return { url: cleanUrl(storedUrl), key: storedKey, fromEnv: false };
  }
  return { url: cleanUrl(envUrl()), key: envKey(), fromEnv: true };
}

export function isSupabaseConfigured(): boolean {
  const cfg = getSupabaseConfig();
  return !!cfg.url && !!cfg.key;
}

export function setSupabaseRuntimeConfig(url: string, key: string) {
  const clean = cleanUrl(url);
  try {
    if (clean && key.trim()) {
      localStorage.setItem(LS_URL, clean);
      localStorage.setItem(LS_KEY, key.trim());
    } else {
      localStorage.removeItem(LS_URL);
      localStorage.removeItem(LS_KEY);
    }
  } catch {
    /* ignore */
  }
  client = null;
}

export function clearSupabaseRuntimeConfig() {
  try {
    localStorage.removeItem(LS_URL);
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  client = null;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.key) return null;
  try {
    client = createClient(cfg.url, cfg.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "whim.supabase.auth",
      },
    });
  } catch {
    client = null;
  }
  return client;
}

export async function getCloudSession(): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { user: null, error: "Supabase não configurado." };
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { user: null, error: error.message };
    return { user: data.session?.user ?? null, error: null };
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : "Falha ao ler a sessão." };
  }
}

export function onCloudAuthChange(callback: (user: User | null) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function cloudSignIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { user: null, error: "Supabase não configurado." };
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return { user: data.user ?? null, error: error?.message ?? null };
}

export async function cloudSignUp(
  email: string,
  password: string,
  displayName: string,
): Promise<{ user: User | null; needsConfirmation: boolean; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { user: null, needsConfirmation: false, error: "Supabase não configurado." };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() || email.split("@")[0] },
      emailRedirectTo: window.location.origin,
    },
  });
  return {
    user: data.user ?? null,
    needsConfirmation: !data.session,
    error: error?.message ?? null,
  };
}

export async function cloudSignOut(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { error } = await supabase.auth.signOut();
  return error?.message ?? null;
}

export async function cloudUpdateProfile(userId: string, displayName: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Supabase não configurado.";
  const { error } = await supabase.from("profiles").upsert(
    { id: userId, display_name: displayName.trim().slice(0, 80), updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  return error?.message ?? null;
}

export async function cloudListBoards(userId: string): Promise<{ rows: CloudBoardRow[]; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { rows: [], error: "Supabase não configurado." };
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as CloudBoardRow[], error: null };
}

export async function cloudUpsertBoard(board: Board, userId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Supabase não configurado.";
  const { error } = await supabase.from("boards").upsert(
    {
      id: board.id,
      owner_id: userId,
      title: board.title,
      folder_id: board.folderId ?? null,
      document: board,
      updated_at: new Date(board.updatedAt).toISOString(),
    },
    { onConflict: "id" },
  );
  return error?.message ?? null;
}

export async function cloudDeleteBoard(id: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Supabase não configurado.";
  const { error } = await supabase.from("boards").delete().eq("id", id);
  return error?.message ?? null;
}

export async function cloudListFolders(userId: string): Promise<{ rows: CloudFolderRow[]; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { rows: [], error: "Supabase não configurado." };
  const { data, error } = await supabase.from("folders").select("*").eq("owner_id", userId).order("created_at");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as CloudFolderRow[], error: null };
}

export async function cloudReplaceFolders(folders: Folder[], userId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Supabase não configurado.";
  if (!folders.length) return null;
  const { error } = await supabase.from("folders").upsert(
    folders.map((f) => ({
      id: f.id,
      owner_id: userId,
      name: f.name,
      created_at: new Date(f.createdAt).toISOString(),
    })),
    { onConflict: "id" },
  );
  // Intentionally only upserts: deleting a folder is an explicit user action,
  // not a side effect of syncing a device that hasn't seen the folder yet.
  return error?.message ?? null;
}
