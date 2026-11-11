import { describe, expect, it } from "vitest";
import { useStore, cloudErrorMessage } from "../src/store";
import { DEFAULT_SETTINGS, type Board } from "../src/types";
import { createBoard } from "../src/lib/templates";

function reset(board?: Board): Board {
  const b = board ?? createBoard("Teste", "blank");
  useStore.setState({
    ready: true,
    view: "board",
    board: b,
    selection: [],
    past: [],
    future: [],
    dirty: 0,
    camera: { x: 0, y: 0, zoom: 1 },
    tool: "select",
    editingId: null,
    connectFrom: null,
    contextMenu: null,
    guides: [],
    settings: { ...DEFAULT_SETTINGS },
    saveState: "idle",
    collab: { room: null, status: "off", peers: [], messages: [] },
  });
  return b;
}

describe("store — objetos e histórico", () => {
  it("adiciona, desfaz e refaz uma forma", () => {
    reset();
    const id = useStore.getState().addShape("rect", { x: 0, y: 0, w: 100, h: 60 });
    expect(useStore.getState().board.objects[id]).toBeTruthy();
    expect(useStore.getState().selection).toEqual([id]);
    expect(useStore.getState().past).toHaveLength(1);

    useStore.getState().undo();
    expect(Object.keys(useStore.getState().board.objects)).toHaveLength(0);

    useStore.getState().redo();
    expect(useStore.getState().board.objects[id]).toBeTruthy();
  });

  it("não cria entradas de histórico duplicadas ao empurrar o mesmo board", () => {
    reset();
    useStore.getState().addShape("rect", { x: 0, y: 0, w: 100, h: 60 });
    const before = useStore.getState().past.length;
    useStore.getState().pushHistory();
    useStore.getState().pushHistory();
    expect(useStore.getState().past.length).toBe(before);
  });

  it("duplica conectores junto com os nós selecionados", () => {
    reset();
    const a = useStore.getState().addShape("rect", { x: 0, y: 0, w: 100, h: 60 });
    const b = useStore.getState().addShape("rect", { x: 200, y: 0, w: 100, h: 60 });
    useStore.getState().addConnector(a, b);
    useStore.getState().selectMany([a, b]);
    useStore.getState().duplicateSelection();
    const objects = Object.values(useStore.getState().board.objects);
    expect(objects.filter((o) => o.objectType === "shape")).toHaveLength(4);
    expect(objects.filter((o) => o.objectType === "connector")).toHaveLength(2);
  });

  it("move o frame e seus filhos juntos", () => {
    reset();
    const frame = useStore.getState().addFrame({ x: 0, y: 0, w: 400, h: 300 });
    const child = useStore.getState().addShape("rect", { x: 50, y: 50, w: 100, h: 60 });
    expect((useStore.getState().board.objects[child] as { parentId: string | null }).parentId).toBe(frame);
    useStore.getState().select(frame, false);
    useStore.getState().moveSelection(10, 20, true);
    const moved = useStore.getState().board.objects[child] as { rect: { x: number; y: number } };
    expect(moved.rect).toMatchObject({ x: 60, y: 70 });
  });

  it("exclui o frame e todo o conteúdo", () => {
    reset();
    const frame = useStore.getState().addFrame({ x: 0, y: 0, w: 400, h: 300 });
    useStore.getState().addShape("rect", { x: 50, y: 50, w: 100, h: 60 });
    useStore.getState().select(frame, false);
    useStore.getState().deleteSelection();
    expect(Object.keys(useStore.getState().board.objects)).toHaveLength(0);
  });

  it("agrupa e seleciona o grupo inteiro", () => {
    reset();
    const a = useStore.getState().addShape("rect", { x: 0, y: 0, w: 100, h: 60 });
    const b = useStore.getState().addShape("rect", { x: 200, y: 0, w: 100, h: 60 });
    useStore.getState().selectMany([a, b]);
    useStore.getState().groupSelection();
    useStore.getState().select(a, false);
    expect(useStore.getState().selection.sort()).toEqual([a, b].sort());
  });

  it("copia e cola com deslocamento e novos ids", () => {
    reset();
    const id = useStore.getState().addShape("rect", { x: 10, y: 10, w: 100, h: 60 });
    useStore.getState().copySelection();
    useStore.getState().paste();
    const objects = Object.values(useStore.getState().board.objects);
    expect(objects).toHaveLength(2);
    const pasted = objects.find((o) => o.id !== id);
    expect((pasted as { rect: { x: number } }).rect.x).toBe(42);
  });

  it("aplica cor customizada em conector", () => {
    reset();
    const a = useStore.getState().addShape("rect", { x: 0, y: 0, w: 100, h: 60 });
    const b = useStore.getState().addShape("rect", { x: 200, y: 0, w: 100, h: 60 });
    const c = useStore.getState().addConnector(a, b)!;
    useStore.getState().setStyle(c, { hex: "#123456" });
    const conn = useStore.getState().board.objects[c] as { style: { hex?: string } };
    expect(conn.style.hex).toBe("#123456");
  });

  it("rotaciona em 90 graus", () => {
    reset();
    const id = useStore.getState().addShape("rect", { x: 0, y: 0, w: 120, h: 60 });
    useStore.getState().rotateSelection();
    expect((useStore.getState().board.objects[id] as { rotation: number }).rotation).toBe(90);
  });

  it("oculta o objeto e remove da seleção", () => {
    reset();
    const id = useStore.getState().addShape("rect", { x: 0, y: 0, w: 100, h: 60 });
    useStore.getState().toggleHidden(id);
    expect((useStore.getState().board.objects[id] as { hidden: boolean }).hidden).toBe(true);
    expect(useStore.getState().selection).toHaveLength(0);
  });

  it("quick add abaixo cria shape conectado e herda o estilo", () => {
    reset();
    const source = useStore.getState().addShape("rect", { x: 0, y: 0, w: 192, h: 96 });
    useStore.getState().setStyle(source, { color: "green" });
    const below = useStore.getState().quickAdd(source, "down");
    expect(below).toBeTruthy();
    const board = useStore.getState().board;
    const shape = board.objects[below!] as { rect: { y: number; w: number; h: number }; style: { color: string } };
    expect(shape.rect.y).toBeGreaterThan(96);
    expect(shape.rect.w).toBe(192);
    expect(shape.rect.h).toBe(96);
    expect(shape.style.color).toBe("green");
    const conn = Object.values(board.objects).find((o) => o.objectType === "connector") as
      | { fromId: string; toId: string }
      | undefined;
    expect(conn?.fromId).toBe(source);
    expect(conn?.toId).toBe(below);
  });

  it("adiciona um ícone nativo do board", () => {
    reset();
    const id = useStore.getState().addIcon({ x: 10, y: 10, w: 96, h: 96 }, "Rocket", "lucide", "#123456");
    const icon = useStore.getState().board.objects[id] as {
      objectType: string;
      icon: string;
      iconSet: string;
      style: { hex?: string };
    };
    expect(icon.objectType).toBe("icon");
    expect(icon.icon).toBe("Rocket");
    expect(icon.iconSet).toBe("lucide");
    expect(icon.style.hex).toBe("#123456");
    expect(useStore.getState().selection).toEqual([id]);
  });

  it("reparenta ao soltar dentro de um frame", () => {
    reset();
    const frame = useStore.getState().addFrame({ x: 0, y: 0, w: 400, h: 300 });
    const id = useStore.getState().addShape("rect", { x: 600, y: 400, w: 100, h: 60 });
    useStore.getState().select(id, false);
    useStore.getState().reparentSelection(frame);
    expect((useStore.getState().board.objects[id] as { parentId: string }).parentId).toBe(frame);
  });
});

