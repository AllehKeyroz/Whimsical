// Approximate text measurement + word wrapping for SVG <text>/<tspan>.
// Unicode line-break rules; we approximate
// with average glyph widths per character class, which is good enough for
// board shapes and keeps rendering pure-SVG (exportable).

const NARROW = "iljtfrI.,:;'|!";
const WIDE = "mwMW@%";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function charWidth(ch: string, fontSize: number, bold = false): number {
  const em = fontSize * (bold ? 1.045 : 1);
  if (ch === " ") return em * 0.28;
  if (NARROW.includes(ch)) return em * 0.3;
  if (WIDE.includes(ch)) return em * 0.9;
  if (UPPER.includes(ch)) return em * 0.66;
  if (/[0-9]/.test(ch)) return em * 0.56;
  return em * 0.52;
}

export function measure(text: string, fontSize: number, bold = false): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch, fontSize, bold);
  return w;
}

export interface WrapOptions {
  bold?: boolean;
  maxLines?: number;
}

/** Break a single long word into chunks that fit `maxWidth`. */
function breakWord(word: string, maxWidth: number, fontSize: number, bold: boolean): string[] {
  const out: string[] = [];
  let current = "";
  for (const ch of word) {
    const candidate = current + ch;
    if (current && measure(candidate, fontSize, bold) > maxWidth) {
      out.push(current);
      current = ch;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out.length ? out : [word];
}

export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  opts: WrapOptions | boolean = {},
): string[] {
  const options: WrapOptions = typeof opts === "boolean" ? { bold: opts } : opts;
  const bold = !!options.bold;
  const maxLines = options.maxLines ?? Infinity;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, fontSize, bold) <= maxWidth || line === "") {
        if (line === "" && measure(word, fontSize, bold) > maxWidth) {
          const chunks = breakWord(word, maxWidth, fontSize, bold);
          for (let i = 0; i < chunks.length - 1; i++) lines.push(chunks[i]);
          line = chunks[chunks.length - 1] ?? "";
        } else {
          line = candidate;
        }
      } else {
        lines.push(line);
        if (measure(word, fontSize, bold) > maxWidth) {
          const chunks = breakWord(word, maxWidth, fontSize, bold);
          for (let i = 0; i < chunks.length - 1; i++) lines.push(chunks[i]);
          line = chunks[chunks.length - 1] ?? "";
        } else {
          line = word;
        }
      }
      if (lines.length >= maxLines) break;
    }
    if (line) lines.push(line);
    if (lines.length >= maxLines) break;
  }
  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    clipped[clipped.length - 1] = `${clipped[clipped.length - 1]}…`;
    return clipped;
  }
  return lines;
}

export function lineCount(text: string, maxWidth: number, fontSize: number, opts: WrapOptions | boolean = {}): number {
  return wrapText(text, maxWidth, fontSize, opts).length;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
}
