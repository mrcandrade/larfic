import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  G,
  HERON,
  LUDIAO,
  P0,
  RHO,
  equilibrioU,
  forcaFundo,
  forcaLudiao,
  heron,
  hMaxSuccao,
  nivelComum,
  pesoAgua,
  profEquilibrio,
  vasosComunicantes as sim,
  volumeAr,
} from "../src/index.ts";

const run = (over: Record<string, number>, T: number) => {
  const r = new Runner(sim, withOverrides(sim, over));
  while (r.t < T - 1e-9 && !r.finished) r.stepOnce();
  return r;
};

describe("Vasos comunicantes e hidrostática", () => {
  it("vasos de formas diferentes chegam ao mesmo nível, conservando o volume", () => {
    const r = run({ modo: 0, volume: 1.5, vasoInicial: 1 }, 40);
    expect(r.value("dh")).toBeLessThan(0.01);
    const V = r.state.V.reduce((a, b) => a + b, 0);
    expect(V).toBeCloseTo(1.5e-3, 9);
    expect(r.value("nivel")).toBeCloseTo(nivelComum(1.5e-3) * 100, 1);
  });

  it("sonda: mesma pressão no mesmo nível em vasos diferentes, p = p0 + ρ g h", () => {
    const r = run({ modo: 0, volume: 1.5, vasoInicial: 4 }, 1);
    const h = nivelComum(1.5e-3);
    const M = { X0: 0.4, Y0: 1.6, k: 11.5 };
    r.setState({ ...r.state, sonda: [M.X0 + M.k * 0.1, M.Y0 + M.k * 0.02] });
    const p1 = r.value("pSonda");
    r.setState({ ...r.state, sonda: [M.X0 + M.k * 0.95, M.Y0 + M.k * 0.02] });
    expect(r.value("pSonda")).toBeCloseTo(p1, 3);
    expect(p1).toBeCloseTo((P0 + RHO * G * (h - 0.02)) / 1000, 2);
  });

  it("tubo em U: ρA hA = ρB hB e a densidade medida bate", () => {
    const eq = equilibrioU(1000, 800, 0.2);
    expect(1000 * (eq.zr - eq.zi)).toBeCloseTo(800 * 0.2, 9);
    expect(eq.dh).toBeCloseTo(0.2 * (1 - 0.8), 9);
    const r = run({ modo: 1, liquidos: 0, LB: 0.15 }, 15);
    expect(r.value("rhoB")).toBeCloseTo(900, 0);
    expect(r.value("dh")).toBeCloseTo(15 * 0.1, 2);
  });

  it("paradoxo hidrostático: mesma força no fundo, pesos diferentes", () => {
    const h = 0.3;
    expect(forcaFundo(h)).toBeCloseTo(1000 * 9.81 * 0.3 * 0.01, 9);
    expect(pesoAgua(0, h)).toBeCloseTo(forcaFundo(h), 6); // cilindro: peso = força no fundo
    expect(pesoAgua(3, h)).toBeCloseTo(forcaFundo(h), 6); // inclinado de mesma seção horizontal
    expect(pesoAgua(1, h)).toBeGreaterThan(forcaFundo(h));
    expect(pesoAgua(2, h)).toBeLessThan(forcaFundo(h));
  });

  it("ludião: Boyle e equilíbrio instável; afunda apertando, sobe soltando", () => {
    expect(volumeAr(0, 0)).toBeCloseTo(LUDIAO.Va0, 12);
    const de = profEquilibrio(1000);
    expect(forcaLudiao(de, 1000)).toBeCloseTo(0, 9);
    expect(forcaLudiao(de - 0.01, 1000)).toBeGreaterThan(0);
    expect(forcaLudiao(de + 0.01, 1000)).toBeLessThan(0);
    const r = run({ modo: 3, aperto: 5, travar: 1 }, 10);
    expect(r.value("nivel")).toBeGreaterThan(25); // no fundo
    const r2 = run({ modo: 3, aperto: 5, travar: 0 }, 3);
    expect(r2.value("nivel")).toBeLessThan(2); // flutua
  });

  it("fonte de Heron: sem perdas o jato atinge (zA − zC) − (zbico − zB)", () => {
    const zB = 0.6, zC = 0.1;
    const r = heron(zB, zC, 0.01); // bico minúsculo: perda no tubo desprezível
    expect(r.hJato).toBeCloseTo(HERON.zA - zC - (HERON.zBico - zB), 3);
    const rr = run({ modo: 4, bico: 2 }, 20);
    expect(rr.state.zB).toBeLessThan(HERON.B.y1 - 0.005);
    expect(rr.state.zC - (HERON.C.y0 + 0.02)).toBeCloseTo(HERON.B.y1 - 0.005 - rr.state.zB, 9); // conservação
  });

  it("bomba de sucção para em (p0 − pv)/ρg; a de compressão chega a qualquer altura", () => {
    expect(hMaxSuccao(101_325)).toBeCloseTo((101_325 - 2340) / 9810, 9);
    const r = run({ modo: 6, bomba: 0, Hb: 12, freq: 2 }, 60);
    expect(r.value("nivel") / 100).toBeCloseTo(hMaxSuccao(101_325), 6);
    expect(r.value("Vbomb")).toBe(0);
    const r2 = run({ modo: 6, bomba: 1, Hb: 12, freq: 2 }, 60);
    expect(r2.value("Vbomb")).toBeGreaterThan(0);
    expect(r2.value("Fpistao")).toBeCloseTo(RHO * G * 12 * 0.005, 1);
  });

  it("barril de Pascal estoura quando ρ g h A passa da resistência", () => {
    const r = run({ modo: 7, hTubo: 9, Fmax: 20 }, 15);
    expect(r.state.estourou).toBe(true);
    expect(r.value("Ffundo")).toBeGreaterThan(20000);
    expect(r.value("Ffundo")).toBeLessThan(20000 + RHO * G * 0.25 * 0.02);
  });
});
