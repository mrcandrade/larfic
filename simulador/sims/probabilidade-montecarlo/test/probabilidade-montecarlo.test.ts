import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { binom, galtonStats, msdTheory, piHat, sigmaPiMC, walkStats, probabilidadeMontecarlo as sim } from "../src/index.ts";

const runner = (over: Record<string, number>) => new Runner(sim, withOverrides(sim, over));
const lote = sim.actions!.find((a) => a.id === "lote")!;

describe("Probabilidade e Monte Carlo", () => {
  it("binomial normalizada, com média np e variância np(1−p)", () => {
    let s = 0, m = 0, m2 = 0;
    for (let k = 0; k <= 20; k++) {
      const P = binom(20, k, 0.3);
      s += P; m += k * P; m2 += k * k * P;
    }
    expect(s).toBeCloseTo(1, 12);
    expect(m).toBeCloseTo(6, 10);
    expect(m2 - m * m).toBeCloseTo(4.2, 10);
    expect(binom(12, 6, 0.5)).toBeCloseTo(924 / 4096, 12);
  });

  it("tábua de Galton: média e variância das bolas batem com a binomial", () => {
    const r = runner({ modo: 0, linhas: 12, p: 0.7, taxa: 10 });
    for (let i = 0; i < 100; i++) r.stepOnce();
    let s = r.state;
    for (let i = 0; i < 5; i++) s = lote.run(s, r.params);
    const g = galtonStats(s);
    expect(s.landed).toBeGreaterThan(5000);
    expect(Math.abs(g.mean - 8.4)).toBeLessThan(5 * Math.sqrt(2.52 / s.landed));
    expect(g.v / 2.52).toBeGreaterThan(0.93);
    expect(g.v / 2.52).toBeLessThan(1.07);
  });

  it("π por Monte Carlo fica dentro de 4σ e σ ∝ 1/√N", () => {
    const r = runner({ modo: 1 });
    let s = r.state;
    for (let i = 0; i < 10; i++) s = lote.run(s, r.params);
    expect(s.nTot).toBe(100000);
    expect(Math.abs(piHat(s, r.params) - Math.PI)).toBeLessThan(4 * sigmaPiMC(100000));
    expect(sigmaPiMC(100) / sigmaPiMC(10000)).toBeCloseTo(10, 10);
  });

  it("agulha de Buffon estima π", () => {
    const r = runner({ modo: 2, ell: 0.8 });
    let s = r.state;
    for (let i = 0; i < 10; i++) s = lote.run(s, r.params);
    expect(Math.abs(piHat(s, r.params) - Math.PI)).toBeLessThan(0.08);
  });

  it("caminhada 1D e 2D: ⟨x²⟩ = 4Np(1−p) + N²(2p−1)² e ⟨r²⟩ = N", () => {
    for (const [modo, p] of [[3, 0.5], [3, 0.6], [4, 0.5]] as const) {
      const r = runner({ modo, p, M: 1000 });
      let s = r.state;
      for (let i = 0; i < 2; i++) s = lote.run(s, r.params);
      const w = walkStats(s);
      const teo = msdTheory(modo, 200, modo === 4 ? 0.5 : p);
      expect(s.steps).toBe(200);
      expect(Math.abs(w.msd / teo - 1)).toBeLessThan(0.12);
    }
  });
});
