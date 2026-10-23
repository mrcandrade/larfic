import { describe, expect, it } from "vitest";
import { Runner, generateExercise, withOverrides } from "@fisilab/core";
import {
  BETA_EMITTERS,
  MAGIC,
  TEMA_BETA,
  alphaK,
  alphaQ,
  betaQ,
  betaShape,
  betaStats,
  closedShells,
  criticalAgo,
  enrichmentAgo,
  kInfAgo,
  ntBreakeven,
  ntIgnition,
  nuclear as sim,
  plasmaBalance,
  shellLevels,
  sigmaV,
} from "../src/index.ts";

describe("Nuclear: espectro beta, camadas, Oklo e Lawson", () => {
  it("beta: Q pelas massas atômicas e energias médias conhecidas (trítio 5,7 keV; ¹⁴C 49 keV; ³²P 0,70 MeV)", () => {
    const [h3, c14, p32] = BETA_EMITTERS;
    expect(betaQ(h3!)).toBeCloseTo(18.59, 1);
    expect(betaQ(c14!)).toBeCloseTo(156.5, 0);
    expect(betaQ(p32!) / 1000).toBeCloseTo(1.711, 2);
    expect(betaStats(h3!).mean).toBeCloseTo(5.7, 1);
    expect(Math.abs(betaStats(c14!).mean - 49.5)).toBeLessThan(1);
    expect(Math.abs(betaStats(p32!).mean - 695)).toBeLessThan(10);
    // espectro contínuo que vai a zero no ponto final
    const Q = betaQ(h3!);
    expect(betaShape(Q, Q, 2)).toBe(0);
    expect(betaShape(0.5 * Q, Q, 2)).toBeGreaterThan(0);
  });

  it("beta: o Monte Carlo do runner reproduz a média e nunca passa de Q", () => {
    const r = new Runner(sim, withOverrides(sim, { tema: TEMA_BETA, emissor: 0 }));
    for (let i = 0; i < 150; i++) r.stepOnce();
    const h = r.state.beta;
    expect(h.count).toBeGreaterThan(5000);
    expect(Math.abs(r.value("Kmed") - 5.7)).toBeLessThan(0.15);
    expect(h.bins.reduce((a, b) => a + b, 0)).toBe(h.count);
    expect(h.last).toBeLessThan(betaQ(BETA_EMITTERS[0]!));
  });

  it("alfa: linha única do ²¹⁰Po em 5,30 MeV (Q = 5,41 MeV)", () => {
    expect(alphaQ()).toBeCloseTo(5.407, 2);
    expect(alphaK()).toBeCloseTo(5.304, 2);
  });

  it("camadas: com spin–órbita as 7 maiores lacunas são os números mágicos; sem, 2, 8, 20, 40, 58, 92…", () => {
    expect(closedShells(shellLevels(208, 1))).toEqual(MAGIC);
    expect(closedShells(shellLevels(150, 1))).toEqual(MAGIC);
    expect(closedShells(shellLevels(208, 0)).slice(0, 6)).toEqual([2, 8, 20, 40, 58, 92]);
    const lv = shellLevels(208, 1);
    // o j = l + 1/2 fica abaixo do j = l − 1/2 e o 1i13/2 cai na camada 82–126
    const f72 = lv.find((v) => v.n === 1 && v.l === 3 && v.j2 === 7)!;
    const f52 = lv.find((v) => v.n === 1 && v.l === 3 && v.j2 === 5)!;
    expect(f72.E).toBeLessThan(f52.E);
    let cum = 0;
    for (const v of lv) {
      cum += v.deg;
      if (v.n === 1 && v.l === 6 && v.j2 === 13) {
        expect(cum).toBeGreaterThan(82);
        expect(cum).toBeLessThanOrEqual(126);
      }
    }
  });

  it("Oklo: há 2 bilhões de anos o urânio tinha ≈ 3,7% de U-235 e era crítico com água; hoje não", () => {
    expect(enrichmentAgo(0)).toBeCloseTo(0.0072, 6);
    expect(enrichmentAgo(2)).toBeGreaterThan(0.035);
    expect(enrichmentAgo(2)).toBeLessThan(0.039);
    expect(kInfAgo(2, 2)).toBeGreaterThan(1);
    expect(kInfAgo(0, 2)).toBeLessThan(1);
    expect(kInfAgo(2, 0)).toBeLessThan(1);
    expect(criticalAgo(0)).toBeGreaterThan(3);
    const tc = criticalAgo(2);
    expect(tc).toBeGreaterThan(0.3);
    expect(tc).toBeLessThan(2);
    expect(kInfAgo(tc, 2)).toBeCloseTo(1, 3);
  });

  it("Lawson: ⟨σv⟩(10 keV) de Bosch–Hale, mínimo de nTτ ≈ 3 × 10²¹ keV·s/m³ e Q = 1 abaixo da ignição", () => {
    expect(sigmaV(10)).toBeCloseTo(1.136e-22, 24);
    let best = Infinity;
    let Tbest = 0;
    for (let T = 2; T <= 60; T += 0.5) {
      const v = T * ntIgnition(T);
      if (v < best) [best, Tbest] = [v, T];
    }
    expect(best).toBeGreaterThan(2.5e21);
    expect(best).toBeLessThan(3.3e21);
    expect(Tbest).toBeGreaterThan(10);
    expect(Tbest).toBeLessThan(20);
    expect(ntBreakeven(15)).toBeLessThan(ntIgnition(15) / 5);
    // no limite da ignição as alfas igualam as perdas; com Q = 1, fusão = aquecimento
    const ig = plasmaBalance(1e20, 15, ntIgnition(15) / 1e20);
    expect(ig.Palpha / ig.Ploss).toBeCloseTo(1, 6);
    const be = plasmaBalance(1e20, 15, ntBreakeven(15) / 1e20);
    expect(be.Q).toBeCloseTo(1, 6);
    expect(plasmaBalance(1e20, 15, 10).Q).toBe(Infinity);
  });

  it("cenários novos montam os temas e os exercícios têm resposta finita", () => {
    for (const id of ["espectro-beta", "camadas", "oklo", "lawson"]) {
      const sc = sim.scenarios!.find((s) => s.id === id)!;
      expect(sc).toBeDefined();
      for (const [k, v] of Object.entries(sc.params)) {
        const spec = sim.params.find((p) => p.key === k)!;
        expect(v).toBeGreaterThanOrEqual(spec.min);
        expect(v).toBeLessThanOrEqual(spec.max);
      }
    }
    for (const id of ["neutrino", "camada-j", "oklo", "lawson"]) {
      const ex = sim.exercises!.find((e) => e.id === id)!;
      expect(Number.isFinite(generateExercise(sim, ex, 3).answer)).toBe(true);
    }
    const ex = sim.exercises!.find((e) => e.id === "neutrino")!;
    expect(ex.answer.compute({ Ke: 5 })).toBeCloseTo(13.59, 1);
    const ok = sim.exercises!.find((e) => e.id === "oklo")!;
    expect(ok.answer.compute({ tx: 2 })).toBeCloseTo(3.67, 1);
    const lw = sim.exercises!.find((e) => e.id === "lawson")!;
    expect(lw.answer.compute({ nx: 1 })).toBeCloseTo(ntIgnition(15) / 1e20, 1);
  });
});
