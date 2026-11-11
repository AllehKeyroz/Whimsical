export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Whimsical's 15 board colors (light theme values).
export type Color =
  | "white"
  | "smoke"
  | "gray"
  | "slate"
  | "blue"
  | "indigo"
  | "purple"
  | "pink"
  | "mint"
  | "green"
  | "brown"
  | "crimson"
  | "red"
  | "orange"
  | "yellow";

// Whimsical style options: Fill, Outline, Dash, Transparent.
export type Deco = "fill" | "outline" | "dash" | "transparent";

export interface Style {
  color: Color;
  deco: Deco;
  /** Optional custom hex color overriding `color`. */
  hex?: string;
}

export type TextAlign = "left" | "center" | "right";

export interface TextStyle {
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  /** Optional custom text color. */
  color?: string;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 18,
  fontWeight: 400,
  italic: false,
  underline: false,
  align: "center",
};

export const LEFT_TEXT_STYLE: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  align: "left",
};

export type ObjectType = "shape" | "connector" | "frame" | "text" | "image" | "icon";

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  resolved?: boolean;
}

export interface BaseObject {
  id: string;
  objectType: ObjectType;
  parentId: string | null;
  /** Group membership id. Objects sharing a groupId move/select together. */
  groupId?: string | null;
  order: number;
  /** Rotation in degrees (multiples of 90). */
  rotation?: number;
  hidden?: boolean;
  locked?: boolean;
  /** Optional external link opened from the context bar. */
  link?: string;
  comments?: Comment[];
}

export type ShapeType =
  | "rect"
  | "pill"
  | "ellipse"
  | "diamond"
  | "triangle"
  | "hexagon"
  | "cylinder"
  | "parallelogram"
  | "document"
  | "sticky";

export interface Shape extends BaseObject {
  objectType: "shape";
  shapeType: ShapeType;
  rect: Rect;
  style: Style;
  text: string;
  textStyle: TextStyle;
}

export interface Frame extends BaseObject {
  objectType: "frame";
  rect: Rect;
  style: Style;
  text: string;
  textStyle: TextStyle;
}

export interface TextObject extends BaseObject {
  objectType: "text";
  rect: Rect;
  style: Style;
  text: string;
  textStyle: TextStyle;
}

export interface ImageObject extends BaseObject {
  objectType: "image";
  rect: Rect;
  src: string;
  alt?: string;
}

export interface IconObject extends BaseObject {
  objectType: "icon";
  rect: Rect;
  /** Lucide icon name (PascalCase) or the emoji character. */
  icon: string;
  iconSet: "lucide" | "emoji";
  style: Style;
  strokeWidth?: number;
}

export type ConnectorType = "elbow" | "straight" | "curved";

// Endpoint markers available in Whimsical's connector menu.
export type EndpointMarker = "none" | "arrow" | "circle" | "diamond" | "fork";
// UML-style cardinality notation, drawn next to the marker.
export type Cardinality = "zero-or-one" | "one" | "zero-or-many" | "one-or-many" | null;

export interface RelativeAnchor {
  rx: number;
  ry: number;
  /** Which edge the connector attaches to: "x" = left/right, "y" = top/bottom. */
  axis?: "x" | "y";
}

export interface Connector extends BaseObject {
  objectType: "connector";
  fromId: string;
  toId: string;
  connectorType: ConnectorType;
  fromRel: RelativeAnchor;
  toRel: RelativeAnchor;
  fromEndpoint: EndpointMarker;
  toEndpoint: EndpointMarker;
  fromCardinality: Cardinality;
  toCardinality: Cardinality;
  /** Detached endpoint position (when the endpoint isn't attached to a shape). */
  fromPoint?: Vec | null;
  toPoint?: Vec | null;
  /** Manual route bend, set by dragging a segment. */
  bend?: Vec | null;
  style: Style;
  label: string;
  labelStyle?: TextStyle;
}

export type BoardObject = Shape | Connector | Frame | TextObject | ImageObject | IconObject;

export interface Board {
  id: string;
  title: string;
  fontFamily: string;
  objects: Record<string, BoardObject>;
  version: number;
  createdAt: number;
  updatedAt: number;
  folderId?: string | null;
}

export interface BoardMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  count: number;
  folderId?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export type Theme = "light" | "dark";

export interface Settings {
  theme: Theme;
  grid: boolean;
  snap: boolean;
  language: "pt" | "en";
  userName: string;
  lastBoardId: string | null;
  /** Optional websocket relay used for cross-device collaboration. */
  relayUrl: string;
  /** Dashboard folders (workspaces) created by the user. */
  folders: Folder[];
  /** Current dashboard/explorer filter: "all", "recent", "private" or a folder id. */
  workspaceFilter: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  grid: true,
  snap: true,
  language: "pt",
  userName: "Alessandro",
  lastBoardId: null,
  relayUrl: "",
  folders: [],
  workspaceFilter: "all",
};

export const BOARD_VERSION = 2;

export function isShape(o: BoardObject): o is Shape {
  return o.objectType === "shape";
}
export function isConnector(o: BoardObject): o is Connector {
  return o.objectType === "connector";
}
export function isFrame(o: BoardObject): o is Frame {
  return o.objectType === "frame";
}
export function isText(o: BoardObject): o is TextObject {
  return o.objectType === "text";
}
export function isImage(o: BoardObject): o is ImageObject {
  return o.objectType === "image";
}
export function isIcon(o: BoardObject): o is IconObject {
  return o.objectType === "icon";
}

export function hasRect(o: BoardObject): o is Shape | Frame | TextObject | ImageObject | IconObject {
  return "rect" in o && !!o.rect;
}

export function hasText(o: BoardObject): o is Shape | Frame | TextObject {
  return o.objectType === "shape" || o.objectType === "frame" || o.objectType === "text";
}

export type Tool =
  | "select"
  | "pan"
  | "shape:rect"
  | "shape:pill"
  | "shape:ellipse"
  | "shape:diamond"
  | "shape:triangle"
  | "shape:hexagon"
  | "shape:cylinder"
  | "shape:parallelogram"
  | "shape:document"
  | "shape:sticky"
  | "text"
  | "frame"
  | "connect"
  | "image";
