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

export type ObjectType = "shape" | "connector" | "frame" | "text";

export interface BaseObject {
  id: string;
  objectType: ObjectType;
  parentId: string | null;
  order: number;
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
  | "document";

export interface Shape extends BaseObject {
  objectType: "shape";
  shapeType: ShapeType;
  rect: Rect;
  style: Style;
  text: string;
}

export interface Frame extends BaseObject {
  objectType: "frame";
  rect: Rect;
  style: Style;
  text: string;
}

export interface TextObject extends BaseObject {
  objectType: "text";
  rect: Rect;
  style: Style;
  text: string;
  fontSize: number;
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
  style: { color: Color; deco: Deco };
  label: string;
}

export type BoardObject = Shape | Connector | Frame | TextObject;

export interface Board {
  id: string;
  title: string;
  fontFamily: string;
  objects: Record<string, BoardObject>;
}

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

export type Tool =
  | "select"
  | "pan"
  | "shape:rect"
  | "shape:pill"
  | "shape:ellipse"
  | "shape:diamond"
  | "text"
  | "frame"
  | "connect";
