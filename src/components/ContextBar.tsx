import { useMemo, useState } from "react";
import { useStore } from "../store";
import { COLORS, colorToken, DECO_OPTIONS } from "../palette";
import type { Cardinality, Color, Connector, Deco, EndpointMarker, Shape, ShapeType } from "../types";
import { boundsOf, rectCenter, routeConnector } from "../geometry";

type Menu = "color" | "shape" | "from" | "to" | "route" | "more" | null;

const CARDINALITIES: { value: Exclude<Cardinality, null>; label: string }[] = [
  { value: "zero-or-one", label: "Zero ou um" },
  { value: "one", label: "Um" },
  { value: "zero-or-many", label: "Zero ou vários" },
  { value: "one-or-many", label: "Um ou vários" },
];

const MARKERS: { value: EndpointMarker; label: string }[] = [
  { value: "arrow", label: "Seta" },
  { value: "circle", label: "Círculo" },
  { value: "diamond", label: "Losango" },
  { value: "fork", label: "Garfurra" },
];

const SHAPES: { value: ShapeType; label: string }[] = [
  { value: "rect", label: "Retângulo" },
  { value: "pill", label: "Pílula" },
  { value: "ellipse", label: "Elipse" },
  { value: "diamond", label: "Decisão" },
  { value: "triangle", label: "Triângulo" },
  { value: "hexagon", label: "Hexágono" },
  { value: "cylinder", label: "Cilindro" },
  { value: "parallelogram", label: "Paralelogramo" },
  { value: "document", label: "Documento" },
];

