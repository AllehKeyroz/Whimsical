// Approximate text measurement + word wrapping for SVG <text>/<tspan>.
// Whimsical ships its own Unicode line-break implementation; we approximate
// with average glyph widths per character class, which is good enough for
// board shapes and keeps rendering pure-SVG (exportable).

const NARROW = "iljtfrI.,:;'|!";
const WIDE = "mwMW@%";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function charWidth(ch: string, fontSize: number): number {
  const em = fontSize;
  if (ch === " ") return em * 0.28;
  if (NARROW.includes(ch)) return em * 0.3;
  if (WIDE.includes(ch)) return em * 0.9;
  if (UPPER.includes(ch)) return em * 0.66;
  if (/[0-9]/.test(ch)) return em * 0.56;
  return em * 0.52;
}

export function measure(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch, fontSize);
  return w;
}

export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (measure(candidate, fontSize) <= maxWidth || line === "") {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}
