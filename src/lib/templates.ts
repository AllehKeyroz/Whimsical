import { nanoid } from "nanoid";
import {
  BOARD_VERSION,
  LEFT_TEXT_STYLE,
  type Board,
  type BoardObject,
  type Connector,
  type ConnectorType,
  type Frame,
  type Rect,
  type Shape,
  type ShapeType,
  type Style,
  type TextObject,
  type TextStyle,
} from "../types";
import { rectCenter, snapAnchor } from "../geometry";

export type TemplateId =
  | "blank"
  | "flowchart"
  | "org"
  | "mindmap"
  | "kanban"
  | "retro"
  | "swot"
  | "wireframe"
  | "doc";

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  icon: string;
}

export const TEMPLATES: TemplateInfo[] = [
  { id: "blank", name: "Board em branco", description: "Comece do zero.", icon: "▢" },
  { id: "flowchart", name: "Fluxograma", description: "Início, processo, decisão e fim.", icon: "◇" },
  { id: "org", name: "Organograma", description: "Hierarquia de equipe em árvore.", icon: "⌂" },
  { id: "mindmap", name: "Mapa mental", description: "Ideia central com ramificações.", icon: "✳" },
  { id: "kanban", name: "Kanban", description: "Colunas com notas adesivas.", icon: "▥" },
  { id: "retro", name: "Retrospectiva", description: "Bom, ruim e ações.", icon: "↻" },
  { id: "swot", name: "Matriz SWOT", description: "Forças, fraquezas, oportunidades e ameaças.", icon: "▦" },
  { id: "wireframe", name: "Wireframe", description: "Estrutura de tela com blocos de UI.", icon: "▤" },
  { id: "doc", name: "Documento", description: "Título, seções e texto corrido.", icon: "≡" },
];

const now = () => Date.now();

function textStyle(partial: Partial<TextStyle> = {}): TextStyle {
  return { ...LEFT_TEXT_STYLE, align: "center", ...partial };
}

function defaultStyle(color: Style["color"], deco: Style["deco"] = "outline"): Style {
  return { color, deco };
}

function makeBoard(title: string, objects: BoardObject[]): Board {
  const map: Record<string, BoardObject> = {};
  objects.forEach((o, i) => {
    o.order = i + 1;
    map[o.id] = o;
  });
  const ts = now();
  return {
    id: nanoid(),
    title,
    fontFamily: "Dinsical",
    objects: map,
    version: BOARD_VERSION,
    createdAt: ts,
    updatedAt: ts,
  };
}

function shape(
  shapeType: ShapeType,
  rect: Rect,
  text: string,
  style: Style,
  extra: { parentId?: string | null; textStyle?: Partial<TextStyle>; rotation?: number } = {},
): Shape {
  return {
    id: nanoid(),
    objectType: "shape",
    shapeType,
    rect,
    style,
    text,
    textStyle: textStyle(extra.textStyle),
    parentId: extra.parentId ?? null,
    groupId: null,
    order: 0,
    rotation: extra.rotation ?? 0,
  };
}

function frame(title: string, rect: Rect, style: Style = defaultStyle("smoke")): Frame {
  return {
    id: nanoid(),
    objectType: "frame",
    rect,
    style,
    text: title,
    textStyle: { ...LEFT_TEXT_STYLE, fontSize: 13, fontWeight: 500 },
    parentId: null,
    groupId: null,
    order: 0,
  };
}

function label(text: string, rect: Rect, style: Partial<TextStyle>): TextObject {
  return {
    id: nanoid(),
    objectType: "text",
    rect,
    style: { color: "gray", deco: "transparent" },
    text,
    textStyle: { ...LEFT_TEXT_STYLE, ...style },
    parentId: null,
    groupId: null,
    order: 0,
  };
}

function relative(from: Rect, to: Rect) {
  return snapAnchor(from, rectCenter(to));
}

