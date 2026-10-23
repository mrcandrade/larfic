import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  anglesOf,
  CIRCULO,
  ELIPSE,
  fermatX,
  LAMINA,
  principioFermat as sim,
  REFLEXAO,
  REFRACAO,
  SALVA,
  slabShift,
  snell,
  travelTime,
  xRange,
  type FermatState,
} from "../src/index.ts";

const D = Math.PI / 180;
const st = (A: [number, number], B: [number, number], xP = 0): FermatState => ({ A, B, xP, th1: 0, drag: null, clock: 0 });

describe("Princípio de Fermat", () => {
  it("reflexão no espelho plano: o mínimo do tempo dá θi = θr (ponto da imagem)", () => {
    const p = withOverrides(sim, { modo: REFLEXAO, espelho: 0 });
    const s = st([-3, 3], [3, 1]);
    const x = fermatX(s, p);
    // pela imagem de A (−3, −3): a reta até B cruza y = 0 em x = 1,5
    expect(x).toBeCloseTo(1.5, 6);
    const a = anglesOf(s, p, x);
    expect(a.th1).toBeCloseTo(a.th2, 5);
    expect(travelTime(s, p, x)).toBeCloseTo((Math.hypot(6, 4) / 299792458) * 1e9, 6);
  });

  it("refração: o mínimo satisfaz n₁ sen θ₁ = n₂ sen θ₂", () => {
    for (const n2 of [1.33, 1.5, 2.2]) {
      const p = withOverrides(sim, { modo: REFRACAO, n1: 1, n2 });
      const s = st([-3, 3], [2.5, -2]);
      const a = anglesOf(s, p, fermatX(s, p));
      expect(Math.sin(a.th1 * D)).toBeCloseTo(n2 * Math.sin(a.th2 * D), 6);
      expect(a.th2).toBeCloseTo(snell(a.th1, 1, n2), 4);
    }
  });

  it("salva-vidas: sen θ₁/v₁ = sen θ₂/v₂ e ganho sobre a linha reta", () => {
    const p = withOverrides(sim, { modo: SALVA, v1: 7, v2: 1.5 });
    const s = st([-3.5, 3], [3, -2.5]);
    const x = fermatX(s, p);
    const a = anglesOf(s, p, x);
    expect(Math.sin(a.th1 * D) / 7).toBeCloseTo(Math.sin(a.th2 * D) / 1.5, 6);
    // ponto da reta AB na linha d'água
    const xr = -3.5 + (6.5 * 3) / 5.5;
    expect(travelTime(s, p, x)).toBeLessThan(travelTime(s, p, xr));
  });

  it("espelho elíptico: tempo constante; círculo mais curvo: máximo no vértice", () => {
    const pe = withOverrides(sim, { modo: REFLEXAO, espelho: ELIPSE });
    const s = st([0, 0], [0, 0]);
    const [a, b] = xRange(pe);
    const t0 = travelTime(s, pe, 0);
    for (const x of [a, -2, 1, b]) expect(travelTime(s, pe, x)).toBeCloseTo(t0, 9);
    expect(t0).toBeCloseTo((10 / 299792458) * 1e9, 9);
    const pc = withOverrides(sim, { modo: REFLEXAO, espelho: CIRCULO });
    for (const x of [-3, -1, 0.5, 2]) expect(travelTime(s, pc, x)).toBeLessThan(travelTime(s, pc, 0));
    const ang = anglesOf(s, pc, 0);
    expect(ang.th1).toBeCloseTo(ang.th2, 6);
  });

  it("lâmina: d = e sen(θ₁ − θ₂)/cos θ₂, limites e linearidade em e", () => {
    expect(slabShift(20, 1.5, 0)).toBeCloseTo(0, 12);
    // pequenos ângulos: d ≈ e θ (1 − 1/n)
    expect(slabShift(20, 1.5, 1)).toBeCloseTo(20 * D * (1 - 1 / 1.5), 4);
    expect(slabShift(40, 1.5, 50) / slabShift(20, 1.5, 50)).toBeCloseTo(2, 12);
    const t2 = Math.asin(Math.sin(45 * D) / 1.5);
    expect(slabShift(10, 1.5, 45)).toBeCloseTo((10 * Math.sin(45 * D - t2)) / Math.cos(t2), 12);
    const r = new Runner(sim, withOverrides(sim, { modo: LAMINA, theta1: 30, e: 25, nl: 1.6 }));
    expect(r.value("yTela")).toBeCloseTo(slabShift(25, 1.6, 30), 12);
  });
});
