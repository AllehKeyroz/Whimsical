import { useEffect, useMemo, useRef, useState } from "react";
import type { Frame, Shape, TextObject, TextStyle } from "../types";
import { aabbOfRect } from "../geometry";
import { useStore } from "../store";
import { wrapText } from "../lib/text";
import { colorToken, shapePaint } from "../palette";

interface Props {
  object: Shape | Frame | TextObject;
  zoom: number;
  toScreen: (p: { x: number; y: number }) => { x: number; y: number };
}

function textInset(object: Shape | Frame | TextObject): { ix: number; iy: number } {
  if (object.objectType !== "shape") return { ix: 0, iy: 0 };
  switch (object.shapeType) {
    case "diamond":
      return { ix: object.rect.w * 0.2, iy: object.rect.h * 0.2 };
    case "ellipse":
      return { ix: object.rect.w * 0.12, iy: object.rect.h * 0.12 };
    case "triangle":
      return { ix: object.rect.w * 0.25, iy: object.rect.h * 0.3 };
    case "hexagon":
      return { ix: object.rect.w * 0.16, iy: object.rect.h * 0.1 };
    case "sticky":
      return { ix: 8, iy: 8 };
    default:
      return { ix: 10, iy: 8 };
  }
}

export function TextEditor({ object, zoom, toScreen }: Props) {
  const setText = useStore((s) => s.setText);
  const setEditing = useStore((s) => s.setEditing);
  const pushHistory = useStore((s) => s.pushHistory);
  const board = useStore((s) => s.board);
  const addMindChild = useStore((s) => s.addMindChild);
  const addMindSibling = useStore((s) => s.addMindSibling);
  const [value, setValue] = useState(object.text);
  const historyPushed = useRef(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const textStyle: TextStyle = object.textStyle ?? {
    fontSize: 18,
    fontWeight: 400,
    italic: false,
    underline: false,
    align: object.objectType === "text" ? "left" : "center",
  };
  const fs = textStyle.fontSize;

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const geom = useMemo(() => {
    const box = aabbOfRect(object.rect, object.rotation ?? 0);
    const p = toScreen({ x: box.x, y: box.y });
    const inset = textInset(object);
    const isFrame = object.objectType === "frame";
    if (isFrame) {
      return {
        left: p.x,
        top: Math.max(4, p.y - 30 * zoom),
        width: Math.max(140, box.w * zoom),
        height: 26 * zoom,
        padTop: 2 * zoom,
        fs: Math.max(9, fs * zoom),
        maxWidth: Math.max(40, object.rect.w - 4),
      };
    }
    const width = Math.max(32, (object.rect.w - inset.ix * 2) * zoom);
    const height = Math.max(24, (object.rect.h - inset.iy * 2) * zoom);
    const fontPx = Math.max(9, fs * zoom);
    const lines = wrapText(object.text || " ", Math.max(20, object.rect.w - inset.ix * 2), fs, {
      bold: textStyle.fontWeight >= 600,
    });
    const contentH = lines.length * fs * 1.3;
    const padTop = Math.max(2, ((object.rect.h - contentH) / 2 - inset.iy) * zoom);
    return {
      left: p.x + inset.ix * zoom,
      top: p.y + inset.iy * zoom,
      width,
      height,
      padTop,
      fs: fontPx,
      maxWidth: Math.max(20, object.rect.w - inset.ix * 2),
    };
  }, [object, zoom, toScreen, fs, textStyle.fontWeight]);

  const color =
    textStyle.color ??
    (object.objectType === "text"
      ? object.style.hex ??
        (object.style.deco === "fill"
          ? colorToken(object.style.color).onStrong
          : object.style.color !== "gray"
            ? colorToken(object.style.color).base
            : "var(--canvas-text)")
      : object.objectType === "frame"
        ? object.style.hex ?? colorToken(object.style.color).base
        : shapePaint(object.style).fill === "none"
          ? "var(--canvas-text)"
          : shapePaint(object.style).text);

  return (
    <textarea
      ref={ref}
      className="text-editor"
      value={value}
      onChange={(e) => {
        if (!historyPushed.current) {
          pushHistory();
          historyPushed.current = true;
        }
        setValue(e.target.value);
        setText(object.id, e.target.value);
      }}
      onBlur={() => {
        if (useStore.getState().editingId === object.id) setEditing(null);
      }}
      onKeyDown={(e) => {
        if (board.mindMap && object.objectType === "text") {
          if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            setText(object.id, value);
            const id = addMindSibling(object.id);
            if (id) setEditing(id);
            return;
          }
          if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            setText(object.id, value);
            const id = addMindChild(object.id);
            if (id) setEditing(id);
            return;
          }
        }
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          e.stopPropagation();
          setText(object.id, value);
          setEditing(null);
        }
      }}
      style={{
        left: geom.left,
        top: geom.top,
        width: geom.width,
        height: geom.height,
        paddingTop: geom.padTop,
        paddingBottom: 0,
        paddingLeft: 2,
        paddingRight: 2,
        fontSize: geom.fs,
        lineHeight: 1.3,
        fontWeight: textStyle.fontWeight,
        fontStyle: textStyle.italic ? "italic" : "normal",
        textDecoration: textStyle.underline ? "underline" : "none",
        textAlign: textStyle.align,
        color,
      }}
    />
  );
}
