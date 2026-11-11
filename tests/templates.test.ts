import { describe, expect, it } from "vitest";
import { createBoard, TEMPLATES, welcomeBoard } from "../src/lib/templates";
import { normalizeBoard } from "../src/lib/schema";

describe("templates", () => {
  for (const template of TEMPLATES) {
    it(`cria e normaliza o template ${template.id}`, () => {
      const board = createBoard(`Teste ${template.name}`, template.id);
      const normalized = normalizeBoard(board);
      expect(normalized).not.toBeNull();
      if (template.id !== "blank") expect(Object.keys(normalized!.objects).length).toBeGreaterThan(0);
      for (const o of Object.values(normalized!.objects)) {
        if (o.objectType === "connector") {
          const from = normalized!.objects[o.fromId];
          const to = normalized!.objects[o.toId];
          expect(!!o.fromPoint || !!from).toBe(true);
          expect(!!o.toPoint || !!to).toBe(true);
        }
        if (o.objectType === "shape" || o.objectType === "frame" || o.objectType === "text") {
          expect(o.textStyle.fontSize).toBeGreaterThan(0);
        }
        if (o.parentId) expect(normalized!.objects[o.parentId]?.objectType).toBe("frame");
      }
    });
  }

  it("welcome board é válido", () => {
    expect(normalizeBoard(welcomeBoard())).not.toBeNull();
  });
});