function connect(
  from: Shape | Frame,
  to: Shape | Frame,
  connectorType: ConnectorType = "elbow",
  label = "",
): Connector {
  return {
    id: nanoid(),
    objectType: "connector",
    fromId: from.id,
    toId: to.id,
    connectorType,
    fromRel: relative(from.rect, to.rect),
    toRel: relative(to.rect, from.rect),
    fromEndpoint: "none",
    toEndpoint: "arrow",
    fromCardinality: null,
    toCardinality: null,
    style: { color: "gray", deco: "outline" },
    label,
    parentId: null,
    groupId: null,
    order: 0,
  };
}

export function createBoard(title: string, template: TemplateId = "blank"): Board {
  switch (template) {
    case "flowchart":
      return flowchart(title);
    case "org":
      return orgChart(title);
    case "mindmap":
      return mindMap(title);
    case "kanban":
      return kanban(title);
    case "retro":
      return retro(title);
    case "swot":
      return swot(title);
    case "wireframe":
      return wireframe(title);
    case "doc":
      return doc(title);
    default:
      return makeBoard(title, []);
  }
}

function flowchart(title: string): Board {
  const start = shape("pill", { x: 0, y: 0, w: 180, h: 64 }, "Início", defaultStyle("green", "fill"), {
    textStyle: { color: "#ffffff" },
  });
  const step = shape("rect", { x: 0, y: 150, w: 192, h: 78 }, "Processo", defaultStyle("blue", "outline"));
  const decision = shape("diamond", { x: -24, y: 310, w: 240, h: 140 }, "Decisão?", defaultStyle("yellow", "outline"));
  const yes = shape("rect", { x: 260, y: 340, w: 192, h: 78 }, "Ação", defaultStyle("purple", "outline"));
  const no = shape("pill", { x: 0, y: 550, w: 192, h: 64 }, "Fim", defaultStyle("red", "fill"), {
    textStyle: { color: "#ffffff" },
  });
  const finish = shape("pill", { x: 260, y: 550, w: 192, h: 64 }, "Fim", defaultStyle("red", "fill"), {
    textStyle: { color: "#ffffff" },
  });
  return makeBoard(title, [
    start,
    step,
    decision,
    yes,
    no,
    finish,
    connect(start, step),
    connect(step, decision),
    connect(decision, yes, "elbow", "Sim"),
    connect(decision, no, "elbow", "Não"),
    connect(yes, finish),
  ]);
}

function orgChart(title: string): Board {
  const ceo = shape("rect", { x: 300, y: 0, w: 200, h: 72 }, "CEO", defaultStyle("indigo", "fill"), {
    textStyle: { color: "#ffffff", fontWeight: 600 },
  });
  const leaders = [
    shape("rect", { x: 0, y: 200, w: 180, h: 68 }, "Produto", defaultStyle("blue")),
    shape("rect", { x: 310, y: 200, w: 180, h: 68 }, "Tecnologia", defaultStyle("blue")),
    shape("rect", { x: 620, y: 200, w: 180, h: 68 }, "Marketing", defaultStyle("blue")),
  ];
  const teams = [
    shape("rect", { x: -80, y: 360, w: 160, h: 60 }, "Design", defaultStyle("mint")),
    shape("rect", { x: 100, y: 360, w: 160, h: 60 }, "Pesquisa", defaultStyle("mint")),
    shape("rect", { x: 230, y: 360, w: 160, h: 60 }, "Front-end", defaultStyle("mint")),
    shape("rect", { x: 410, y: 360, w: 160, h: 60 }, "Back-end", defaultStyle("mint")),
    shape("rect", { x: 620, y: 360, w: 160, h: 60 }, "Conteúdo", defaultStyle("mint")),
    shape("rect", { x: 800, y: 360, w: 160, h: 60 }, "Growth", defaultStyle("mint")),
  ];
  const conns = [
    ...leaders.map((l) => connect(ceo, l)),
    connect(leaders[0], teams[0]),
    connect(leaders[0], teams[1]),
    connect(leaders[1], teams[2]),
    connect(leaders[1], teams[3]),
    connect(leaders[2], teams[4]),
    connect(leaders[2], teams[5]),
  ];
  return makeBoard(title, [ceo, ...leaders, ...teams, ...conns]);
}

