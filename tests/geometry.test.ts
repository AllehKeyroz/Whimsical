import { describe, expect, it } from "vitest";
import { aabbOfRect, computeSnap, pointInRectRotated, rotatePoint, routeConnector, snapAnchor } from "../src/geometry";
import type { Connector, Rect } from "../src/types";

function connector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "c1",
    objectType: "connector",
    parentId: null,
    order: 1,
    fromId: "a",
    toId: "b",
    connectorType: "elbow",
    fromRel: { rx: 1, ry: 0.5, axis: "x" },
    toRel: { rx: 0, ry: 0.5, axis: "x" },
    fromEndpoint: "none",
    toEndpoint: "arrow",
    fromCardinality: null,
    toCardinality: null,
    style: { color: "gray", deco: "outline" },
    label: "",
    ...overrides,
  };
}

describe("geometry", () => {
  it("rotaciona um ponto ao redor do centro", () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });

  it("calcula a AABB de um retângulo rotacionado", () => {
    const r: Rect = { x: 0, y: 0, w: 100, h: 40 };
    const b = aabbOfRect(r, 90);
    expect(b.x).toBeCloseTo(30);
    expect(b.w).toBeCloseTo(40);
    expect(b.h).toBeCloseTo(100);
  });

  it("detecta ponto em retângulo rotacionado", () => {
    const r: Rect = { x: 0, y: 0, w: 100, h: 40 };
    expect(pointInRectRotated({ x: 50, y: 20 }, r, 0)).toBe(true);
    expect(pointInRectRotated({ x: 50, y: 20 }, r, 90)).toBe(true);
    expect(pointInRectRotated({ x: 120, y: 0 }, r, 0)).toBe(false);
  });

  it("escolhe âncoras laterais/inferiores de acordo com a posição", () => {
    const r: Rect = { x: 0, y: 0, w: 100, h: 100 };
    expect(snapAnchor(r, { x: 300, y: 50 }).axis).toBe("x");
    expect(snapAnchor(r, { x: 50, y: 300 }).axis).toBe("y");
  });

  it("roteia um conector ortogonal entre dois retângulos", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 60 };
    const b: Rect = { x: 300, y: 220, w: 100, h: 60 };
    const route = routeConnector(connector(), a, b);
    expect(route.points.length).toBeGreaterThanOrEqual(2);
    expect(route.d.trim().startsWith("M")).toBe(true);
    expect(route.mid).toBeTruthy();
  });

  it("mantém o roteamento dentro de limites razoáveis com obstáculo", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 60 };
    const b: Rect = { x: 300, y: 0, w: 100, h: 60 };
    const obstacle: Rect = { x: 150, y: -20, w: 60, h: 100 };
    const route = routeConnector(connector(), a, b, [obstacle]);
    expect(route.points.length).toBeGreaterThanOrEqual(3);
  });

  it("faz snap de borda com outros objetos", () => {
    const snap = computeSnap(
      { x: 105, y: 100, w: 100, h: 60 },
      [{ x: 100, y: 0, w: 200, h: 40 }],
      { zoom: 1, grid: false, snap: true },
    );
    expect(snap.dx).toBeCloseTo(-5);
    expect(snap.guides.length).toBeGreaterThan(0);
  });

  it("faz snap ao grid quando habilitado", () => {
    const snap = computeSnap({ x: 22, y: 24, w: 100, h: 60 }, [], { zoom: 1, grid: true, snap: true, gridSize: 24 });
    expect(snap.dx).toBeCloseTo(2);
  });
});