describe("cloudErrorMessage", () => {
  it("traduz credenciais inválidas", () => {
    expect(cloudErrorMessage("Invalid login credentials")).toBe("E-mail ou senha inválidos.");
  });

  it("avisa sobre e-mail não confirmado", () => {
    expect(cloudErrorMessage("Email not confirmed")).toBe("Confirme seu e-mail antes de entrar.");
  });

  it("avisa quando o schema não foi aplicado", () => {
    expect(cloudErrorMessage("Could not find the table 'public.boards' in the schema cache")).toBe(
      "Tabelas da nuvem não encontradas. Execute supabase/schema.sql no Supabase.",
    );
    expect(cloudErrorMessage('{"code":"PGRST205"}')).toBe(
      "Tabelas da nuvem não encontradas. Execute supabase/schema.sql no Supabase.",
    );
  });

  it("avisa sobre URL/chave inválida e falha de rede", () => {
    expect(cloudErrorMessage("Invalid API key")).toBe("URL ou anon key do Supabase inválida.");
    expect(cloudErrorMessage("Failed to fetch")).toBe(
      "Não foi possível conectar ao Supabase. Verifique a URL e a rede.",
    );
  });

  it("mantém mensagens desconhecidas e usa fallback vazio", () => {
    expect(cloudErrorMessage("Algo inesperado")).toBe("Algo inesperado");
    expect(cloudErrorMessage(null)).toBe("Falha ao sincronizar com o Supabase.");
  });
});

describe("cloudErrorMessage — cadastro", () => {
  it("explica falha de envio de e-mail de confirmação", () => {
    expect(cloudErrorMessage("Error sending confirmation email")).toContain("ENABLE_EMAIL_AUTOCONFIRM");
  });

  it("traduz e-mail já cadastrado e rate limit", () => {
    expect(cloudErrorMessage("User already registered")).toBe("Este e-mail já está cadastrado. Use a aba Entrar.");
    expect(cloudErrorMessage("Email rate limit exceeded")).toContain("Aguarde alguns minutos");
  });
});

describe("título do board", () => {
  it("preserva espaços enquanto o usuário digita", () => {
    reset();
    useStore.getState().setBoardTitle("Meu Board ");
    expect(useStore.getState().board.title).toBe("Meu Board ");
    useStore.getState().setBoardTitle("Meu Board Novo");
    expect(useStore.getState().board.title).toBe("Meu Board Novo");
  });
});

describe("mapa mental", () => {
  it("cria filho conectado com Tab e irmão com Enter", () => {
    reset();
    const root = useStore.getState().addShape("rect", { x: 0, y: 0, w: 160, h: 64 });
    useStore.getState().select(root, false);
    const child = useStore.getState().addMindChild(root);
    expect(child).toBeTruthy();
    const childObj = useStore.getState().board.objects[child!];
    expect(childObj.objectType).toBe("shape");
    const links = Object.values(useStore.getState().board.objects).filter(
      (o) => o.objectType === "connector" && o.fromId === root && o.toId === child,
    );
    expect(links).toHaveLength(1);

    const sibling = useStore.getState().addMindSibling(child!);
    expect(sibling).toBeTruthy();
    expect(
      Object.values(useStore.getState().board.objects).filter(
        (o) => o.objectType === "connector" && o.fromId === child && o.toId === sibling,
      ),
    ).toHaveLength(1);
  });
});
