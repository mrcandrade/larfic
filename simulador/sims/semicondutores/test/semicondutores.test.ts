import { describe, expect, it } from "vitest";
import { withOverrides } from "@fisilab/core";
import {
  KB_EV,
  MATERIALS,
  carriers,
  fermiDirac,
  junction,
  junctionFor,
  kpBands,
  kpEnergy,
  kpF,
  kpGaps,
  lambdaNm,
  ni,
  semicondutores as sim,
  wavelengthRGB,
} from "../src/index.ts";

const Si = MATERIALS[2]!;

describe("Semicondutores", () => {
  it("Kronig–Penney: P = 0 é o elétron livre; P > 0 abre gaps na borda da zona", () => {
    expect(kpGaps(0, 0.3, 4).every((g) => Math.abs(g) < 1e-9)).toBe(true);
    const P = 3 * Math.PI / 2;
    const b = kpBands(P, 3);
    // topo da banda n em αa = nπ, onde f = ±1
    b.forEach((band) => expect(Math.abs(kpF(band.hi, P))).toBeCloseTo(1, 9));
    // bordas inferiores: |f| = 1
    b.forEach((band) => expect(Math.abs(kpF(band.lo, P))).toBeCloseTo(1, 6));
    const g = kpGaps(P, 0.3, 3);
    expect(g[0]!).toBeGreaterThan(0);
    // topo da 1ª banda = energia do elétron livre em k = π/a
    expect(kpEnergy(b[0]!.hi, 0.3)).toBeCloseTo((0.0380998 * Math.PI ** 2) / 0.09, 6);
    // P pequeno: fundo da 1ª banda em (αa)² ≈ 2P (E ≈ ħ²·2P/2ma²)
    const Ps = 0.01;
    const x0 = kpBands(Ps, 1)[0]!.lo;
    expect((x0 * x0) / (2 * Ps)).toBeCloseTo(1, 2);
  });

  it("barreira mais forte: bandas mais estreitas e gaps maiores", () => {
    const width = (P: number) => {
      const b = kpBands(P, 1)[0]!;
      return kpEnergy(b.hi, 0.3) - kpEnergy(b.lo, 0.3);
    };
    expect(width(10)).toBeLessThan(width(3));
    expect(kpGaps(10, 0.3, 2)[0]!).toBeGreaterThan(kpGaps(3, 0.3, 2)[0]!);
    // P → ∞: a banda 1 tende ao nível do poço infinito (αa → π)
    expect(kpBands(2000, 1)[0]!.lo / Math.PI).toBeGreaterThan(0.99);
  });

  it("Fermi–Dirac e concentrações intrínsecas (Si, Ge, GaAs a 300 K)", () => {
    expect(fermiDirac(0.7, 0.7, 300)).toBeCloseTo(0.5, 12);
    expect(fermiDirac(0.8, 0.7, 300) + fermiDirac(0.6, 0.7, 300)).toBeCloseTo(1, 12);
    expect(Math.log10(ni(Si, 300))).toBeCloseTo(10, 0);
    expect(Math.log10(ni(MATERIALS[1]!, 300))).toBeCloseTo(13.3, 0);
    expect(Math.log10(ni(MATERIALS[3]!, 300))).toBeCloseTo(6.3, 0);
    expect(ni(MATERIALS[4]!, 300)).toBeLessThan(1e-20);
    // lei de ação das massas e E_F acima de Eᵢ no tipo n
    const c = carriers(Si, 300, 1e16, 0);
    expect(c.n).toBeCloseTo(1e16, -10);
    expect((c.n * c.p) / c.ni ** 2).toBeCloseTo(1, 10);
    expect(Si.Eg - c.EF).toBeGreaterThan(0.15);
    expect(Si.Eg - c.EF).toBeLessThan(0.3);
    const cp = carriers(Si, 300, 0, 1e17);
    expect(cp.EF).toBeLessThan(0.2);
  });

  it("junção pn: V_bi, W ≈ 0,43 µm, neutralidade e diodo de Shockley", () => {
    const T = 300;
    const J = junction(Si, T, 1e16, 1e16, 0);
    const nI = ni(Si, T);
    expect(J.Vbi).toBeCloseTo(KB_EV * T * Math.log(1e32 / nI ** 2), 12);
    expect(J.Vbi).toBeGreaterThan(0.65);
    expect(J.Vbi).toBeLessThan(0.8);
    expect(J.W * 1e6).toBeGreaterThan(0.38);
    expect(J.W * 1e6).toBeLessThan(0.48);
    const A = junction(Si, T, 1e17, 1e15, -2);
    expect(A.xp * 1e17).toBeCloseTo(A.xn * 1e15, 20);
    // W ∝ √(V_bi − V)
    const Jr = junction(Si, T, 1e16, 1e16, -5);
    expect(Jr.W / J.W).toBeCloseTo(Math.sqrt((J.Vbi + 5) / J.Vbi), 6);
    // 60 mV por década a 300 K
    const I1 = junction(Si, T, 1e16, 1e16, 0.6).I;
    const I2 = junction(Si, T, 1e16, 1e16, 0.6 + KB_EV * T * Math.LN10).I;
    expect(I2 / I1).toBeCloseTo(10, 3);
    expect(junction(Si, T, 1e16, 1e16, -1).I).toBeCloseTo(-J.Is, 25);
  });

  it("LED: λ = hc/E_g, cor visível e tensão de condução cresce com o gap", () => {
    expect(lambdaNm(1.9)).toBeCloseTo(652.5, 0);
    expect(wavelengthRGB(650)![0]).toBe(255);
    expect(wavelengthRGB(460)![2]).toBe(255);
    expect(wavelengthRGB(900)).toBeNull();
    const von = (Eg: number) => {
      const J = junctionFor(withOverrides(sim, { vista: 4, EgLED: Eg, V: 0 }));
      return KB_EV * 300 * Math.log1p(1e-3 / J.Is);
    };
    expect(von(2.7)).toBeGreaterThan(von(1.9) + 0.6);
    expect(von(1.9)).toBeGreaterThan(1.2);
    expect(von(1.9)).toBeLessThan(1.9);
  });
});
