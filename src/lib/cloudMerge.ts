import type { Board, Folder } from "../types";
import { normalizeBoard } from "./schema";
import type { CloudBoardRow, CloudFolderRow } from "./supabase";

export interface CloudMergeResult {
  toLocal: Board[];
  toCloud: Board[];
  folders: Folder[];
}

/**
 * Two-way, newest-wins merge between local boards and cloud rows.
 *
 * - Boards exist only locally → upload.
 * - Boards exist only in the cloud → download.
 * - Both exist → compare the board document's updatedAt.
 *
 * The row's `updated_at` is only a fallback: Postgres touches it on every
 * upsert, which would otherwise make the server copy look newer forever.
 */
export function mergeCloudState(
  localBoards: Board[],
  remoteRows: CloudBoardRow[],
  localFolders: Folder[],
  remoteFolders: CloudFolderRow[],
): CloudMergeResult {
  const localMap = new Map(localBoards.map((b) => [b.id, b]));
  const remoteMap = new Map<string, { board: Board; at: number }>();

  for (const row of remoteRows) {
    const board = normalizeBoard(row.document);
    if (!board) continue;
    const at = Number.isFinite(board.updatedAt)
      ? board.updatedAt
      : Date.parse(row.updated_at) || 0;
    remoteMap.set(board.id, {
      board: { ...board, folderId: row.folder_id ?? board.folderId ?? null },
      at,
    });
  }

  const toLocal: Board[] = [];
  const toCloud: Board[] = [];

  for (const [id, local] of localMap) {
    const remote = remoteMap.get(id);
    if (!remote) {
      toCloud.push(local);
    } else if (local.updatedAt >= remote.at) {
      toCloud.push(local);
    } else {
      toLocal.push(remote.board);
    }
  }
  for (const [id, remote] of remoteMap) {
    if (!localMap.has(id)) toLocal.push(remote.board);
  }

  const folderMap = new Map<string, Folder>();
  for (const folder of localFolders) folderMap.set(folder.id, folder);
  for (const row of remoteFolders) {
    if (folderMap.has(row.id)) continue;
    folderMap.set(row.id, {
      id: row.id,
      name: row.name,
      createdAt: Date.parse(row.created_at) || Date.now(),
    });
  }

  return {
    toLocal,
    toCloud,
    folders: [...folderMap.values()].sort((a, b) => a.createdAt - b.createdAt),
  };
}
