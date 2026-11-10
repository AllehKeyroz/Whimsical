import type { Color, Deco } from "./types";

// Whimsical's 15 board colors. Values extracted from the live color popover
// (dark theme) and the serialized `gfx` payloads / OKLCH tokens (light theme).
export interface ColorToken {
  name: Color;
  label: string;
  base: string; // border / stroke
  soft: string; // tinted fill (outline / dash)
  strong: string; // solid fill (fill style)
  onStrong: string; // text on solid fill
}

const TEXT = "#293845";

export const COLORS: ColorToken[] = [
  { name: "white", label: "Branco", base: "#c3cfd9", soft: "#ffffff", strong: "#ffffff", onStrong: TEXT },
  { name: "smoke", label: "Fumaça", base: "#c4cfda", soft: "#f1f4f7", strong: "#c4cfda", onStrong: TEXT },
  { name: "gray", label: "Cinza", base: "#738291", soft: "#d7dfe7", strong: "#738291", onStrong: "#ffffff" },
  { name: "slate", label: "Ardósia", base: "#2e3c4a", soft: "#c4cfda", strong: "#2e3c4a", onStrong: "#ffffff" },
  { name: "blue", label: "Azul", base: "#2484d4", soft: "#cbe1f7", strong: "#2484d4", onStrong: "#ffffff" },
  { name: "indigo", label: "Índigo", base: "#6558F5", soft: "#e0defd", strong: "#6558F5", onStrong: "#ffffff" },
  { name: "purple", label: "Roxo", base: "#BD34D1", soft: "#f2d6f6", strong: "#BD34D1", onStrong: "#ffffff" },
  { name: "pink", label: "Rosa", base: "#be36d3", soft: "#f1d2f5", strong: "#be36d3", onStrong: "#ffffff" },
  { name: "mint", label: "Menta", base: "#26aea0", soft: "#def4f0", strong: "#26aea0", onStrong: "#ffffff" },
  { name: "green", label: "Verde", base: "#207868", soft: "#d2e4e1", strong: "#207868", onStrong: "#ffffff" },
  { name: "brown", label: "Marrom", base: "#8e7e63", soft: "#eddcbe", strong: "#8e7e63", onStrong: "#ffffff" },
  { name: "crimson", label: "Carmim", base: "#AC6363", soft: "#eee0e0", strong: "#AC6363", onStrong: "#ffffff" },
  { name: "red", label: "Vermelho", base: "#D3455B", soft: "#f6dade", strong: "#D3455B", onStrong: "#ffffff" },
  { name: "orange", label: "Laranja", base: "#E8833A", soft: "#fae6d8", strong: "#E8833A", onStrong: "#ffffff" },
  { name: "yellow", label: "Amarelo", base: "#e6b725", soft: "#fceec9", strong: "#e6b725", onStrong: "#4a3a00" },
];

const byName: Record<string, ColorToken> = Object.fromEntries(COLORS.map((c) => [c.name, c]));

export function colorToken(c: Color | undefined): ColorToken {
  return byName[c ?? "gray"] ?? byName["gray"];
}

export interface ShapePaint {
  fill: string;
  stroke: string;
  text: string;
  dashed: boolean;
}

function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? TEXT : "#ffffff";
}

export function shapePaint(style: { color: Color; deco: Deco; hex?: string }): ShapePaint {
  const t = colorToken(style.color);
  if (style.hex) {
    const hex = style.hex;
    switch (style.deco) {
      case "fill":
        return { fill: hex, stroke: hex, text: contrastText(hex), dashed: false };
      case "dash":
        return { fill: hex + "2e", stroke: hex, text: TEXT, dashed: true };
      case "transparent":
        return { fill: "none", stroke: hex, text: TEXT, dashed: false };
      default:
        return { fill: hex + "2e", stroke: hex, text: TEXT, dashed: false };
    }
  }
  switch (style.deco) {
    case "fill":
      return { fill: t.strong, stroke: t.base, text: t.onStrong, dashed: false };
    case "dash":
      return { fill: t.soft, stroke: t.base, text: TEXT, dashed: true };
    case "transparent":
      return { fill: "none", stroke: t.base, text: TEXT, dashed: false };
    default:
      return { fill: t.soft, stroke: t.base, text: TEXT, dashed: false };
  }
}

export const CONNECTOR_COLOR = colorToken("gray").base;
export const TEXT_COLOR = TEXT;

export const DECO_OPTIONS: { value: Deco; label: string }[] = [
  { value: "fill", label: "Preenchido" },
  { value: "outline", label: "Contorno" },
  { value: "dash", label: "Tracejado" },
  { value: "transparent", label: "Transparente" },
];
