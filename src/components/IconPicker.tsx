import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { Modal } from "./Modals";
import { Icon } from "./icons";
import {
  EMOJI_GROUPS,
  ICON_CATEGORIES,
  getLoadedIconLibrary,
  iconLabel,
  loadIconLibrary,
  type IconMap,
  type IconNode,
} from "../lib/iconLibrary";

const COLOR_CHOICES = ["#8b3fd9", "#2484d4", "#26aea0", "#E8833A", "#D3455B", "#e6b725", "#ffffff", "#2e3c4a"];
const SIZES = [48, 64, 96, 128, 160];

interface BrandIcon {
  id: string;
  title: string;
  category: string;
  viewBox: string;
  svg: string;
  plate?: string;
}

interface BrandPack {
  id: string;
  title: string;
  license: string;
  attribution: string;
  icons: BrandIcon[];
}

interface BrandPackMeta {
  id: string;
  title: string;
  license: string;
  attribution: string;
  count: number;
}

function svgUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function Glyph({ node, size = 22, color = "currentColor" }: { node: IconNode; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {node.map(([tag, attrs], i) => createElement(tag, { ...attrs, key: i }))}
    </svg>
  );
}

export function IconPicker() {
  const open = useStore((s) => s.iconPickerOpen);
  const setOpen = useStore((s) => s.setIconPickerOpen);
  const addIconAtCenter = useStore((s) => s.addIconAtCenter);
  const addSvgIconAtCenter = useStore((s) => s.addSvgIconAtCenter);
  const [icons, setIcons] = useState<IconMap | null>(getLoadedIconLibrary());
  const [tab, setTab] = useState<"icons" | "brands" | "emoji">("icons");
  const [packs, setPacks] = useState<BrandPackMeta[] | null>(null);
  const [packId, setPackId] = useState("logos");
  const [packData, setPackData] = useState<Record<string, BrandPack>>({});
  const [brandError, setBrandError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [size, setSize] = useState(96);
  const [customEmoji, setCustomEmoji] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    window.setTimeout(() => inputRef.current?.focus(), 30);
    const cached = getLoadedIconLibrary();
    if (cached) setIcons(cached);
    else void loadIconLibrary().then(setIcons);
  }, [open]);

  const names = useMemo(() => (icons ? Object.keys(icons).sort((a, b) => a.localeCompare(b)) : []), [icons]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = names;
    if (category !== "all") {
      const cat = ICON_CATEGORIES.find((c) => c.id === category);
      if (cat?.match) list = list.filter((n) => cat.match!.test(n));
    }
    if (q) list = list.filter((n) => n.toLowerCase().includes(q) || iconLabel(n).toLowerCase().includes(q));
    return list;
  }, [names, query, category]);
  const visible = filtered.slice(0, 320);
  const emojis = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EMOJI_GROUPS;
    return EMOJI_GROUPS.map((g) => ({ ...g, emojis: g.emojis.filter((e) => e.includes(q)) })).filter((g) => g.emojis.length);
  }, [query]);

  useEffect(() => {
    if (!open || packs) return;
    let alive = true;
    fetch("/brand-icons/index.json")
      .then((res) => {
        if (!res.ok) throw new Error("missing");
        return res.json();
      })
      .then((data: { packs: BrandPackMeta[] }) => {
        if (alive) setPacks(data.packs);
      })
      .catch(() => {
        if (alive) setBrandError("Pacotes de marcas não encontrados. Rode `npm run icons:packs`.");
      });
    return () => {
      alive = false;
    };
  }, [open, packs]);

  useEffect(() => {
    if (!open || tab !== "brands" || packData[packId]) return;
    let alive = true;
    setBrandError(null);
    fetch(`/brand-icons/${packId}.json`)
      .then((res) => {
        if (!res.ok) throw new Error("missing");
        return res.json();
      })
      .then((data: BrandPack) => {
        if (alive) setPackData((prev) => ({ ...prev, [packId]: data }));
      })
      .catch(() => {
        if (alive) setBrandError("Não foi possível carregar este pacote de ícones.");
      });
    return () => {
      alive = false;
    };
  }, [open, tab, packId, packData]);

  const activePack = packData[packId] ?? null;
  const brandIcons = useMemo(() => {
    if (!activePack) return [];
    const q = query.trim().toLowerCase();
    return activePack.icons
      .filter((i) => !q || i.title.toLowerCase().includes(q) || i.id.includes(q))
      .slice(0, 240);
  }, [activePack, query]);

  const insertBrand = (icon: BrandIcon) => {
    addSvgIconAtCenter(icon.svg, icon.plate, size);
    setOpen(false);
  };

  const pick = (icon: string, iconSet: "lucide" | "emoji") => {
    addIconAtCenter(icon, iconSet, iconSet === "lucide" ? color : undefined, size);
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      title="Ícones"
      subtitle="2.300+ ícones Lucide, 1.100+ logos e ícones de cloud (AWS, Azure, Google Cloud, Kubernetes) e emojis."
      onClose={() => setOpen(false)}
      wide
      className="icon-picker-modal"
    >
      <div className="icon-picker-tabs">
        <button className={tab === "icons" ? "active" : ""} onClick={() => setTab("icons")}>
          <Icon name="sparkles" size={16} /> Ícones
        </button>
        <button className={tab === "brands" ? "active" : ""} onClick={() => setTab("brands")}>
          <Icon name="cloud" size={16} /> Marcas & Cloud
        </button>
        <button className={tab === "emoji" ? "active" : ""} onClick={() => setTab("emoji")}>
          😀 Emojis
        </button>
        <span className="spacer" />
        <label className="icon-size">
          Tamanho
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="icon-search">
        <Icon name="search" size={17} />
        <input
          ref={inputRef}
          value={query}
          placeholder={
            tab === "icons"
              ? "Buscar ícone por nome…"
              : tab === "brands"
                ? "Buscar marca, serviço ou tecnologia…"
                : "Buscar emoji…"
          }
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab === "icons" && <span>{filtered.length} resultados</span>}
        {tab === "brands" && <span>{brandIcons.length} resultados</span>}
      </div>

      {tab === "icons" ? (
        <>
          <div className="icon-categories">
            {ICON_CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={category === c.id ? "active" : ""}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          {!icons ? (
            <div className="icon-loading">Carregando biblioteca de ícones…</div>
          ) : (
            <>
              <div className="icon-grid">
                {visible.map((name) => {
                  const node = icons[name];
                  if (!node) return null;
                  return (
                    <button key={name} className="icon-tile" title={iconLabel(name)} onClick={() => pick(name, "lucide")}>
                      <Glyph node={node} size={22} color={color} />
                    </button>
                  );
                })}
              </div>
              {filtered.length > visible.length ? (
                <div className="icon-more">
                  Mostrando {visible.length} de {filtered.length}. Refine a busca para ver mais.
                </div>
              ) : null}
              <div className="icon-picker-footer">
                <span>Cor do ícone</span>
                <div className="icon-colors">
                  {COLOR_CHOICES.map((c) => (
                    <button
                      key={c}
                      className={color === c ? "active" : ""}
                      style={{ background: c }}
                      title={c}
                      onClick={() => setColor(c)}
                    />
                  ))}
                  <label className="icon-color-custom" title="Cor personalizada">
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                  </label>
                </div>
              </div>
            </>
          )}
        </>
      ) : tab === "brands" ? (
        <>
          {brandError ? <div className="icon-loading">{brandError}</div> : null}
          <div className="brand-packs">
            {(packs ?? []).map((pack) => (
              <button
                key={pack.id}
                className={packId === pack.id ? "active" : ""}
                onClick={() => {
                  setPackId(pack.id);
                  setQuery("");
                }}
              >
                {pack.title}
                <small>{pack.count}</small>
              </button>
            ))}
          </div>
          {!activePack ? (
            <div className="icon-loading">Carregando ícones…</div>
          ) : (
            <>
              <div className="brand-grid">
                {brandIcons.map((icon) => (
                  <button
                    key={icon.id}
                    className="brand-tile"
                    title={`${icon.title}${icon.category ? ` · ${icon.category}` : ""}`}
                    onClick={() => insertBrand(icon)}
                  >
                    <span className="brand-plate" style={icon.plate ? { background: icon.plate } : undefined}>
                      <img src={svgUri(icon.svg)} alt="" loading="lazy" draggable={false} />
                    </span>
                  </button>
                ))}
              </div>
              {activePack.icons.length > brandIcons.length ? (
                <div className="icon-more">
                  Mostrando {brandIcons.length} de {activePack.icons.length}. Refine a busca para ver mais.
                </div>
              ) : null}
              <div className="brand-attribution">
                {activePack.title} · {activePack.license} · {activePack.attribution}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="icon-custom-emoji">
            <input
              value={customEmoji}
              maxLength={12}
              placeholder="Cole qualquer emoji aqui…"
              onChange={(e) => setCustomEmoji(e.target.value)}
            />
            <button
              className="secondary-btn"
              disabled={!customEmoji.trim()}
              onClick={() => {
                pick(customEmoji.trim(), "emoji");
                setCustomEmoji("");
              }}
            >
              Inserir
            </button>
          </div>
          {emojis.map((group) => (
            <div key={group.id} className="emoji-group">
              <div className="emoji-group-label">{group.label}</div>
              <div className="emoji-grid">
                {group.emojis.map((emoji, i) => (
                  <button key={`${emoji}-${i}`} className="emoji-tile" title={emoji} onClick={() => pick(emoji, "emoji")}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