function mindMap(title: string): Board {
  const center = shape("ellipse", { x: 0, y: 0, w: 220, h: 110 }, "Ideia central", defaultStyle("purple", "fill"), {
    textStyle: { color: "#ffffff", fontWeight: 600, fontSize: 20 },
  });
  const branches = [
    { text: "Público", color: "blue" as const, x: 380, y: -120 },
    { text: "Problema", color: "orange" as const, x: 420, y: 90 },
    { text: "Solução", color: "green" as const, x: -420, y: -110 },
    { text: "Métricas", color: "indigo" as const, x: -440, y: 100 },
    { text: "Canais", color: "mint" as const, x: 40, y: -260 },
    { text: "Riscos", color: "red" as const, x: 40, y: 280 },
  ];
  const nodes = branches.map((b) =>
    shape("pill", { x: b.x, y: b.y, w: 180, h: 64 }, b.text, defaultStyle(b.color, "outline")),
  );
  return makeBoard(title, [center, ...nodes, ...nodes.map((n) => connect(center, n, "curved"))]);
}

function kanban(title: string): Board {
  const columns = [
    { title: "A fazer", x: 0, color: "smoke" as const },
    { title: "Fazendo", x: 380, color: "smoke" as const },
    { title: "Concluído", x: 760, color: "smoke" as const },
  ];
  const frames = columns.map((c) => frame(c.title, { x: c.x, y: 0, w: 340, h: 520 }, defaultStyle(c.color)));
  const notes = [
    shape("sticky", { x: 20, y: 60, w: 190, h: 120 }, "Definir escopo", defaultStyle("yellow", "fill"), { parentId: frames[0].id }),
    shape("sticky", { x: 20, y: 210, w: 190, h: 120 }, "Pesquisar usuários", defaultStyle("orange", "fill"), { parentId: frames[0].id }),
    shape("sticky", { x: 400, y: 60, w: 190, h: 120 }, "Prototipar fluxo", defaultStyle("blue", "fill"), { parentId: frames[1].id }),
    shape("sticky", { x: 400, y: 210, w: 190, h: 120 }, "Revisar copy", defaultStyle("blue", "fill"), { parentId: frames[1].id }),
    shape("sticky", { x: 780, y: 60, w: 190, h: 120 }, "Kickoff", defaultStyle("green", "fill"), { parentId: frames[2].id }),
  ];
  return makeBoard(title, [...frames, ...notes]);
}

function retro(title: string): Board {
  const sections = [
    { title: "Funcionou bem", x: 0, color: "green" as const, note: "Boa comunicação" },
    { title: "Precisa melhorar", x: 380, color: "red" as const, note: "Prazos apertados" },
    { title: "Ações", x: 760, color: "blue" as const, note: "Revisão semanal" },
  ];
  const frames = sections.map((s) => frame(s.title, { x: s.x, y: 0, w: 340, h: 420 }));
  const notes = sections.map((s, i) =>
    shape("sticky", { x: s.x + 20, y: 60 + i * 10, w: 190, h: 120 }, s.note, defaultStyle(s.color, "fill"), {
      parentId: frames[i].id,
    }),
  );
  return makeBoard(title, [...frames, ...notes]);
}

