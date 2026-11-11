import { afterEach, describe, expect, it } from "vitest";
import { listBoards, loadSettings, saveBoard, saveSettings, setStorageScope } from "../src/lib/storage";
import { createBoard } from "../src/lib/templates";
import { DEFAULT_SETTINGS, type Board } from "../src/types";

function board(id: string, title: string): Board {
  const b = createBoard(title, "blank");
  b.id = id;
  b.title = title;
  return b;
}

afterEach(() => {
  setStorageScope(null);
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("storage por conta", () => {
  it("separa boards entre usuários e o escopo anônimo", async () => {
    setStorageScope(null);
    await saveBoard(board("anon", "Anônimo"));

    setStorageScope("user-a");
    expect(await listBoards()).toHaveLength(0);
    await saveBoard(board("a1", "Do A"));

    setStorageScope("user-b");
    expect(await listBoards()).toHaveLength(0);
    await saveBoard(board("b1", "Do B"));

    setStorageScope("user-a");
    expect((await listBoards()).map((b) => b.id)).toEqual(["a1"]);

    setStorageScope("user-b");
    expect((await listBoards()).map((b) => b.id)).toEqual(["b1"]);

    setStorageScope(null);
    expect((await listBoards()).map((b) => b.id)).toEqual(["anon"]);
  });

  it("separa configurações entre usuários", async () => {
    setStorageScope("user-a");
    await saveSettings({ ...DEFAULT_SETTINGS, userName: "Ana" });

    setStorageScope("user-b");
    await saveSettings({ ...DEFAULT_SETTINGS, userName: "Beto" });

    setStorageScope("user-a");
    expect((await loadSettings()).userName).toBe("Ana");

    setStorageScope("user-b");
    expect((await loadSettings()).userName).toBe("Beto");
  });

  it("sanitiza ids de escopo", async () => {
    setStorageScope("user/a b");
    await saveBoard(board("x", "X"));
    expect((await listBoards()).map((b) => b.id)).toEqual(["x"]);
    setStorageScope("outro");
    expect(await listBoards()).toHaveLength(0);
  });
});
