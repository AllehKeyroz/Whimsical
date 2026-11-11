import { describe, expect, it } from "vitest";
import { buildOutlineMindMap, looksLikeOutline, parseOutline } from "../src/lib/outline";

const OUTLINE = `Entrada
KDS BRASIL
- CAMPANHAS
    - INTERESSES
        - CRM
        - RD STATION
- PRODUTOS
    - CRM`;

describe("outline -> mapa mental", () => {
  it("detecta listas indentadas e ignora texto corrido", () => {
    expect(looksLikeOutline(OUTLINE)).toBe(true);
    expect(looksLikeOutline("uma frase qualquer\noutra frase")).toBe(false);
  });

  it("calcula a profundidade pelo indent e pelas bullets", () => {
    const entries = parseOutline(OUTLINE);
    expect(entries[0]).toMatchObject({ label: "Entrada", depth: 0 });
    expect(entries[1]).toMatchObject({ label: "KDS BRASIL", depth: 1 });
    expect(entries.find((e) => e.label === "CAMPANHAS")?.depth).toBe(2);
    expect(entries.find((e) => e.label === "INTERESSES")?.depth).toBe(3);
    expect(entries.find((e) => e.label === "RD STATION")?.depth).toBe(4);
  });

  it("cria nós e conexões para cada tópico", () => {
    const built = buildOutlineMindMap(OUTLINE, { x: 0, y: 0 })!;
    const shapes = built.objects.filter((o) => o.objectType === "shape");
    const connectors = built.objects.filter((o) => o.objectType === "connector");
    expect(shapes).toHaveLength(parseOutline(OUTLINE).length);
    expect(connectors).toHaveLength(shapes.length - 1);
    expect(shapes[0].text).toBe("Entrada");
    expect(shapes.some((s) => s.text === "CRM")).toBe(true);
  });
});
