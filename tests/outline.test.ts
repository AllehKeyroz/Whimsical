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

  it("cria nós de texto e conexões curvas para cada tópico", () => {
    const built = buildOutlineMindMap(OUTLINE, { x: 0, y: 0 })!;
    const texts = built.objects.filter((o) => o.objectType === "text");
    const connectors = built.objects.filter(
      (o) => o.objectType === "connector" && o.connectorType === "curved",
    );
    expect(built.objects.some((o) => o.objectType === "shape")).toBe(false);
    expect(texts).toHaveLength(parseOutline(OUTLINE).length);
    expect(connectors).toHaveLength(texts.length - 1);
    expect(texts[0].text).toBe("Entrada");
    expect(texts.some((t) => t.text === "CRM")).toBe(true);
  });
});
