import type { ReactNode } from "react";
import { useStore } from "../store";

type Edge = "left" | "center" | "right" | "top" | "middle" | "bottom";

function svg(children: ReactNode) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICONS: Record<Edge | "distH" | "distV", ReactNode> = {
  left: svg(<><path d="M3 3v14" /><rect x="6" y="5" width="10" height="4" rx="1" /><rect x="6" y="12" width="6" height="4" rx="1" /></>),
  center: svg(<><path d="M10 3v14" /><rect x="5" y="5" width="10" height="4" rx="1" /><rect x="7" y="12" width="6" height="4" rx="1" /></>),
  right: svg(<><path d="M17 3v14" /><rect x="4" y="5" width="10" height="4" rx="1" /><rect x="8" y="12" width="6" height="4" rx="1" /></>),
  top: svg(<><path d="M3 3h14" /><rect x="5" y="6" width="4" height="10" rx="1" /><rect x="12" y="6" width="4" height="6" rx="1" /></>),
  middle: svg(<><path d="M3 10h14" /><rect x="5" y="5" width="4" height="10" rx="1" /><rect x="12" y="7" width="4" height="6" rx="1" /></>),
  bottom: svg(<><path d="M3 17h14" /><rect x="5" y="4" width="4" height="10" rx="1" /><rect x="12" y="8" width="4" height="6" rx="1" /></>),
  distH: svg(<><rect x="3" y="6" width="4" height="8" rx="1" /><rect x="8" y="6" width="4" height="8" rx="1" /><rect x="13" y="6" width="4" height="8" rx="1" /></>),
  distV: svg(<><rect x="6" y="3" width="8" height="4" rx="1" /><rect x="6" y="8" width="8" height="4" rx="1" /><rect x="6" y="13" width="8" height="4" rx="1" /></>),
};

const BUTTONS: { key: Edge | "distH" | "distV"; label: string }[] = [
  { key: "left", label: "Alinhar à esquerda" },
  { key: "center", label: "Centralizar horizontalmente" },
  { key: "right", label: "Alinhar à direita" },
  { key: "top", label: "Alinhar ao topo" },
  { key: "middle", label: "Centralizar verticalmente" },
  { key: "bottom", label: "Alinhar à base" },
  { key: "distH", label: "Distribuir horizontalmente" },
  { key: "distV", label: "Distribuir verticalmente" },
];

export function AlignBar() {
  const selection = useStore((s) => s.selection);
  const alignSelection = useStore((s) => s.alignSelection);
  const distributeSelection = useStore((s) => s.distributeSelection);
  const deleteSelection = useStore((s) => s.deleteSelection);

  if (selection.length < 2) return null;

  return (
    <div className="align-bar">
      <span className="align-count">{selection.length}</span>
      {BUTTONS.map((b) => (
        <button
          key={b.key}
          className="align-btn"
          title={b.label}
          onClick={() => {
            if (b.key === "distH") distributeSelection("h");
            else if (b.key === "distV") distributeSelection("v");
            else alignSelection(b.key);
          }}
        >
          {ICONS[b.key]}
        </button>
      ))}
      <span className="ctx-sep" />
      <button className="align-btn danger" title="Excluir" onClick={deleteSelection}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
        </svg>
      </button>
    </div>
  );
}