function swot(title: string): Board {
  const quadrants = [
    { title: "Forças", x: 0, y: 0, color: "green" as const },
    { title: "Fraquezas", x: 440, y: 0, color: "red" as const },
    { title: "Oportunidades", x: 0, y: 440, color: "blue" as const },
    { title: "Ameaças", x: 440, y: 440, color: "orange" as const },
  ];
  const frames = quadrants.map((q) =>
    frame(q.title, { x: q.x, y: q.y, w: 400, h: 400 }, defaultStyle(q.color, "dash")),
  );
  const notes = quadrants.map((q) =>
    shape(
      "sticky",
      { x: q.x + 24, y: q.y + 64, w: 200, h: 120 },
      q.title,
      defaultStyle(q.color, "fill"),
      { parentId: frames[quadrants.indexOf(q)].id },
    ),
  );
  return makeBoard(title, [...frames, ...notes]);
}

function wireframe(title: string): Board {
  const screen = frame("Tela — Desktop", { x: 0, y: 0, w: 980, h: 620 });
  const header = shape("rect", { x: 24, y: 56, w: 932, h: 64 }, "Logo · Menu · Ações", defaultStyle("smoke", "fill"), {
    parentId: screen.id,
    textStyle: { align: "left", fontSize: 15 },
  });
  const sidebar = shape("rect", { x: 24, y: 140, w: 220, h: 440 }, "Navegação", defaultStyle("smoke", "outline"), {
    parentId: screen.id,
    textStyle: { align: "left", fontSize: 15 },
  });
  const hero = shape("rect", { x: 268, y: 140, w: 688, h: 180 }, "Hero / título + CTA", defaultStyle("blue", "outline"), {
    parentId: screen.id,
    textStyle: { fontSize: 20, fontWeight: 600 },
  });
  const cards = [0, 1, 2].map((i) =>
    shape("rect", { x: 268 + i * 232, y: 344, w: 212, h: 140 }, `Card ${i + 1}`, defaultStyle("mint", "outline"), {
      parentId: screen.id,
      textStyle: { fontSize: 14 },
    }),
  );
  const footer = shape("rect", { x: 268, y: 508, w: 688, h: 72 }, "Rodapé", defaultStyle("smoke", "fill"), {
    parentId: screen.id,
    textStyle: { fontSize: 13 },
  });
  return makeBoard(title, [screen, header, sidebar, hero, ...cards, footer]);
}

function doc(title: string): Board {
  const t1 = label("Documento de produto", { x: 0, y: 0, w: 680, h: 52 }, {
    fontSize: 34,
    fontWeight: 700,
    align: "left",
  });
  const t2 = label(
    "Um espaço para contexto, decisões e próximos passos.\n\nUse textos, imagens e frames para organizar a narrativa.",
    { x: 0, y: 76, w: 680, h: 90 },
    { fontSize: 16, align: "left" },
  );
  const t3 = label("Contexto", { x: 0, y: 210, w: 320, h: 34 }, { fontSize: 22, fontWeight: 600, align: "left" });
  const t4 = label(
    "Descreva o problema, o público e por que agora. Este template é um ponto de partida: mova os blocos, adicione frames e conecte ideias.",
    { x: 0, y: 254, w: 680, h: 80 },
    { fontSize: 15, align: "left" },
  );
  const t5 = label("Decisões", { x: 0, y: 370, w: 320, h: 34 }, { fontSize: 22, fontWeight: 600, align: "left" });
  const t6 = label("• Decisão 1\n• Decisão 2\n• Decisão 3", { x: 0, y: 414, w: 400, h: 90 }, { fontSize: 15, align: "left" });
  return makeBoard(title, [t1, t2, t3, t4, t5, t6]);
}

export function welcomeBoard(): Board {
  const b = createBoard("Bem-vindo ao Whimsical", "flowchart");
  const note = label(
    "Duplo clique edita o texto · Botão direito abre as opções · ? mostra os atalhos",
    { x: 0, y: 700, w: 520, h: 48 },
    { ...LEFT_TEXT_STYLE, fontSize: 15, align: "left" },
  );
  note.order = 99;
  b.objects[note.id] = note;
  return b;
}
