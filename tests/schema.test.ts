import { describe, expect, it } from "vitest";
import { normalizeBoard, normalizeSettings, normalizeTextStyle } from "../src/lib/schema";

describe("schema", () => {
  it("migra um board v1 e completa textStyle", () => {
    const board = normalizeBoard({
      id: "b1",
      title: "Antigo",
      objects: {
        s1: {
          id: "s1",
          objectType: "shape",
          shapeType: "rect",
          rect: { x: 0, y: 0, w: 100, h: 60 },
          style: { color: "gray", deco: "outline" },
          text: "Olá",
        },
        t1: {
          id: "t1",
          objectType: "text",
          rect: { x: 0, y: 100, w: 120, h: 30 },
          style: { color: "gray", deco: "transparent" },
          text: "Texto",
          fontSize: 22,
        },
      },
    });
    expect(board?.version).toBe(2);
    const shape = board?.objects.s1 as { textStyle: { fontSize: number; align: string } };
    expect(shape.textStyle.fontSize).toBe(18);
    expect(shape.textStyle.align).toBe("center");
    const text = board?.objects.t1 as { textStyle: { fontSize: number; align: string } };
    expect(text.textStyle.fontSize).toBe(22);
    expect(text.textStyle.align).toBe("left");
  });

  it("rejeita conector sem nenhuma ponta válida", () => {
    const board = normalizeBoard({
      id: "b1",
      objects: {
        c1: {
          id: "c1",
          objectType: "connector",
          fromId: "inexistente",
          toId: "inexistente2",
          style: { color: "gray", deco: "outline" },
        },
      },
    });
    expect(board?.objects.c1).toBeUndefined();
  });

  it("mantém conector com pontas soltas", () => {
    const board = normalizeBoard({
      id: "b1",
      objects: {
        c1: {
          id: "c1",
          objectType: "connector",
          fromId: "",
          toId: "",
          fromPoint: { x: 0, y: 0 },
          toPoint: { x: 100, y: 100 },
          style: { color: "gray", deco: "outline" },
        },
      },
    });
    expect(board?.objects.c1).toBeTruthy();
  });

  it("corrige parentId órfão e parent que não é frame", () => {
    const board = normalizeBoard({
      id: "b1",
      objects: {
        s1: { id: "s1", objectType: "shape", shapeType: "rect", rect: { x: 0, y: 0, w: 10, h: 10 }, text: "", style: { color: "gray", deco: "outline" }, parentId: "fantasma" },
        s2: { id: "s2", objectType: "shape", shapeType: "rect", rect: { x: 0, y: 0, w: 10, h: 10 }, text: "", style: { color: "gray", deco: "outline" }, parentId: "s1" },
      },
    });
    expect((board?.objects.s1 as { parentId: string | null }).parentId).toBeNull();
    expect((board?.objects.s2 as { parentId: string | null }).parentId).toBeNull();
  });

  it("normaliza ícones e pasta do board", () => {
    const board = normalizeBoard({
      id: "b1",
      folderId: "f1",
      objects: {
        i1: {
          id: "i1",
          objectType: "icon",
          icon: "Rocket",
          iconSet: "lucide",
          rect: { x: 0, y: 0, w: 96, h: 96 },
          style: { color: "purple", deco: "outline", hex: "#123456" },
        },
      },
    });
    expect(board?.folderId).toBe("f1");
    const icon = board?.objects.i1 as { icon: string; iconSet: string; style: { hex?: string } };
    expect(icon.icon).toBe("Rocket");
    expect(icon.iconSet).toBe("lucide");
    expect(icon.style.hex).toBe("#123456");
  });

  it("normaliza pastas e filtro do workspace", () => {
    const settings = normalizeSettings({
      folders: [{ id: "f1", name: "Clientes", createdAt: 1 }],
      workspaceFilter: "f1",
    });
    expect(settings.folders).toHaveLength(1);
    expect(settings.folders[0].name).toBe("Clientes");
    expect(settings.workspaceFilter).toBe("f1");
    expect(settings.theme).toBe("dark");
  });

  it("normaliza textStyle com limites", () => {
    const ts = normalizeTextStyle({ fontSize: 999, fontWeight: 900, align: "right", italic: 1 });
    expect(ts.fontSize).toBe(200);
    expect(ts.fontWeight).toBe(400);
    expect(ts.align).toBe("right");
    expect(ts.italic).toBe(false);
  });
});
