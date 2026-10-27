import { describe, expect, it } from "vitest";
import { stageLayout, stageToWorld } from "../src/Stage.tsx";

const vp = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5, unit: "" };

describe("stageLayout", () => {
  it("mantém a cena inteira em telas largas", () => {
    const L = stageLayout(vp, 900, 520, 0.5);
    expect(L.panes).toHaveLength(1);
  });

  it("empilha os dois painéis em telas estreitas e aumenta a escala", () => {
    const wide = stageLayout(vp, 360, 520);
    const L = stageLayout(vp, 360, 520, 0.5);
    expect(L.panes).toHaveLength(2);
    expect(L.scale).toBeGreaterThan(1.8 * wide.scale);
    expect(L.panes[1]!.oy).toBeGreaterThan(L.panes[0]!.oy + 19 * L.scale);
    expect(L.cssH).toBeGreaterThan(wide.cssH);
  });

  it("não empilha cenas com eixos nem cortes fora da cena", () => {
    expect(stageLayout({ ...vp, unit: "m" }, 360, 520, 0.5).panes).toHaveLength(1);
    expect(stageLayout(vp, 360, 520, 1.2).panes).toHaveLength(1);
  });

  it("converte o ponteiro pela faixa que ele toca", () => {
    const L = stageLayout(vp, 360, 520, 0.5);
    const [a, b] = L.panes;
    const top = stageToWorld(L, a!.ox + 2 * L.scale, a!.oy + 1 * L.scale);
    expect(top.x).toBeCloseTo(-15);
    expect(top.y).toBeCloseTo(8.5);
    const bottom = stageToWorld(L, b!.ox + 3 * L.scale, b!.oy + 19 * L.scale);
    expect(bottom.x).toBeCloseTo(3);
    expect(bottom.y).toBeCloseTo(-9.5);
    const one = stageLayout(vp, 900, 520);
    const p = stageToWorld(one, one.panes[0]!.ox + 17 * one.scale, one.panes[0]!.oy + 9.5 * one.scale);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });
});

describe("stageLayout em cenas pouco largas", () => {
  it("não corta uma cena quase quadrada", () => {
    expect(stageLayout({ xMin: 0, xMax: 12, yMin: 0, yMax: 10 }, 360, 520, 0.5).panes).toHaveLength(1);
  });
});
