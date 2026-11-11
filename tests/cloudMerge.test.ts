import { describe, expect, it } from "vitest";
import { mergeCloudState } from "../src/lib/cloudMerge";
import { createBoard } from "../src/lib/templates";
import type { Board } from "../src/types";
import type { CloudBoardRow } from "../src/lib/supabase";

function board(id: string, title: string, updatedAt: number): Board {
  const b = createBoard(title, "blank");
  b.id = id;
  b.title = title;
  b.updatedAt = updatedAt;
  return b;
}

function row(boardValue: Board): CloudBoardRow {
  return {
    id: boardValue.id,
    owner_id: "user-1",
    title: boardValue.title,
    folder_id: boardValue.folderId ?? null,
    document: boardValue,
    created_at: new Date(boardValue.createdAt).toISOString(),
    updated_at: new Date(boardValue.updatedAt).toISOString(),
  };
}

describe("cloud merge", () => {
  it("envia boards que só existem localmente", () => {
    const local = [board("a", "Local", 1000)];
    const merged = mergeCloudState(local, [], [], []);
    expect(merged.toCloud.map((b) => b.id)).toEqual(["a"]);
    expect(merged.toLocal).toHaveLength(0);
  });

  it("baixa boards que só existem na nuvem", () => {
    const remote = board("b", "Remoto", 2000);
    const merged = mergeCloudState([], [row(remote)], [], []);
    expect(merged.toLocal.map((b) => b.id)).toEqual(["b"]);
    expect(merged.toCloud).toHaveLength(0);
  });

  it("usa o documento mais novo quando o board existe nos dois lados", () => {
    const localOld = board("a", "Antigo", 1000);
    const remoteNew = board("a", "Novo", 2000);
    const merged = mergeCloudState([localOld], [row(remoteNew)], [], []);
    expect(merged.toLocal[0].title).toBe("Novo");
    expect(merged.toCloud).toHaveLength(0);

    const localNew = board("a", "Local novo", 3000);
    const remoteOld = board("a", "Remoto antigo", 2000);
    const merged2 = mergeCloudState([localNew], [row(remoteOld)], [], []);
    expect(merged2.toCloud[0].title).toBe("Local novo");
    expect(merged2.toLocal).toHaveLength(0);
  });

  it("não baixa de novo só porque o updated_at da linha é tocado pelo Postgres", () => {
    const same = board("a", "Igual", 5000);
    const remote = row(same);
    remote.updated_at = new Date(6000).toISOString();
    const merged = mergeCloudState([same], [remote], [], []);
    expect(merged.toLocal).toHaveLength(0);
    expect(merged.toCloud[0].id).toBe("a");
  });

  it("une pastas locais e remotas sem duplicar", () => {
    const localFolders = [{ id: "f1", name: "Local", createdAt: 1 }];
    const remoteFolders = [
      { id: "f1", name: "Local remoto", created_at: new Date(1).toISOString() },
      { id: "f2", name: "Remota", created_at: new Date(2).toISOString() },
    ];
    const merged = mergeCloudState([], [], localFolders, remoteFolders);
    expect(merged.folders.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(merged.folders[0].name).toBe("Local");
  });
});
