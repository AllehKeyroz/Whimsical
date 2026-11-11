import {
  BOARD_VERSION,
  DEFAULT_SETTINGS,
  LEFT_TEXT_STYLE,
  type Board,
  type BoardObject,
  type Cardinality,
  type Comment,
  type Connector,
  type ConnectorType,
  type Deco,
  type EndpointMarker,
  type Folder,
  type Frame,
  type IconObject,
  type ImageObject,
  type Settings,
  type Shape,
  type ShapeType,
  type Style,
  type TextObject,
  type TextStyle,
  type Vec,
  type Color,
} from "../types";
import { nanoid } from "nanoid";

const COLORS: Color[] = [
  "white",
  "smoke",
  "gray",
  "slate",
  "blue",
  "indigo",
  "purple",
  "pink",
  "mint",
  "green",
  "brown",
  "crimson",
  "red",
  "orange",
  "yellow",
];

const DECOS: Deco[] = ["fill", "outline", "dash", "transparent"];
const SHAPES: ShapeType[] = [
  "rect",
  "pill",
  "ellipse",
  "diamond",
  "triangle",
  "hexagon",
  "cylinder",
  "parallelogram",
  "document",
  "sticky",
];
const CONNECTOR_TYPES: ConnectorType[] = ["elbow", "straight", "curved"];
const MARKERS: EndpointMarker[] = ["none", "arrow", "circle", "diamond", "fork"];
const CARDINALITIES: Cardinality[] = [
  "zero-or-one",
  "one",
  "zero-or-many",
  "one-or-many",
  null,
];

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function num(v: unknown, fb: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}
function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}
function bool(v: unknown, fb = false): boolean {
  return typeof v === "boolean" ? v : fb;
}
function hex(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
}

export function normalizeRect(raw: unknown): { x: number; y: number; w: number; h: number } {
  if (!isRec(raw)) return { x: 0, y: 0, w: 192, h: 96 };
  return {
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    w: Math.max(4, num(raw.w, 192)),
    h: Math.max(4, num(raw.h, 96)),
  };
}

export function normalizeStyle(raw: unknown, fallback: Style = { color: "gray", deco: "outline" }): Style {
  if (!isRec(raw)) return { ...fallback };
  const color = COLORS.includes(raw.color as Color) ? (raw.color as Color) : fallback.color;
  const deco = DECOS.includes(raw.deco as Deco) ? (raw.deco as Deco) : fallback.deco;
  return { color, deco, hex: hex(raw.hex) };
}

export function normalizeTextStyle(raw: unknown, fallback: TextStyle = LEFT_TEXT_STYLE): TextStyle {
  if (!isRec(raw)) return { ...fallback };
  const weight = [400, 500, 600, 700].includes(num(raw.fontWeight, 400))
    ? (num(raw.fontWeight, 400) as TextStyle["fontWeight"])
    : 400;
  const align =
    raw.align === "left" || raw.align === "center" || raw.align === "right"
      ? raw.align
      : fallback.align;
  return {
    fontSize: Math.max(6, Math.min(200, num(raw.fontSize, fallback.fontSize))),
    fontWeight: weight,
    italic: bool(raw.italic, fallback.italic),
    underline: bool(raw.underline, fallback.underline),
    align,
    color: hex(raw.color) ?? fallback.color,
  };
}

