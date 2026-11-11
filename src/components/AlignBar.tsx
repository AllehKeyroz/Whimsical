import { useStore } from "../store";
import { Icon, type IconName } from "./icons";

const BUTTONS: { key: "left" | "center" | "right" | "top" | "middle" | "bottom" | "distH" | "distV"; label: string; icon: IconName }[] = [
  { key: "left", label: "Alinhar à esquerda", icon: "alignLeft" },
  { key: "center", label: "Centralizar horizontalmente", icon: "alignCenter" },
  { key: "right", label: "Alinhar à direita", icon: "alignRight" },
  { key: "top", label: "Alinhar ao topo", icon: "chevronUp" },
  { key: "middle", label: "Centralizar verticalmente", icon: "alignCenter" },
  { key: "bottom", label: "Alinhar à base", icon: "chevronDown" },
  { key: "distH", label: "Distribuir horizontalmente", icon: "fitWidth" },
  { key: "distV", label: "Distribuir verticalmente", icon: "layout" },
];

export function AlignBar() {
  const selection = useStore((s) => s.selection);
  const board = useStore((s) => s.board);
  const presentation = useStore((s) => s.presentation);
  const alignSelection = useStore((s) => s.alignSelection);
  const distributeSelection = useStore((s) => s.distributeSelection);
  const deleteSelection = useStore((s) => s.deleteSelection);
  const duplicateSelection = useStore((s) => s.duplicateSelection);
  const groupSelection = useStore((s) => s.groupSelection);
  const ungroupSelection = useStore((s) => s.ungroupSelection);

  const count = selection.filter((id) => {
    const o = board.objects[id];
    return o && o.objectType !== "connector";
  }).length;

  if (count < 2 || presentation) return null;

  return (
    <div className="align-bar">
      <span className="align-count">{count}</span>
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
          <Icon name={b.icon} size={17} />
        </button>
      ))}
      <span className="ctx-sep" />
      <button className="align-btn" title="Agrupar (Ctrl+G)" onClick={groupSelection}>
        <Icon name="group" size={17} />
      </button>
      <button className="align-btn" title="Desagrupar (Ctrl+Shift+G)" onClick={ungroupSelection}>
        <Icon name="ungroup" size={17} />
      </button>
      <button className="align-btn" title="Duplicar (Ctrl+D)" onClick={duplicateSelection}>
        <Icon name="copy" size={17} />
      </button>
      <span className="ctx-sep" />
      <button className="align-btn danger" title="Excluir" onClick={deleteSelection}>
        <Icon name="trash" size={17} />
      </button>
    </div>
  );
}
