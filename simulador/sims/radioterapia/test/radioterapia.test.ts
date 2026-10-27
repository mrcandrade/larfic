import { describe, expect, it } from "vitest";
import { Runner, defaultParams, withOverrides } from "@fisilab/core";
import {
  PHOTONS,
  braggPeak,
  curveAt,
  curveMetrics,
  electronPDD,
  electronRanges,
  exitDistance,
  optimizeWeights,
  photonPDD,
  planStats,
  protonEnergy,
  protonRange,
  radioterapia as sim,
  sobp,
} from "../src/index.ts";

describe("Radioterapia: dose em profundidade e planejamento", () => {
  it("fótons: reproduz dmax e PDD(10 cm) tabelados, com build-up", () => {
    PHOTONS.forEach((b, k) => {
      expect(photonPDD(k, 10)).toBeCloseTo(b.pdd10, 1);
      let best = 0;
      let arg = 0;
      for (let d = 0; d < 6; d += 0.005) if (photonPDD(k, d) > best) [best, arg] = [photonPDD(k, d), d];
      expect(arg).toBeCloseTo(b.dmax, 1);
      expect(best).toBeCloseTo(100, 6);
      expect(photonPDD(k, 0)).toBeLessThan(40);
    });
    // energia maior penetra mais
    expect(photonPDD(3, 20)).toBeGreaterThan(photonPDD(1, 20));
  });

  it("elétrons: 50% da dose em R50 = E/2,33 e quase nada além de Rp", () => {
    for (const E of [6, 12, 20]) {
      const { R50, Rp } = electronRanges(E);
      expect(electronPDD(E, R50)).toBeGreaterThan(44);
      expect(electronPDD(E, R50)).toBeLessThan(56);
      expect(electronPDD(E, Rp + 1)).toBeLessThan(9);
    }
  });

  it("prótons: pico de Bragg no alcance de Bragg–Kleeman e entrada baixa", () => {
    expect(protonRange(150)).toBeCloseTo(0.0022 * 150 ** 1.77, 12);
    expect(protonEnergy(protonRange(123))).toBeCloseTo(123, 9);
    for (const E of [100, 150, 200]) {
      const R = protonRange(E);
      const m = curveMetrics(braggPeak(R));
      expect(Math.abs(m.d80 - R)).toBeLessThan(0.02 * R + 0.1);
      expect(m.dmax).toBeLessThan(R);
      expect(m.entrance).toBeLessThan(0.35);
      expect((m.d20 - m.d80) * 10).toBeLessThan(10);
    }
  });

  it("SOBP: platô plano (±3%) na região modulada", () => {
    const R = 15;
    const M = 5;
    const s = sobp(R, M);
    const ref = curveAt(s.curve, R - M / 2);
    for (let d = R - M + 0.4; d < R - 0.6; d += 0.1) expect(Math.abs(curveAt(s.curve, d) / ref - 1)).toBeLessThan(0.03);
    expect(curveAt(s.curve, R + 1.5) / ref).toBeLessThan(0.02);
  });

  it("geometria: distância até a borda da elipse", () => {
    const e = { cx: 0, cy: 0, a: 15, b: 10 };
    expect(exitDistance(e, 0, 0, 0, 1)).toBeCloseTo(10, 12);
    expect(exitDistance(e, 5, 0, 1, 0)).toBeCloseTo(10, 12);
  });

  it("planejamento: mais feixes reduzem o volume de tecido normal com dose alta; otimização poupa o órgão de risco", () => {
    const s0 = sim.init(withOverrides(sim, { modo: 1 }));
    const one = planStats(s0, withOverrides(sim, { modo: 1, nf: 1 }));
    const five = planStats(s0, withOverrides(sim, { modo: 1, nf: 5 }));
    expect(one.ptvMean).toBeCloseTo(100, 6);
    expect(five.normalV50).toBeLessThan(0.5 * one.normalV50);
    // órgão de risco no caminho do feixe que vem de baixo (180°)
    const p = withOverrides(sim, { modo: 1, nf: 4, ang0: 0, limOAR: 20 });
    const s = { ...s0, tumor: [0, 0] as [number, number], oar: [0, -6] as [number, number] };
    const before = planStats(s, p);
    const w = optimizeWeights(s, p);
    const after = planStats({ ...s, w: w.concat([1, 1, 1, 1, 1]) }, p);
    expect(after.oarMax).toBeLessThan(before.oarMax);
    expect(w[2]!).toBeLessThan(w[0]!);
  });

  it("roda com parâmetros padrão e as frações acumulam dose", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    for (const v of r.observe()) expect(Number.isFinite(v)).toBe(true);
    const r2 = new Runner(sim, withOverrides(sim, { modo: 1, Dp: 20 }));
    for (let i = 0; i < 1000 && !r2.finished; i++) r2.stepOnce();
    expect(r2.finished).toBe(true);
    const gy = sim.observables.find((o) => o.key === "gy")!.value(r2.state, r2.params, r2.t);
    expect(gy).toBeCloseTo(20, 6);
  });
});
