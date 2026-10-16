import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { escoamentoViscoso as sim } from "../src/index.ts";
import { fTurb, friction, pipeState, profile } from "../src/pipe.ts";
import { lbmSteps, makeLbm, meanCd, strouhal } from "../src/lbm.ts";

describe("escoamento-viscoso", () => {
  it("Hagen–Poiseuille: Δp = 8μLQ/πR⁴ e, com Δp fixo, Q ∝ R⁴", () => {
    const p = withOverrides(sim, { fluido: 1, D: 10, L: 2, ctrl: 0, vm: 0.05 });
    const ps = pipeState(p);
    const R = 0.005;
    expect(ps.re).toBeLessThan(1);
    expect(ps.dp).toBeCloseTo((8 * 1.41 * 2 * ps.q) / (Math.PI * R ** 4), 6);
    const q1 = pipeState(withOverrides(sim, { fluido: 1, D: 10, L: 2, ctrl: 1, dp: 3000 })).q;
    const q2 = pipeState(withOverrides(sim, { fluido: 1, D: 20, L: 2, ctrl: 1, dp: 3000 })).q;
    expect(q1).toBeCloseTo((Math.PI * R ** 4 * 3000) / (8 * 1.41 * 2), 12);
    expect(q2 / q1).toBeCloseTo(16, 6);
  });

  it("perfis: parábola com u_max = 2v̄ no laminar; perfil turbulento achatado com a mesma vazão", () => {
    expect(profile(1000, 0)).toBeCloseTo(2, 12);
    expect(profile(1000, 0.5)).toBeCloseTo(1.5, 12);
    for (const re of [3000, 1e4, 1e6]) {
      // v̄ = (1/πR²)∫u 2πr dr → ∫₀¹ (u/v̄) 2r dr = 1
      let s = 0;
      const n = 20000;
      for (let i = 0; i < n; i++) {
        const r = (i + 0.5) / n;
        s += profile(re, r) * 2 * r * (1 / n);
      }
      expect(s).toBeCloseTo(1, 3);
    }
    expect(profile(2e4, 0)).toBeLessThan(1.3);
  });

  it("atrito: 64/Re no laminar, Blasius no turbulento e Prandtl contínuo em 10⁵", () => {
    expect(friction(1000)).toBeCloseTo(0.064, 12);
    expect(friction(2e4)).toBeCloseTo(0.3164 * 2e4 ** -0.25, 12);
    expect(Math.abs(fTurb(1.0001e5) / fTurb(1e5) - 1)).toBeLessThan(0.02);
    // Turbulento: Δp ∝ v^1,75
    const a = pipeState(withOverrides(sim, { fluido: 0, D: 20, L: 5, vm: 1 })).dp;
    const b = pipeState(withOverrides(sim, { fluido: 0, D: 20, L: 5, vm: 2 })).dp;
    expect(b / a).toBeCloseTo(2 ** 1.75, 6);
  });

  it("experimento de Reynolds: o corante fica num filete no laminar e se espalha no turbulento", () => {
    const lam = new Runner(sim, withOverrides(sim, { fluido: 0, D: 10, vm: 0.1 }));
    const tur = new Runner(sim, withOverrides(sim, { fluido: 0, D: 10, vm: 1 }));
    for (let i = 0; i < 900; i++) {
      lam.stepOnce();
      tur.stepOnce();
    }
    expect(lam.value("mix")).toBeLessThan(1e-9);
    expect(tur.value("mix")).toBeGreaterThan(0.25);
  });

  it(
    "Lattice Boltzmann: esteira de Kármán com Strouhal ≈ 0,2 em Re = 100 e esteira estacionária em Re = 30",
    () => {
      const L = lbmSteps(makeLbm(), 100, 7000);
      expect(strouhal(L)).toBeGreaterThan(0.17);
      expect(strouhal(L)).toBeLessThan(0.23);
      expect(meanCd(L)).toBeGreaterThan(1.3);
      expect(meanCd(L)).toBeLessThan(2.6);
      const S = lbmSteps(makeLbm(), 30, 5000);
      expect(strouhal(S)).toBe(0);
      expect(Math.max(...S.cl.slice(-50).map(Math.abs))).toBeLessThan(0.2);
    },
    60_000,
  );
});