export function ContextBar() {
  const targetId = useStore((s) => s.contextBarFor);
  const board = useStore((s) => s.board);
  const camera = useStore((s) => s.camera);
  const setStyle = useStore((s) => s.setStyle);
  const updateObject = useStore((s) => s.updateObject);
  const deleteSelection = useStore((s) => s.deleteSelection);
  const duplicateSelection = useStore((s) => s.duplicateSelection);
  const bringToFront = useStore((s) => s.bringToFront);
  const sendToBack = useStore((s) => s.sendToBack);
  const rotateSelection = useStore((s) => s.rotateSelection);
  const swapEndpoints = useStore((s) => s.swapEndpoints);
  const applyConnectorDefaults = useStore((s) => s.applyConnectorDefaults);
  const setEditing = useStore((s) => s.setEditing);
  const pushHistory = useStore((s) => s.pushHistory);

  const [menu, setMenu] = useState<{ name: Menu; x: number } | null>(null);
  const [customColor, setCustomColor] = useState("#8b3fd9");

  const screenPos = useMemo(() => {
    const o = targetId ? board.objects[targetId] : null;
    if (!o) return null;
    if ("rect" in o && o.rect) {
      const b = o.rect;
      return { x: (b.x + b.w / 2) * camera.zoom + camera.x, y: b.y * camera.zoom + camera.y };
    }
    if (o.objectType === "connector") {
      const fr = board.objects[o.fromId];
      const tr = board.objects[o.toId];
      if (fr && tr && "rect" in fr && fr.rect && "rect" in tr && tr.rect) {
        const route = routeConnector(o, fr.rect, tr.rect);
        return { x: route.mid.x * camera.zoom + camera.x, y: route.mid.y * camera.zoom + camera.y - 8 };
      }
    }
    return null;
  }, [targetId, board.objects, camera]);

  if (!targetId || !screenPos) return null;

  const first = board.objects[targetId];
  const shape = first && first.objectType === "shape" ? (first as Shape) : null;
  const connector = first && first.objectType === "connector" ? (first as Connector) : null;
  const single = true;

  const toggle = (name: Menu, e: React.MouseEvent) => {
    const x = (e.currentTarget as HTMLElement).offsetLeft;
    setMenu((m) => (m && m.name === name ? null : { name, x }));
  };

  const BarButton = ({
    icon,
    label,
    active,
    onClick,
    menuName,
  }: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    menuName?: Menu;
  }) => (
    <button
      type="button"
      className={`ctx-btn ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      onClick={(e) => {
        if (menuName) toggle(menuName, e);
        else onClick?.();
      }}
    >
      {icon}
    </button>
  );

  const colorValue = shape ? shape.style.color : connector ? connector.style.color : "gray";
  const decoValue = shape ? shape.style.deco : connector ? connector.style.deco : "outline";

  return (
    <div className="ctxbar-wrap" style={{ left: screenPos.x, top: screenPos.y }}>
      <div className="ctxbar" data-wc="contextbar">
        {shape || single ? (
          <BarButton
            icon={<IconText />}
            label="Texto"
            onClick={() => setEditing(targetId)}
          />
        ) : null}

        {shape ? (
          <>
            <Sep />
            <BarButton icon={<IconShapes />} label="Mudar forma" menuName="shape" />
            <Sep />
            <BarButton icon={<IconDot color={colorToken(shape.style.color).base} />} label="Cor" menuName="color" />
            <Sep />
            <Segmented
              value={shape.style.deco}
              onChange={(d) => setStyle(shape.id, { deco: d })}
            />
          </>
        ) : null}

        {connector ? (
          <>
            <Sep />
            <BarButton icon={<IconDot color={colorToken(connector.style.color).base} />} label="Cor" menuName="color" />
            <Sep />
            <Segmented value={connector.style.deco} onChange={(d) => setStyle(connector.id, { deco: d })} connector />
            <Sep />
            <BarButton icon={<IconEndpoint side="from" />} label="Ponta inicial" menuName="from" />
            <BarButton icon={<IconSwap />} label="Inverter pontas" onClick={() => swapEndpoints(connector.id)} />
            <BarButton icon={<IconEndpoint side="to" />} label="Ponta final" menuName="to" />
            <Sep />
            <BarButton
              icon={<IconRoute type={connector.connectorType} />}
              label="Rota"
              menuName="route"
            />
            <Sep />
            <BarButton icon={<IconStar />} label="Aplicar aos próximos" onClick={() => applyConnectorDefaults(connector.id)} />
          </>
        ) : null}

        {shape ? (
          <>
            <Sep />
            <BarButton icon={<IconRotate />} label="Rotacionar" onClick={rotateSelection} />
          </>
        ) : null}

        <Sep />
        <BarButton icon={<IconCopy />} label="Duplicar" onClick={duplicateSelection} />
        <BarButton icon={<IconMore />} label="Mais" menuName="more" />
      </div>

      {menu?.name === "color" ? (
        <Popover x={menu.x}>
          <div className="ctx-pop-title">Cor</div>
          <div className="ctx-swatches">
            {COLORS.map((c) => (
              <button
                key={c.name}
                className={`ctx-swatch ${colorValue === c.name ? "active" : ""}`}
                title={c.label}
                style={{ background: c.base }}
                onClick={() => {
                  setStyle(targetId, { color: c.name, hex: undefined });
                }}
              />
            ))}
            <label className="ctx-swatch custom" title="Cor personalizada" style={{ background: customColor }}>
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  setStyle(targetId, { hex: e.target.value });
                }}
              />
            </label>
          </div>
        </Popover>
      ) : null}

      {menu?.name === "shape" && shape ? (
        <Popover x={menu.x}>
          <div className="ctx-pop-title">Forma</div>
          <div className="ctx-shape-grid">
            {SHAPES.map((s) => (
              <button
                key={s.value}
                className={`ctx-shape ${shape.shapeType === s.value ? "active" : ""}`}
                title={s.label}
                onClick={() => updateObject(shape.id, { shapeType: s.value })}
              >
                <ShapeGlyph type={s.value} />
              </button>
            ))}
          </div>
        </Popover>
      ) : null}

      {(menu?.name === "from" || menu?.name === "to") && connector ? (
        <Popover x={menu.x}>
          <div className="ctx-pop-title">{menu.name === "from" ? "Ponta inicial" : "Ponta final"}</div>
          <div className="ctx-pop-label">Cardinalidade</div>
          <div className="ctx-grid-4">
            {CARDINALITIES.map((c) => {
              const cur = menu.name === "from" ? connector.fromCardinality : connector.toCardinality;
              return (
                <button
                  key={c.value}
                  className={`ctx-cell ${cur === c.value ? "active" : ""}`}
                  title={c.label}
                  onClick={() =>
                    updateObject(connector.id, {
                      [menu.name === "from" ? "fromCardinality" : "toCardinality"]: cur === c.value ? null : c.value,
                    } as never)
                  }
                >
                  <CardinalityGlyph value={c.value} />
                </button>
              );
            })}
          </div>
          <div className="ctx-pop-label">Ponta</div>
          <div className="ctx-grid-4">
            {MARKERS.map((m) => {
              const cur = menu.name === "from" ? connector.fromEndpoint : connector.toEndpoint;
              return (
                <button
                  key={m.value}
                  className={`ctx-cell ${cur === m.value ? "active" : ""}`}
                  title={m.label}
                  onClick={() =>
                    updateObject(connector.id, {
                      [menu.name === "from" ? "fromEndpoint" : "toEndpoint"]: cur === m.value ? "none" : m.value,
                    } as never)
                  }
                >
                  <MarkerGlyph value={m.value} />
                </button>
              );
            })}
          </div>
        </Popover>
      ) : null}

      {menu?.name === "route" && connector ? (
        <Popover x={menu.x}>
          <div className="ctx-pop-title">Rota</div>
          <div className="ctx-list">
            {(["elbow", "straight", "curved"] as const).map((t) => (
              <button
                key={t}
                className={`ctx-list-item ${connector.connectorType === t ? "active" : ""}`}
                onClick={() => updateObject(connector.id, { connectorType: t })}
              >
                {t === "elbow" ? "Ortogonal" : t === "straight" ? "Reta" : "Curva"}
              </button>
            ))}
          </div>
        </Popover>
      ) : null}

      {menu?.name === "more" ? (
        <Popover x={menu.x}>
          <div className="ctx-list">
            {shape ? (
              <>
                <button className="ctx-list-item" onClick={() => { pushHistory(); bringToFront(); }}>Trazer para frente</button>
                <button className="ctx-list-item" onClick={() => { pushHistory(); sendToBack(); }}>Enviar para trás</button>
              </>
            ) : null}
            <button className="ctx-list-item danger" onClick={deleteSelection}>Excluir</button>
          </div>
        </Popover>
      ) : null}
    </div>
  );
}

function Sep() {
  return <span className="ctx-sep" />;
}

function Popover({ x, children }: { x: number; children: React.ReactNode }) {
  return (
    <div className="ctx-popover" style={{ left: Math.max(0, x - 60) }}>
      {children}
    </div>
  );
}

function Segmented({ value, onChange, connector }: { value: Deco; onChange: (d: Deco) => void; connector?: boolean }) {
  const order: Deco[] = connector ? ["outline", "dash", "fill"] : ["fill", "outline", "dash", "transparent"];
  const opts = order.map((v) => DECO_OPTIONS.find((o) => o.value === v)!);
  return (
    <div className="ctx-segmented">
      {opts.map((o) => (
        <button
          key={o.value}
          className={`ctx-seg ${value === o.value ? "active" : ""}`}
          title={o.label}
          onClick={() => onChange(o.value)}
        >
          <DecoGlyph value={o.value} />
        </button>
      ))}
    </div>
  );
}

/* ---------------- icons ---------------- */

function svg(path: React.ReactNode) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}

function IconText() {
  return svg(<><path d="M4 5h12" /><path d="M10 5v11" /></>);
}
function IconShapes() {
  return svg(<><rect x="3" y="3" width="8" height="8" rx="1.5" /><circle cx="14" cy="14" r="4" /></>);
}
function IconDot({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" fill={color} stroke="rgba(0,0,0,.15)" />
    </svg>
  );
}
function IconRotate() {
  return svg(<><path d="M15 7a6 6 0 1 0 1 4" /><path d="M15 3v4h-4" /></>);
}
function IconCopy() {
  return svg(<><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></>);
}
function IconMore() {
  return svg(<><circle cx="5" cy="10" r="1" fill="currentColor" /><circle cx="10" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /></>);
}
function IconStar() {
  return svg(<path d="M10 3l2 4.5 5 .5-3.7 3.3 1 4.7L10 13.7 5.7 16l1-4.7L3 8l5-.5z" />);
}
function IconSwap() {
  return svg(<><path d="M4 8h12" /><path d="M13 5l3 3-3 3" /><path d="M16 14H4" /><path d="M7 11l-3 3 3 3" /></>);
}
function IconEndpoint({ side }: { side: "from" | "to" }) {
  return side === "from" ? svg(<><path d="M16 10H4" /><path d="M8 6l-4 4 4 4" /></>) : svg(<><path d="M4 10h12" /><path d="M12 6l4 4-4 4" /></>);
}
function IconRoute({ type }: { type: string }) {
  return svg(type === "straight" ? <path d="M4 16L16 4" /> : <><path d="M4 6h8v8h4" /><path d="M4 6v10" /></>);
}

function DecoGlyph({ value }: { value: Deco }) {
  const stroke = "currentColor";
  if (value === "fill") return <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="2" fill={stroke} /></svg>;
  if (value === "dash")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke={stroke} strokeWidth="1.5" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" strokeDasharray="3 2" />
      </svg>
    );
  if (value === "transparent")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke={stroke} strokeWidth="1" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" />
        <path d="M2 8h12M8 2v12" strokeOpacity="0.4" />
      </svg>
    );
  return <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2" fill="none" stroke={stroke} strokeWidth="1.5" /></svg>;
}

function ShapeGlyph({ type }: { type: ShapeType }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" as const };
  switch (type) {
    case "pill":
      return <svg width="22" height="22" viewBox="0 0 22 22"><rect x="2" y="7" width="18" height="8" rx="4" {...p} /></svg>;
    case "ellipse":
      return <svg width="22" height="22" viewBox="0 0 22 22"><ellipse cx="11" cy="11" rx="8" ry="6" {...p} /></svg>;
    case "diamond":
      return <svg width="22" height="22" viewBox="0 0 22 22"><polygon points="11,3 19,11 11,19 3,11" {...p} /></svg>;
    case "triangle":
      return <svg width="22" height="22" viewBox="0 0 22 22"><polygon points="11,3 19,18 3,18" {...p} /></svg>;
    case "hexagon":
      return <svg width="22" height="22" viewBox="0 0 22 22"><polygon points="6,4 16,4 20,11 16,18 6,18 2,11" {...p} /></svg>;
    case "cylinder":
      return <svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 6a8 3 0 0 1 16 0v10a8 3 0 0 1-16 0z" {...p} /><path d="M3 6a8 3 0 0 0 16 0" {...p} /></svg>;
    case "parallelogram":
      return <svg width="22" height="22" viewBox="0 0 22 22"><polygon points="6,5 20,5 16,17 2,17" {...p} /></svg>;
    case "document":
      return <svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 4h16v11c-2 1-4 0-8 1s-6 0-8 1z" {...p} /></svg>;
    default:
      return <svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="12" rx="2" {...p} /></svg>;
  }
}

function CardinalityGlyph({ value }: { value: Exclude<Cardinality, null> }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" as const };
  const many = value === "zero-or-many" || value === "one-or-many";
  const zero = value === "zero-or-one" || value === "zero-or-many";
  return (
    <svg width="26" height="18" viewBox="0 0 26 18">
      <path d="M3 9h20" {...s} />
      {zero ? <circle cx="20" cy="9" r="3" {...s} /> : <path d="M20 5v8" {...s} />}
      {many ? <><path d="M4 9L9 5" {...s} /><path d="M4 9L9 13" {...s} /></> : null}
    </svg>
  );
}

function MarkerGlyph({ value }: { value: EndpointMarker }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" as const };
  return (
    <svg width="26" height="18" viewBox="0 0 26 18">
      <path d="M3 9h17" {...s} />
      {value === "arrow" ? <path d="M20 5l4 4-4 4z" fill="currentColor" /> : null}
      {value === "circle" ? <circle cx="20" cy="9" r="3.2" {...s} /> : null}
      {value === "diamond" ? <path d="M20 5l4 4-4 4-4-4z" fill="currentColor" /> : null}
      {value === "fork" ? <><path d="M20 9L24 5" {...s} /><path d="M20 9L24 13" {...s} /><path d="M20 9h4" {...s} /></> : null}
    </svg>
  );
}