function normalizeVec(raw: unknown): Vec | null {
  if (!isRec(raw)) return null;
  const x = num(raw.x, NaN);
  const y = num(raw.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function normalizeComments(raw: unknown): Comment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Comment[] = [];
  for (const c of raw) {
    if (!isRec(c)) continue;
    const text = str(c.text).trim();
    if (!text) continue;
    out.push({
      id: str(c.id) || nanoid(),
      author: str(c.author, "Anônimo"),
      text,
      createdAt: num(c.createdAt, Date.now()),
      resolved: bool(c.resolved, false),
    });
  }
  return out.length ? out : undefined;
}

function base(raw: Rec, objectType: BoardObject["objectType"], index: number): Omit<BoardObject, never> {
  return {
    id: str(raw.id) || nanoid(),
    objectType,
    parentId: str(raw.parentId) || null,
    groupId: str(raw.groupId) || null,
    order: num(raw.order, index + 1),
    rotation: [0, 90, 180, 270].includes(num(raw.rotation, 0)) ? num(raw.rotation, 0) : 0,
    hidden: bool(raw.hidden, false),
    locked: bool(raw.locked, false),
    link: str(raw.link) || undefined,
    comments: normalizeComments(raw.comments),
  } as Omit<BoardObject, never>;
}

export function normalizeObject(raw: unknown, index: number): BoardObject | null {
  if (!isRec(raw)) return null;
  const type = raw.objectType;
  try {
    if (type === "shape") {
      const b = base(raw, "shape", index);
      const shape: Shape = {
        ...(b as Shape),
        objectType: "shape",
        id: str(raw.id) || nanoid(),
        shapeType: SHAPES.includes(raw.shapeType as ShapeType) ? (raw.shapeType as ShapeType) : "rect",
        rect: normalizeRect(raw.rect),
        style: normalizeStyle(raw.style),
        text: str(raw.text),
        textStyle: normalizeTextStyle(raw.textStyle, { ...LEFT_TEXT_STYLE, align: "center" }),
      };
      return shape;
    }
    if (type === "frame") {
      const frame: Frame = {
        ...(base(raw, "frame", index) as Frame),
        objectType: "frame",
        id: str(raw.id) || nanoid(),
        rect: normalizeRect(raw.rect),
        style: normalizeStyle(raw.style, { color: "smoke", deco: "outline" }),
        text: str(raw.text, "Frame"),
        textStyle: normalizeTextStyle(raw.textStyle, { ...LEFT_TEXT_STYLE, fontSize: 13, fontWeight: 500 }),
      };
      return frame;
    }
    if (type === "text") {
      const fallback: TextStyle = { ...LEFT_TEXT_STYLE, fontSize: num(raw.fontSize, 18) };
      const text: TextObject = {
        ...(base(raw, "text", index) as TextObject),
        objectType: "text",
        id: str(raw.id) || nanoid(),
        rect: normalizeRect(raw.rect),
        style: normalizeStyle(raw.style, { color: "gray", deco: "transparent" }),
        text: str(raw.text, "Texto"),
        textStyle: normalizeTextStyle(raw.textStyle, fallback),
      };
      return text;
    }
    if (type === "image") {
      const image: ImageObject = {
        ...(base(raw, "image", index) as ImageObject),
        objectType: "image",
        id: str(raw.id) || nanoid(),
        rect: normalizeRect(raw.rect),
        src: str(raw.src),
        alt: str(raw.alt) || undefined,
      };
      if (!image.src) return null;
      return image;
    }
    if (type === "icon") {
      const iconSet = raw.iconSet === "emoji" ? "emoji" : raw.iconSet === "svg" ? "svg" : "lucide";
      const icon: IconObject = {
        ...(base(raw, "icon", index) as IconObject),
        objectType: "icon",
        id: str(raw.id) || nanoid(),
        rect: normalizeRect(raw.rect),
        icon: str(raw.icon, "Star"),
        iconSet,
        svgData: iconSet === "svg" ? str(raw.svgData).slice(0, 120000) || undefined : undefined,
        svgPlate: iconSet === "svg" ? str(raw.svgPlate).slice(0, 32) || undefined : undefined,
        style: normalizeStyle(raw.style, { color: "purple", deco: "outline" }),
        strokeWidth: Math.max(0.5, Math.min(6, num(raw.strokeWidth, 2))),
      };
      return icon;
    }
    if (type === "connector") {
      const fromRel = isRec(raw.fromRel) ? raw.fromRel : {};
      const toRel = isRec(raw.toRel) ? raw.toRel : {};
      const conn: Connector = {
        ...(base(raw, "connector", index) as Connector),
        objectType: "connector",
        id: str(raw.id) || nanoid(),
        fromId: str(raw.fromId),
        toId: str(raw.toId),
        connectorType: CONNECTOR_TYPES.includes(raw.connectorType as ConnectorType)
          ? (raw.connectorType as ConnectorType)
          : "elbow",
        fromRel: {
          rx: Math.max(0, Math.min(1, num(fromRel.rx, 0.5))),
          ry: Math.max(0, Math.min(1, num(fromRel.ry, 0.5))),
          axis: fromRel.axis === "x" || fromRel.axis === "y" ? fromRel.axis : undefined,
        },
        toRel: {
          rx: Math.max(0, Math.min(1, num(toRel.rx, 0.5))),
          ry: Math.max(0, Math.min(1, num(toRel.ry, 0.5))),
          axis: toRel.axis === "x" || toRel.axis === "y" ? toRel.axis : undefined,
        },
        fromEndpoint: MARKERS.includes(raw.fromEndpoint as EndpointMarker)
          ? (raw.fromEndpoint as EndpointMarker)
          : "none",
        toEndpoint: MARKERS.includes(raw.toEndpoint as EndpointMarker)
          ? (raw.toEndpoint as EndpointMarker)
          : "arrow",
        fromCardinality: CARDINALITIES.includes(raw.fromCardinality as Cardinality)
          ? (raw.fromCardinality as Cardinality)
          : null,
        toCardinality: CARDINALITIES.includes(raw.toCardinality as Cardinality)
          ? (raw.toCardinality as Cardinality)
          : null,
        fromPoint: normalizeVec(raw.fromPoint),
        toPoint: normalizeVec(raw.toPoint),
        bend: normalizeVec(raw.bend),
        style: normalizeStyle(raw.style, { color: "gray", deco: "outline" }),
        label: str(raw.label),
        labelStyle: isRec(raw.labelStyle)
          ? normalizeTextStyle(raw.labelStyle, { ...LEFT_TEXT_STYLE, fontSize: 13 })
          : undefined,
      };
      return conn;
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeBoard(input: unknown): Board | null {
  if (!isRec(input)) return null;
  const rawObjects = isRec(input.objects) ? input.objects : null;
  if (!rawObjects) return null;
  const objects: Record<string, BoardObject> = {};
  let index = 0;
  for (const [key, value] of Object.entries(rawObjects)) {
    const obj = normalizeObject(value, index++);
    if (!obj) continue;
    if (!obj.id) obj.id = key;
    objects[obj.id] = obj;
  }
  // Fix parent references and reject dangling parents.
  for (const obj of Object.values(objects)) {
    if (obj.parentId && !objects[obj.parentId]) obj.parentId = null;
    if (obj.parentId && objects[obj.parentId]?.objectType !== "frame") obj.parentId = null;
  }
  // Drop connectors with no valid endpoint at all.
  for (const obj of Object.values(objects)) {
    if (obj.objectType !== "connector") continue;
    const from = objects[obj.fromId];
    const to = objects[obj.toId];
    const okFrom = !!obj.fromPoint || (!!from && from.objectType !== "connector");
    const okTo = !!obj.toPoint || (!!to && to.objectType !== "connector");
    if (!okFrom || !okTo) delete objects[obj.id];
  }
  const now = Date.now();
  return {
    id: str(input.id) || nanoid(),
    title: str(input.title, "Board sem título"),
    fontFamily: str(input.fontFamily, "Dinsical"),
    version: BOARD_VERSION,
    createdAt: num(input.createdAt, now),
    updatedAt: num(input.updatedAt, now),
    folderId: str(input.folderId) || null,
    objects,
  };
}

function normalizeFolders(raw: unknown): Folder[] {
  if (!Array.isArray(raw)) return [];
  const out: Folder[] = [];
  for (const item of raw) {
    if (!isRec(item)) continue;
    const name = str(item.name).trim();
    if (!name) continue;
    out.push({
      id: str(item.id) || nanoid(),
      name: name.slice(0, 60),
      createdAt: num(item.createdAt, Date.now()),
    });
  }
  return out;
}

export function normalizeSettings(input: unknown): Settings {
  if (!isRec(input)) return { ...DEFAULT_SETTINGS };
  return {
    theme: input.theme === "light" ? "light" : input.theme === "dark" ? "dark" : DEFAULT_SETTINGS.theme,
    grid: bool(input.grid, DEFAULT_SETTINGS.grid),
    snap: bool(input.snap, DEFAULT_SETTINGS.snap),
    language: input.language === "en" ? "en" : "pt",
    userName: str(input.userName, DEFAULT_SETTINGS.userName).slice(0, 40),
    organization: str(input.organization, DEFAULT_SETTINGS.organization).slice(0, 60) || DEFAULT_SETTINGS.organization,
    lastBoardId: str(input.lastBoardId) || null,
    relayUrl: str(input.relayUrl),
    folders: normalizeFolders(input.folders),
    workspaceFilter: str(input.workspaceFilter, DEFAULT_SETTINGS.workspaceFilter),
  };
}

/** Deep clone that preserves only plain JSON data (safe for clipboard). */
export function cloneObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
