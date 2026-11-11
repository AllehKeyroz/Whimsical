import { describe, expect, it } from "vitest";
import { buildFlowchartObjects, detectMermaidKind, parseMermaidEr, parseMermaidFlowchart } from "../src/lib/mermaid";
import { boardToMermaid } from "../src/lib/mermaidExport";
import type { Board, Connector, Shape } from "../src/types";

const SAMPLE = `flowchart TD
  A([Início]) --> B[Receber lead]
  B --> C{Qualificado?}
  C -->|Sim| D[Agendar reunião]
  C -->|Não| E[Nutrição]
  D -.-> F([Fim])
  E --> F`;

describe("mermaid", () => {
  it("detecta fluxogramas e outros diagramas", () => {
    expect(detectMermaidKind(SAMPLE)).toBe("flowchart");
    expect(detectMermaidKind("graph LR\n A-->B")).toBe("flowchart");
    expect(detectMermaidKind("sequenceDiagram\n A->>B: oi")).toBe("diagram");
    expect(detectMermaidKind("texto qualquer")).toBeNull();
  });

  it("interpreta formas, rótulos e arestas", () => {
    const parsed = parseMermaidFlowchart(SAMPLE);
    expect(parsed).not.toBeNull();
    expect(parsed!.direction).toBe("TB");
    expect(parsed!.nodes.size).toBe(6);
    expect(parsed!.edges).toHaveLength(6);
    expect(parsed!.nodes.get("A")?.shape).toBe("pill");
    expect(parsed!.nodes.get("C")?.shape).toBe("diamond");
    expect(parsed!.nodes.get("D")?.label).toBe("Agendar reunião");
    const sim = parsed!.edges.find((e) => e.label === "Sim");
    expect(sim).toMatchObject({ from: "C", to: "D", dashed: false, toArrow: true });
    const dashed = parsed!.edges.find((e) => e.from === "D");
    expect(dashed?.dashed).toBe(true);
  });

  it("gera objetos nativos com layout", () => {
    const parsed = parseMermaidFlowchart(SAMPLE);
    const built = buildFlowchartObjects(parsed!, { x: 0, y: 0 });
    expect(built).not.toBeNull();
    const shapes = built!.objects.filter((o): o is Shape => o.objectType === "shape");
    const connectors = built!.objects.filter((o): o is Connector => o.objectType === "connector");
    expect(shapes).toHaveLength(6);
    expect(connectors).toHaveLength(6);
    expect(built!.nodeCount).toBe(6);
    expect(built!.edgeCount).toBe(6);
    const diamond = shapes.find((s) => s.text === "Qualificado?");
    expect(diamond?.shapeType).toBe("diamond");
    const sim = connectors.find((c) => c.label === "Sim");
    expect(sim?.toEndpoint).toBe("arrow");
    expect(sim?.fromEndpoint).toBe("none");
    const dashed = connectors.find((c) => c.style.deco === "dash");
    expect(dashed).toBeTruthy();
    // Every connector must reference existing shapes and have anchors.
    for (const c of connectors) {
      expect(built!.objects.some((o) => o.id === c.fromId)).toBe(true);
      expect(built!.objects.some((o) => o.id === c.toId)).toBe(true);
      expect(c.fromRel).toBeTruthy();
      expect(c.toRel).toBeTruthy();
    }
  });

  it("cria frames para subgraphs", () => {
    const parsed = parseMermaidFlowchart(`flowchart LR
      subgraph Vendas
        A[Lead] --> B[Proposta]
      end
      B --> C[Fechamento]`);
    const built = buildFlowchartObjects(parsed!, { x: 100, y: 100 });
    const frames = built!.objects.filter((o) => o.objectType === "frame");
    expect(frames).toHaveLength(1);
    const shapes = built!.objects.filter((o): o is Shape => o.objectType === "shape");
    const lead = shapes.find((s) => s.text === "Lead");
    expect(lead?.parentId).toBe(frames[0].id);
  });

  it("quebra texto longo e cresce para baixo em vez de alargar o shape", () => {
    const parsed = parseMermaidFlowchart(`flowchart TD
      A[Um texto muito longo que deveria quebrar em várias linhas dentro do shape sem alargar demais o quadro] --> B[Curto]`);
    const built = buildFlowchartObjects(parsed!, { x: 0, y: 0 });
    const long = built!.objects.find(
      (o): o is Shape => o.objectType === "shape" && o.text.startsWith("Um texto muito longo"),
    );
    expect(long).toBeTruthy();
    expect(long!.rect.w).toBeLessThanOrEqual(300);
    expect(long!.rect.h).toBeGreaterThan(96);
  });

  it("mantém tamanhos padrão (não achata os nós)", () => {
    const parsed = parseMermaidFlowchart(SAMPLE);
    const built = buildFlowchartObjects(parsed!, { x: 0, y: 0 });
    const rect = built!.objects.find((o): o is Shape => o.objectType === "shape" && o.text === "Receber lead");
    expect(rect?.rect.w).toBeGreaterThanOrEqual(192);
    expect(rect?.rect.h).toBeGreaterThanOrEqual(96);
    const diamond = built!.objects.find((o): o is Shape => o.objectType === "shape" && o.text === "Qualificado?");
    expect(diamond?.rect.h).toBeGreaterThanOrEqual(140);
  });

  it("interpreta erDiagram com nomes e atributos entre quotes/backticks", () => {
    const er = `erDiagram
      "Calendário Tatupé" {
        \`Dr. Guilherme\` \`Dr. Ranieri\`
        \`Dr. Pedro\` \`Dr. Breno\`
        string \`Dr. Bruno\`
        string \`Dr. Cássio\`
      }
      style "Calendário Tatupé" stroke:#C4CFDA,fill:#FFFFFF,color:#293744`;
    expect(detectMermaidKind(er)).toBe("diagram");
    const parsed = parseMermaidEr(er);
    expect(parsed).not.toBeNull();
    expect(parsed!.nodes.size).toBe(1);
    const built = buildFlowchartObjects(parsed!, { x: 0, y: 0 });
    const entity = built!.objects.find((o): o is Shape => o.objectType === "shape");
    expect(entity?.text).toContain("Calendário Tatupé");
    expect(entity?.text).toContain("Dr. Guilherme");
    expect(entity?.text).toContain("string  Dr. Bruno");
    expect(entity?.rect.w).toBeGreaterThanOrEqual(260);
    expect(entity?.rect.h).toBeGreaterThanOrEqual(150);
  });

  it("interpreta relacionamentos ER com cardinalidade", () => {
    const er = `erDiagram
      CLIENTE ||--o{ PEDIDO : faz
      PEDIDO {
        string id
      }
      CLIENTE {
        string id
      }`;
    const parsed = parseMermaidEr(er);
    expect(parsed?.edges).toHaveLength(1);
    const built = buildFlowchartObjects(parsed!, { x: 0, y: 0 });
    const conn = built!.objects.find((o): o is Connector => o.objectType === "connector");
    expect(conn?.fromCardinality).toBe("one");
    expect(conn?.toCardinality).toBe("zero-or-many");
  });

  it("aplica class e style declarados depois das arestas", () => {
    const parsed = parseMermaidFlowchart(`flowchart TD
      A --> B
      classDef red fill:#ff0000,color:#ffffff
      class A red
      style B stroke:#00ff00,fill:#0000ff,color:#ffffff`);
    const built = buildFlowchartObjects(parsed!, { x: 0, y: 0 });
    const a = built!.objects.find((o): o is Shape => o.objectType === "shape" && o.text === "A");
    const b = built!.objects.find((o): o is Shape => o.objectType === "shape" && o.text === "B");
    expect(a?.style.hex).toBe("#ff0000");
    expect(a?.textStyle.color).toBe("#ffffff");
    expect(b?.style.hex).toBe("#0000ff");
  });

  it("aplica classDef de cor", () => {
    const parsed = parseMermaidFlowchart(`flowchart TD
      classDef hot fill:#ff0000,color:#ffffff
      A[Lead]:::hot --> B[Fim]`);
    const built = buildFlowchartObjects(parsed!, { x: 0, y: 0 });
    const lead = built!.objects.find((o): o is Shape => o.objectType === "shape" && o.text === "Lead");
    expect(lead?.style.hex).toBe("#ff0000");
    expect(lead?.textStyle.color).toBe("#ffffff");
  });
});

