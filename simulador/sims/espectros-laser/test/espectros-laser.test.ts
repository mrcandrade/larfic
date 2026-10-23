import { describe, expect, it } from "vitest";
import { Runner, rad, withOverrides } from "@fisilab/core";
import {
  GASES,
  HC_EV_NM,
  gratingAngle,
  gratingLambda,
  hydrogenNm,
  thresholdInversion,
  thresholdPump,
  transmission,
  espectrosLaser as sim,
} from "../src/index.ts";

const runLaser = (over: Record<string, number>, ms: number) => {
  const r = new Runner(sim, withOverrides(sim, { modo: 1, ...over }));
  r.runToEnd(ms);
  return r;
};

describe("Espectros e laser", () => {
  it("Balmer pelo modelo de Bohr coincide com as linhas tabeladas do H (< 0,1 %)", () => {
    const H = GASES[0]!;
    for (const [ni, line] of [[3, 0], [4, 1], [5, 2], [6, 3]] as const) {
      // tabela no ar; Bohr no vácuo (n ≈ 1,0003)
      expect(Math.abs(hydrogenNm(ni, 2) / 1.00028 - H.lines[line]!.nm) / H.lines[line]!.nm).toBeLessThan(1e-3);
    }
  });

  it("cada linha corresponde à diferença de níveis do diagrama (< 0,5 %)", () => {
    for (const g of GASES)
      for (const l of g.lines) {
        const dE = g.levels[l.up]!.E - g.levels[l.low]!.E;
        expect(Math.abs(HC_EV_NM / dE - l.nm) / l.nm).toBeLessThan(5e-3);
      }
  });

  it("rede: d sen θ = mλ e a leitura da luneta inverte o ângulo", () => {
    const a = gratingAngle(589, 600, 1);
    expect(Math.sin(a) * (1e6 / 600)).toBeCloseTo(589, 9);
    expect(gratingLambda(a, 600, 1)).toBeCloseTo(589, 9);
    expect(Number.isNaN(gratingAngle(700, 1200, 2))).toBe(true);
    const p = withOverrides(sim, { N: 600, ordem: 1 });
    const s = { ...sim.init(p), tel: 20 };
    const m = sim.actions!.find((x) => x.id === "medir")!.run(s, p);
    expect(m.meas[0]!.lam).toBeCloseTo((1e6 / 600) * Math.sin(rad(20)), 9);
  });

  it("absorção: Na frio escurece só o dubleto D; H frio não mostra Balmer, H quente mostra", () => {
    const Na = GASES[2]!;
    expect(transmission(Na, 588.995, 600, 1e-4)).toBeLessThan(1e-3);
    expect(transmission(Na, 568.82, 600, 1e-4)).toBeGreaterThan(0.999);
    expect(transmission(Na, 540, 600, 1e-4)).toBeGreaterThan(0.999);
    const H = GASES[0]!;
    expect(transmission(H, 656.28, 3000, 0.05)).toBeGreaterThan(0.999);
    expect(transmission(H, 656.28, 12000, 0.05)).toBeLessThan(0.5);
  });

  it("4 níveis: abaixo do limiar quase sem fótons; acima, ΔN preso em ΔN_th", () => {
    const Wth = thresholdPump(0.9, 4);
    const below = runLaser({ niveis: 4, Wp: 0.5 * Wth, R: 0.9 }, 15);
    expect(below.value("q")).toBeLessThan(1e-4);
    const above = runLaser({ niveis: 4, Wp: 3 * Wth, R: 0.9 }, 15);
    expect(above.value("q")).toBeGreaterThan(1e-3);
    expect(above.value("dN")).toBeCloseTo(thresholdInversion(0.9), 2);
    expect(above.value("Ntot")).toBeCloseTo(1, 9);
  });

  it("limiar de 3 níveis é cerca de 10 vezes o de 4 níveis", () => {
    const r = thresholdPump(0.9, 3) / thresholdPump(0.9, 4);
    expect(r).toBeGreaterThan(8);
    expect(r).toBeLessThan(13);
    const r3 = runLaser({ niveis: 3, Wp: 0.8, R: 0.9 }, 10);
    expect(r3.value("q")).toBeLessThan(1e-4);
    expect(r3.value("dN")).toBeLessThan(thresholdInversion(0.9));
  });
});
