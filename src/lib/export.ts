import type { Board, BoardObject, Connector, Rect } from "../types";
import { aabbOfRect, boundsOf, routeConnector } from "../geometry";
import { colorToken } from "../palette";
import { loadIconLibrary } from "./iconLibrary";

export function boardBounds(board: Board): Rect {
  const objects = Object.values(board.objects).filter((o) => !o.hidden);
  const rects: Rect[] = [];
  for (const o of objects) {
    if (o.objectType === "connector") continue;
    if ("rect" in o && o.rect) rects.push(aabbOfRect(o.rect, o.rotation ?? 0));
  }
  const shapeRects = objects
    .filter((o): o is Exclude<BoardObject, Connector> => o.objectType !== "connector" && "rect" in o)
    .map((o) => aabbOfRect(o.rect, o.rotation ?? 0));
  for (const c of objects) {
    if (c.objectType !== "connector") continue;
    const fr = board.objects[c.fromId];
    const tr = board.objects[c.toId];
    const fromRect =
      fr && fr.objectType !== "connector" && "rect" in fr ? aabbOfRect(fr.rect, fr.rotation ?? 0) : null;
    const toRect =
      tr && tr.objectType !== "connector" && "rect" in tr ? aabbOfRect(tr.rect, tr.rotation ?? 0) : null;
    const obstacles = shapeRects.filter((r) => r !== fromRect && r !== toRect);
    const route = routeConnector(c, fromRect, toRect, obstacles);
    rects.push(boundsOf(route.points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 }))));
  }
  const b = boundsOf(rects);
  if (b.w === 0 && b.h === 0) return { x: 0, y: 0, w: 800, h: 600 };
  return b;
}

export function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "board"
  );
}

let fontCssCache: string | null = null;

export async function getFontCss(): Promise<string> {
  if (fontCssCache) return fontCssCache;
  const faces: string[] = [];
  const files: [string, string][] = [
    ["Dinsical.woff2", "normal"],
    ["Dinsical-Italic.woff2", "italic"],
  ];
  for (const [file, style] of files) {
    try {
      const res = await fetch(`/fonts/${file}`);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const b64 = btoa(bin);
      faces.push(
        `@font-face{font-family:"Dinsical";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:100 900;font-style:${style};font-display:block;}`,
      );
    } catch {
      /* font optional */
    }
  }
  fontCssCache = faces.join("\n");
  return fontCssCache;
}

export interface ExportOptions {
  padding?: number;
  scale?: number;
  transparent?: boolean;
}

export async function buildExportSvg(board: Board, options: ExportOptions = {}): Promise<{ svg: string; width: number; height: number } | null> {
  const live = document.querySelector<SVGSVGElement>(".board-svg");
  if (!live) return null;
  if (Object.values(board.objects).some((o) => o.objectType === "icon")) {
    await loadIconLibrary().catch(() => undefined);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }
  const bounds = boardBounds(board);
  const pad = options.padding ?? 48;
  const width = Math.max(1, Math.ceil(bounds.w + pad * 2));
  const height = Math.max(1, Math.ceil(bounds.h + pad * 2));
  const clone = live.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-export-ignore]").forEach((n) => n.remove());
  const content = clone.querySelector<SVGGElement>("[data-board-content]");
  if (content) content.setAttribute("transform", `translate(${pad - bounds.x}, ${pad - bounds.y})`);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(width));
  bg.setAttribute("height", String(height));
  bg.setAttribute("fill", options.transparent ? "none" : "#fbfcfd");
  clone.insertBefore(bg, clone.firstChild);
  try {
    const css = await getFontCss();
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    // Standalone SVGs do not inherit the app's CSS variables. Pin the light
    // palette here so exported files look identical everywhere.
    style.textContent = `${css}\nsvg{--canvas-bg:#fbfcfd;--canvas-text:#293845;--connector-stroke:#738291;}`;
    clone.insertBefore(style, clone.firstChild);
  } catch {
    /* font optional */
  }
  return { svg: new XMLSerializer().serializeToString(clone), width, height };
}

export async function exportBoardSvg(board: Board, options: ExportOptions = {}): Promise<boolean> {
  const built = await buildExportSvg(board, options);
  if (!built) return false;
  download(new Blob([built.svg], { type: "image/svg+xml;charset=utf-8" }), `${slug(board.title)}.svg`);
  return true;
}

export async function exportBoardPng(board: Board, options: ExportOptions = {}): Promise<boolean> {
  const built = await buildExportSvg(board, options);
  if (!built) return false;
  const scale = Math.max(0.5, Math.min(4, options.scale ?? 2));
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(built.svg)}`;
  const img = new Image();
  const loaded = new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
  });
  img.src = url;
  const ok = await loaded;
  if (!ok) return false;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(built.width * scale);
  canvas.height = Math.round(built.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  if (!options.transparent) {
    ctx.fillStyle = "#fbfcfd";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;
  download(blob, `${slug(board.title)}.png`);
  return true;
}

/** Opens a print window with a full-board SVG; use "Save as PDF" in the dialog. */
export async function printBoard(board: Board): Promise<boolean> {
  // Open the window synchronously so browsers keep the user-gesture allowance.
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return false;
  const built = await buildExportSvg(board, { padding: 32 });
  if (!built) {
    win.close();
    return false;
  }
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(board.title)}</title>
  <style>
    @page { size: auto; margin: 12mm; }
    html,body { margin:0; padding:0; background:#fff; }
    svg { width:100%; height:auto; display:block; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>${built.svg}<script>window.onload=()=>setTimeout(()=>window.print(),300);</script></body></html>`);
  win.document.close();
  return true;
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Rough color for the mini board thumbnails on the dashboard. */
export function thumbnailColor(style: { color: string; deco: string; hex?: string }): string {
  if (style.hex) return style.hex;
  const token = colorToken(style.color as never);
  return style.deco === "fill" ? token.strong : token.soft;
}
