import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { GASES, critical, gasOf, lobeAreas, maxwell, pr, pressureSI, stateOf, vStop, vanDerWaals as sim } from "../src/index.ts";

describe("gás de van der Waals", () => {
  it("o ponto crítico é uma inflexão horizontal em (1, 1, 1) e reproduz T_c e P_c do CO₂", () => {
    const h = 1e-4;
    const dp = (pr(1, 1 + h) - pr(1, 1 - h)) / (2 * h);
    const d2p = (pr(1, 1 + h) - 2 * pr(1, 1) + pr(1, 1 - h)) / (h * h);
    expect(pr(1, 1)).toBeCloseTo(1, 12);
    expect(Math.abs(dp)).toBeLessThan(1e-6);
    expect(Math.abs(d2p)).toBeLessThan(1e-3);
    const c = critical(gasOf(6));
    expect(c.Tc).toBeCloseTo(304.1, 0);
    expect(c.Pc / 1e5).toBeCloseTo(74.0, 0);
    // A equação em SI no ponto crítico dá P_c.
    expect(pressureSI(gasOf(6), c.Tc, c.Vc) / c.Pc).toBeCloseTo(1, 10);
  });

  it("a construção de Maxwell dá áreas iguais e os valores tabelados de t = 0,9", () => {
    const c = maxwell(0.9)!;
    expect(c.p).toBeCloseTo(0.647, 3);
    expect(c.vl).toBeCloseTo(0.6034, 3);
    expect(c.vg).toBeCloseTo(2.3488, 3);
    for (const t of [0.6, 0.85, 0.95, 0.99]) {
      const m = maxwell(t)!;
      const A = lobeAreas(t, m);
      expect(Math.abs(A.below - A.above) / A.above).toBeLessThan(1e-6);
      // Líquido e vapor em equilíbrio estão sobre a isoterma.
      expect(pr(t, m.vl)).toBeCloseTo(m.p, 9);
      expect(pr(t, m.vg)).toBeCloseTo(m.p, 9);
    }
    // A coexistência encolhe até o ponto crítico.
    const near = maxwell(0.9999)!;
    expect(near.p).toBeCloseTo(1, 3);
    expect(near.vg - near.vl).toBeLessThan(0.1);
    expect(maxwell(1.05)).toBeUndefined();
  });

  it("compressão isotérmica: patamar a P_s, regra da alavanca e líquido no fim", () => {
    const r = new Runner(sim, withOverrides(sim, { gas: 6, tr: 0.9 }));
    const c = maxwell(0.9)!;
    let flat = 0;
    let lastX = 0;
    while (!r.finished && r.t < 200) {
      r.stepOnce();
      const q = stateOf(r.state, r.params);
      if (q.v > c.vl && q.v < c.vg) {
        flat++;
        expect(q.pEq).toBeCloseTo(c.p, 12);
        expect(q.xl).toBeGreaterThanOrEqual(lastX - 1e-12);
        lastX = q.xl;
      }
    }
    expect(r.finished).toBe(true);
    expect(flat).toBeGreaterThan(20);
    expect(stateOf(r.state, r.params).v).toBeCloseTo(vStop(0.9), 4);
    expect(r.value("xl")).toBe(100);
  });

  it("estados correspondentes e limite de gás ideal", () => {
    // Mesmo (t, v) reduzido dá o mesmo P/P_c para todos os gases.
    for (const g of GASES) {
      const c = critical(g);
      expect(pressureSI(g, 1.2 * c.Tc, 2 * c.Vc) / c.Pc).toBeCloseTo(pr(1.2, 2), 10);
    }
    // Volume grande: Z → 1.
    const g = gasOf(2);
    const c = critical(g);
    const V = 1e3 * c.Vc;
    const T = 1.5 * c.Tc;
    expect((pressureSI(g, T, V) * V) / (8.314462618 * T)).toBeCloseTo(1, 3);
  });
});
