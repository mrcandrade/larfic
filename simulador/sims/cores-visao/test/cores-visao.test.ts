import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  blurWindow,
  coneTemplate,
  coresVisao as sim,
  dichromatLMS,
  FILTERS,
  flat,
  lms,
  matchPrimaries,
  mono,
  perceived,
  PRIMARIES,
  prod,
  rayleighRatio,
  sum,
  VIEWERS,
  xyz,
} from "../src/index.ts";

describe("Cores e visão", () => {
  it("cones: picos nos λmax e branco de energia igual → (1, 1, 1)", () => {
    for (const pk of [420, 530, 559]) {
      const v = coneTemplate(pk, pk);
      expect(v).toBeGreaterThan(coneTemplate(pk, pk - 15));
      expect(v).toBeGreaterThan(coneTemplate(pk, pk + 15));
    }
    const w = lms(flat);
    for (const c of w) expect(c).toBeCloseTo(1, 10);
    expect(xyz(flat)[1]).toBeCloseTo(1, 10);
    // branco percebido sai neutro (canais RGB próximos)
    const rgb = perceived(flat, 0);
    expect(Math.max(...rgb) / Math.min(...rgb)).toBeLessThan(1.35);
  });

  it("metâmero: a mistura RGB calculada reproduz exatamente L, M, S do alvo", () => {
    const target = lms(mono(580));
    const w = matchPrimaries(target);
    expect(w.every((x) => x >= -1e-9) || w.some((x) => x < 0)).toBe(true);
    const mix = sum(...PRIMARIES.map((f, i) => ({ f, w: w[i]! })));
    const got = lms(mix);
    for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(target[i]!, 10);
    // amarelo 580 nm é reproduzível (pesos ≥ 0), ciano espectral 495 nm não é
    expect(Math.min(...matchPrimaries(lms(mono(580))))).toBeGreaterThan(-0.02);
    expect(Math.min(...matchPrimaries(lms(mono(495))))).toBeLessThan(0);
  });

  it("dicromatas: branco preservado; protanope confunde vermelho e verde de mesmo brilho", () => {
    for (const m of [0, 1, 2]) {
      const w = dichromatLMS([1, 1, 1], m);
      for (const c of w) expect(c).toBeCloseTo(1, 10);
    }
    // no protanope, L reconstruído é função de M e S: dois estímulos com mesmos M e S ficam iguais
    const a = dichromatLMS([0.9, 0.4, 0.02], 0);
    const b = dichromatLMS([0.2, 0.4, 0.02], 0);
    expect(a[0]).toBeCloseTo(b[0], 12);
  });

  it("anomaloscópio: protanômalo precisa de mais vermelho; deuteranômalo de menos", () => {
    const n = rayleighRatio(VIEWERS[0]!.peaks);
    expect(n).toBeGreaterThan(0.05);
    expect(n).toBeLessThan(0.95);
    expect(rayleighRatio(VIEWERS[4]!.peaks)).toBeGreaterThan(n);
    expect(rayleighRatio(VIEWERS[5]!.peaks)).toBeLessThan(n);
  });

  it("subtrativa: amarelo × ciano deixa passar o verde; disco funde em f = FFC", () => {
    const g = prod(FILTERS.Y, FILTERS.C);
    expect(g(540)).toBeGreaterThan(0.8);
    expect(g(450)).toBeLessThan(0.1);
    expect(g(650)).toBeLessThan(0.1);
    expect(blurWindow(50, 50)).toBeCloseTo(2 * Math.PI, 12);
    const r = new Runner(sim, withOverrides(sim, { modo: 2, freq: 1 }));
    for (let i = 0; i < 30; i++) r.stepOnce();
    expect(r.state.phi).toBeCloseTo(Math.PI, 9);
    expect(r.value("mistura")).toBeCloseTo(1 / 50, 12);
  });
});
