import { describe, expect, it } from "vitest";
import { measure, wrapText } from "../src/lib/text";

describe("text", () => {
  it("quebra parágrafos", () => {
    expect(wrapText("linha 1\nlinha 2", 400, 18)).toEqual(["linha 1", "linha 2"]);
  });

  it("quebra palavras longas que não cabem", () => {
    const lines = wrapText("supercalifragilisticoespialidoso", 50, 18);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line, 18)).toBeLessThanOrEqual(52);
  });

  it("respeita o número máximo de linhas", () => {
    const lines = wrapText("uma frase bem longa com muitas palavras para quebrar em várias linhas", 60, 18, { maxLines: 2 });
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("considera negrito na medição", () => {
    expect(measure("MMMM", 18, true)).toBeGreaterThan(measure("MMMM", 18, false));
  });
});