describe("mermaid — fidelidade de ida e volta", () => {
  it("não quebra ids colados ao operador", () => {
    const parsed = parseMermaidFlowchart("flowchart TD\nfoo-->bar\nbar-->baz");
    expect(parsed!.nodes.has("foo")).toBe(true);
    expect(parsed!.nodes.has("bar")).toBe(true);
    expect(parsed!.edges).toHaveLength(2);
    expect(parsed!.edges[0]).toMatchObject({ from: "foo", to: "bar" });
  });

  it("interpreta marcadores o e x", () => {
    const parsed = parseMermaidFlowchart("flowchart LR\nA o--o B\nC x--x D\nE --o F");
    const first = parsed!.edges.find((e) => e.from === "A" && e.to === "B");
    expect(first?.fromCircle).toBe(true);
    expect(first?.toCircle).toBe(true);
    const second = parsed!.edges.find((e) => e.from === "C" && e.to === "D");
    expect(second?.fromCross).toBe(true);
    expect(second?.toCross).toBe(true);
    const third = parsed!.edges.find((e) => e.from === "E" && e.to === "F");
    expect(third?.toCircle).toBe(true);
    expect(third?.toArrow).toBe(false);
  });

  it("exporta e reimporta o mesmo fluxograma", () => {
    const parsed = parseMermaidFlowchart(SAMPLE)!;
    const built = buildFlowchartObjects(parsed, { x: 0, y: 0 })!;
    const board: Board = {
      id: "b",
      title: "Teste",
      fontFamily: "Dinsical",
      objects: Object.fromEntries(built.objects.map((o) => [o.id, o])),
      version: 2,
      createdAt: 0,
      updatedAt: 0,
    };
    const text = boardToMermaid(board);
    expect(text).toContain("flowchart");
    const again = parseMermaidFlowchart(text)!;
    expect(again.nodes.size).toBe(parsed.nodes.size);
    expect(again.edges).toHaveLength(parsed.edges.length);
    expect(again.nodes.get("n3")?.label).toBe("Qualificado?");
    const sim = again.edges.find((e) => e.label === "Sim");
    expect(sim).toMatchObject({ from: "n3", to: "n4" });
  });
});
