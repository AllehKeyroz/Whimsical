import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { COLORS, DECO_OPTIONS, colorToken } from "../palette";
import type {
  Cardinality,
  Color,
  Deco,
  EndpointMarker,
  Frame,
  IconObject,
  ImageObject,
  Shape,
  ShapeType,
  TextObject,
  TextStyle,
} from "../types";
import { hasText, isConnector, isFrame, isIcon, isShape } from "../types";
import { aabbOfRect, boundsOf, routeConnector } from "../geometry";
import { Icon, ShapeIcon } from "./icons";

type Menu = "color" | "shape" | "text" | "from" | "to" | "route" | "align" | "more" | "comments" | "link" | null;

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
  { value: "sticky", label: "Nota adesiva" },
];

const ALIGN_ICONS = [
  { key: "left", label: "Alinhar à esquerda" },
  { key: "center", label: "Centralizar horizontalmente" },
  { key: "right", label: "Alinhar à direita" },
  { key: "top", label: "Alinhar ao topo" },
  { key: "middle", label: "Centralizar verticalmente" },
  { key: "bottom", label: "Alinhar à base" },
] as const;

export function ContextBar() {
  const selection = useStore((s) => s.selection);
  const board = useStore((s) => s.board);
  const camera = useStore((s) => s.camera);
  const editingId = useStore((s) => s.editingId);
  const presentation = useStore((s) => s.presentation);
  const settings = useStore((s) => s.settings);

  const setStyleForSelection = useStore((s) => s.setStyleForSelection);
  const setTextStyleForSelection = useStore((s) => s.setTextStyleForSelection);
  const updateObject = useStore((s) => s.updateObject);
  const setEditing = useStore((s) => s.setEditing);
  const deleteSelection = useStore((s) => s.deleteSelection);
  const duplicateSelection = useStore((s) => s.duplicateSelection);
  const bringToFront = useStore((s) => s.bringToFront);
  const sendToBack = useStore((s) => s.sendToBack);
  const rotateSelection = useStore((s) => s.rotateSelection);
  const swapEndpoints = useStore((s) => s.swapEndpoints);
  const applyConnectorDefaults = useStore((s) => s.applyConnectorDefaults);
  const groupSelection = useStore((s) => s.groupSelection);
  const ungroupSelection = useStore((s) => s.ungroupSelection);
  const toggleHidden = useStore((s) => s.toggleHidden);
  const toggleLocked = useStore((s) => s.toggleLocked);
  const setLink = useStore((s) => s.setLink);
  const addComment = useStore((s) => s.addComment);
  const resolveComment = useStore((s) => s.resolveComment);
  const deleteComment = useStore((s) => s.deleteComment);
  const frameToContents = useStore((s) => s.frameToContents);
  const alignSelection = useStore((s) => s.alignSelection);
  const distributeSelection = useStore((s) => s.distributeSelection);

  const [menu, setMenu] = useState<{ name: Menu; x: number } | null>(null);
  const [customColor, setCustomColor] = useState("#8b3fd9");
  const [commentText, setCommentText] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const key = selection.join(",");
  useEffect(() => {
    setMenu(null);
    setCommentText("");
  }, [key]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menu]);

  const target = selection.length ? board.objects[selection[0]] : null;
  const shape = target && isShape(target) ? target : null;
  const connector = target && isConnector(target) ? target : null;
  const frame = target && isFrame(target) ? target : null;
  const textCapable = target && hasText(target) ? target : null;
  const textStyle = textCapable?.textStyle;
  const styleObj = target && "style" in target ? target.style : null;
  const multi = selection.length > 1;

  const screenPos = useMemo(() => {
    const selected = selection
      .map((id) => board.objects[id])
      .filter(
        (o): o is Shape | Frame | TextObject | ImageObject | IconObject =>
          !!o && o.objectType !== "connector" && "rect" in o,
      );
    if (selected.length) {
      const b = boundsOf(selected.map((o) => aabbOfRect(o.rect, o.rotation ?? 0)));
      return {
        x: (b.x + b.w / 2) * camera.zoom + camera.x,
        y: b.y * camera.zoom + camera.y,
      };
    }
    if (connector) {
      const fr = board.objects[connector.fromId];
      const tr = board.objects[connector.toId];
      const fromRect = fr && fr.objectType !== "connector" && "rect" in fr ? aabbOfRect(fr.rect, fr.rotation ?? 0) : null;
      const toRect = tr && tr.objectType !== "connector" && "rect" in tr ? aabbOfRect(tr.rect, tr.rotation ?? 0) : null;
      const route = routeConnector(connector, fromRect, toRect);
      return { x: route.mid.x * camera.zoom + camera.x, y: route.mid.y * camera.zoom + camera.y - 10 };
    }
    return null;
  }, [selection, board.objects, camera, connector]);

  if (!selection.length || !screenPos || editingId || presentation) return null;

  const toggle = (name: Menu, e: React.MouseEvent) => {
    if (name === "link") setLinkValue(target?.link ?? "");
    const x = (e.currentTarget as HTMLElement).offsetLeft;
    setMenu((m) => (m && m.name === name ? null : { name, x }));
  };

  const BarButton = ({
    icon,
    label,
    active,
    onClick,
    menuName,
    disabled,
  }: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    menuName?: Menu;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      className={`ctx-btn ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        if (menuName) toggle(menuName, e);
        else onClick?.();
      }}
    >
      {icon}
    </button>
  );

  const applyStyle = (patch: { color?: Color; deco?: Deco; hex?: string }) => {
    setStyleForSelection(patch);
  };

  const applyText = (patch: Partial<TextStyle>) => {
    setTextStyleForSelection(patch);
  };

  const comments = target?.comments ?? [];
  const unresolved = comments.filter((c) => !c.resolved).length;
  const canvasWidth = document.querySelector(".canvas-container")?.clientWidth ?? window.innerWidth;
  const menuX = Math.min(Math.max(0, (menu?.x ?? 0) - 90), Math.max(0, canvasWidth - 340));
  const popoverBelow = screenPos.y < 340;
  const halfBar = Math.min(230, canvasWidth / 2);
  const left = Math.min(Math.max(halfBar, screenPos.x), Math.max(halfBar, canvasWidth - halfBar));
  const top = Math.max(72, screenPos.y);

  return (
    <div ref={wrapRef} className="ctxbar-wrap" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ctxbar" role="toolbar" aria-label="Opções do objeto">
        {textCapable ? <BarButton icon={<Icon name="text" />} label="Editar texto" onClick={() => setEditing(target!.id)} /> : null}

        {shape ? (
          <>
            <Sep />
            <BarButton icon={<ShapeIcon type={shape.shapeType} />} label="Mudar forma" menuName="shape" />
          </>
        ) : null}

        {styleObj ? (
          <>
            <Sep />
            <BarButton
              icon={
                <span className="ctx-color-dot" style={{ background: styleObj.hex ?? colorToken(styleObj.color).base }} />
              }
              label="Cor"
              menuName="color"
            />
            {target && !isIcon(target) ? (
              <Segmented value={styleObj.deco} onChange={(d) => applyStyle({ deco: d })} connector={!!connector} />
            ) : null}
          </>
        ) : null}

        {textCapable ? (
          <>
            <Sep />
            <BarButton icon={<Icon name="type" />} label="Tipografia" menuName="text" />
          </>
        ) : null}

        {connector ? (
          <>
            <Sep />
            <BarButton icon={<Icon name="arrowRight" />} label="Ponta inicial" menuName="from" />
            <BarButton icon={<Icon name="swap" />} label="Inverter pontas" onClick={() => swapEndpoints(connector.id)} />
            <BarButton icon={<Icon name="arrowLeft" />} label="Ponta final" menuName="to" />
            <BarButton icon={<Icon name="connector" />} label="Rota" menuName="route" />
            <BarButton icon={<Icon name="star" />} label="Aplicar aos próximos" onClick={() => applyConnectorDefaults(connector.id)} />
          </>
        ) : null}

        {frame ? (
          <>
            <Sep />
            <BarButton icon={<Icon name="fit" />} label="Ajustar frame ao conteúdo" onClick={() => frameToContents(frame.id)} />
          </>
        ) : null}

        {multi ? (
          <>
            <Sep />
            <BarButton icon={<Icon name="layout" />} label="Alinhar e distribuir" menuName="align" />
            <BarButton icon={<Icon name="group" />} label="Agrupar" onClick={groupSelection} />
            <BarButton icon={<Icon name="ungroup" />} label="Desagrupar" onClick={ungroupSelection} />
          </>
        ) : null}

        <Sep />
        <BarButton icon={<Icon name="rotate" />} label="Rotacionar 90°" onClick={rotateSelection} disabled={!!connector} />
        <BarButton icon={<Icon name="copy" />} label="Duplicar (Ctrl+D)" onClick={duplicateSelection} />
        <BarButton
          icon={
            <span className="ctx-comment">
              <Icon name="comment" />
              {unresolved > 0 ? <b>{unresolved}</b> : null}
            </span>
          }
          label="Comentários"
          menuName="comments"
        />
        <BarButton
          icon={<span className="ctx-more-dots">•••</span>}
          label="Mais opções"
          menuName="more"
        />
      </div>

      {menu?.name === "color" ? (
        <Popover x={menuX} below={popoverBelow}>
          <div className="ctx-pop-title">Cor</div>
          <div className="ctx-swatches">
            {COLORS.map((c) => (
              <button
                key={c.name}
                className={`ctx-swatch ${!styleObj?.hex && styleObj?.color === c.name ? "active" : ""}`}
                title={c.label}
                style={{ background: c.base }}
                onClick={() => applyStyle({ color: c.name, hex: undefined })}
              />
            ))}
            <label className="ctx-swatch custom" title="Cor personalizada" style={{ background: customColor }}>
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  applyStyle({ hex: e.target.value });
                }}
              />
            </label>
          </div>
        </Popover>
      ) : null}

      {menu?.name === "shape" && shape ? (
        <Popover x={menuX} below={popoverBelow}>
          <div className="ctx-pop-title">Forma</div>
          <div className="ctx-shape-grid">
            {SHAPES.map((s) => (
              <button
                key={s.value}
                className={`ctx-shape ${shape.shapeType === s.value ? "active" : ""}`}
                title={s.label}
                onClick={() => updateObject(shape.id, { shapeType: s.value } as never)}
              >
                <ShapeIcon type={s.value} />
              </button>
            ))}
          </div>
        </Popover>
      ) : null}

      {menu?.name === "text" && textStyle ? (
        <Popover x={menuX} below={popoverBelow}>
          <div className="ctx-pop-title">Tipografia</div>
          <div className="ctx-row">
            <button
              className="ctx-cell"
              title="Diminuir fonte"
              onClick={() => applyText({ fontSize: Math.max(8, textStyle.fontSize - 2) })}
            >
              <Icon name="minus" />
            </button>
            <span className="ctx-size">{textStyle.fontSize}px</span>
            <button
              className="ctx-cell"
              title="Aumentar fonte"
              onClick={() => applyText({ fontSize: Math.min(96, textStyle.fontSize + 2) })}
            >
              <Icon name="plus" />
            </button>
          </div>
          <div className="ctx-row">
            <button
              className={`ctx-cell ${textStyle.fontWeight >= 600 ? "active" : ""}`}
              title="Negrito"
              onClick={() => applyText({ fontWeight: textStyle.fontWeight >= 600 ? 400 : 700 })}
            >
              <Icon name="bold" />
            </button>
            <button
              className={`ctx-cell ${textStyle.italic ? "active" : ""}`}
              title="Itálico"
              onClick={() => applyText({ italic: !textStyle.italic })}
            >
              <Icon name="italic" />
            </button>
            <button
              className={`ctx-cell ${textStyle.underline ? "active" : ""}`}
              title="Sublinhado"
              onClick={() => applyText({ underline: !textStyle.underline })}
            >
              <Icon name="underline" />
            </button>
          </div>
          <div className="ctx-pop-label">Alinhamento</div>
          <div className="ctx-row">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                className={`ctx-cell ${textStyle.align === a ? "active" : ""}`}
                title={a === "left" ? "Esquerda" : a === "center" ? "Centro" : "Direita"}
                onClick={() => applyText({ align: a })}
              >
                <Icon name={a === "left" ? "alignLeft" : a === "center" ? "alignCenter" : "alignRight"} />
              </button>
            ))}
          </div>
        </Popover>
      ) : null}

      {(menu?.name === "from" || menu?.name === "to") && connector ? (
        <Popover x={menuX} below={popoverBelow}>
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
                    updateObject(
                      connector.id,
                      { [menu.name === "from" ? "fromCardinality" : "toCardinality"]: cur === c.value ? null : c.value } as never,
                    )
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
                    updateObject(
                      connector.id,
                      { [menu.name === "from" ? "fromEndpoint" : "toEndpoint"]: cur === m.value ? "none" : m.value } as never,
                    )
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
        <Popover x={menuX} below={popoverBelow}>
          <div className="ctx-pop-title">Rota</div>
          <div className="ctx-list">
            {(["elbow", "straight", "curved"] as const).map((t) => (
              <button
                key={t}
                className={`ctx-list-item ${connector.connectorType === t ? "active" : ""}`}
                onClick={() => updateObject(connector.id, { connectorType: t } as never)}
              >
                {t === "elbow" ? "Ortogonal" : t === "straight" ? "Reta" : "Curva"}
              </button>
            ))}
          </div>
        </Popover>
      ) : null}

      {menu?.name === "align" ? (
        <Popover x={menuX} below={popoverBelow}>
          <div className="ctx-pop-title">Alinhar</div>
          <div className="ctx-row">
            {ALIGN_ICONS.map((a) => (
              <button key={a.key} className="ctx-cell" title={a.label} onClick={() => alignSelection(a.key)}>
                <Icon
                  name={
                    a.key === "left"
                      ? "alignLeft"
                      : a.key === "center"
                        ? "alignCenter"
                        : a.key === "right"
                          ? "alignRight"
                          : a.key === "top"
                            ? "chevronUp"
                            : a.key === "middle"
                              ? "alignCenter"
                              : "chevronDown"
                  }
                />
              </button>
            ))}
          </div>
          <div className="ctx-pop-label">Distribuir</div>
          <div className="ctx-row">
            <button className="ctx-cell wide" onClick={() => distributeSelection("h")}>
              Horizontal
            </button>
            <button className="ctx-cell wide" onClick={() => distributeSelection("v")}>
              Vertical
            </button>
          </div>
        </Popover>
      ) : null}

      {menu?.name === "more" ? (
        <Popover x={menuX} below={popoverBelow}>
          <div className="ctx-list">
            <button className="ctx-list-item" onClick={bringToFront}>
              Trazer para frente
            </button>
            <button className="ctx-list-item" onClick={sendToBack}>
              Enviar para trás
            </button>
            <button className="ctx-list-item" onClick={() => toggleLocked()}>
              {target?.locked ? "Desbloquear" : "Bloquear"}
            </button>
            <button className="ctx-list-item" onClick={() => toggleHidden()}>
              {target?.hidden ? "Mostrar" : "Ocultar"}
            </button>
            <button className="ctx-list-item" onClick={() => setMenu({ name: "link", x: menu.x })}>
              Adicionar link
            </button>
            <button className="ctx-list-item danger" onClick={deleteSelection}>
              Excluir
            </button>
          </div>
        </Popover>
      ) : null}

      {menu?.name === "link" ? (
        <Popover x={menuX} below={popoverBelow}>
          <div className="ctx-pop-title">Link</div>
          <div className="ctx-link-row">
            <input
              value={linkValue}
              placeholder="https://…"
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setLink(target!.id, linkValue);
                  setMenu(null);
                }
              }}
            />
            <button
              className="ctx-cell"
              title="Aplicar"
              onClick={() => {
                setLink(target!.id, linkValue);
                setMenu(null);
              }}
            >
              <Icon name="check" />
            </button>
          </div>
          {target?.link ? (
            <a className="ctx-open-link" href={target.link} target="_blank" rel="noreferrer">
              Abrir link ↗
            </a>
          ) : null}
        </Popover>
      ) : null}

      {menu?.name === "comments" && target ? (
        <Popover x={menuX} wide below={popoverBelow}>
          <div className="ctx-pop-title">Comentários</div>
          <div className="comments-list">
            {comments.length === 0 ? <div className="comments-empty">Nenhum comentário ainda.</div> : null}
            {comments.map((c) => (
              <div key={c.id} className={`comment-item ${c.resolved ? "resolved" : ""}`}>
                <div className="comment-head">
                  <b>{c.author}</b>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <p>{c.text}</p>
                <div className="comment-actions">
                  <button onClick={() => resolveComment(target.id, c.id)}>{c.resolved ? "Reabrir" : "Resolver"}</button>
                  <button className="danger" onClick={() => deleteComment(target.id, c.id)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="comment-input">
            <input
              value={commentText}
              placeholder={`Comentar como ${settings.userName}`}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && commentText.trim()) {
                  addComment(target.id, commentText);
                  setCommentText("");
                }
              }}
            />
            <button
              className="ctx-cell"
              title="Comentar"
              onClick={() => {
                if (commentText.trim()) {
                  addComment(target.id, commentText);
                  setCommentText("");
                }
              }}
            >
              <Icon name="plus" />
            </button>
          </div>
        </Popover>
      ) : null}

      {connector ? (
        <div className="ctx-subhint">
          {connector.label ? `“${connector.label}”` : "Duplo clique para rotular"}
        </div>
      ) : null}
    </div>
  );
}

function Sep() {
  return <span className="ctx-sep" />;
}

function Popover({
  x,
  children,
  wide,
  below,
}: {
  x: number;
  children: React.ReactNode;
  wide?: boolean;
  below?: boolean;
}) {
  return (
    <div className={`ctx-popover ${wide ? "wide" : ""} ${below ? "below" : ""}`} style={{ left: x }}>
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

function DecoGlyph({ value }: { value: Deco }) {
  if (value === "fill")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" />
      </svg>
    );
  if (value === "dash")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" strokeDasharray="3 2" />
      </svg>
    );
  if (value === "transparent")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" />
        <path d="M2 8h12M8 2v12" strokeOpacity="0.4" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CardinalityGlyph({ value }: { value: Exclude<Cardinality, null> }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" as const };
  const many = value === "zero-or-many" || value === "one-or-many";
  const zero = value === "zero-or-one" || value === "zero-or-many";
  return (
    <svg width="26" height="18" viewBox="0 0 26 18">
      <path d="M3 9h20" {...s} />
      {zero ? <circle cx="20" cy="9" r="3" {...s} /> : <path d="M20 5v8" {...s} />}
      {many ? (
        <>
          <path d="M4 9L9 5" {...s} />
          <path d="M4 9L9 13" {...s} />
        </>
      ) : null}
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
      {value === "fork" ? (
        <>
          <path d="M20 9L24 5" {...s} />
          <path d="M20 9L24 13" {...s} />
          <path d="M20 9h4" {...s} />
        </>
      ) : null}
    </svg>
  );
}
