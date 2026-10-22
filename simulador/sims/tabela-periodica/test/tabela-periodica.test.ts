import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  tabelaPeriodica as sim,
  IONIZATION_EV,
  KALPHA_KEV,
  MADELUNG,
  NOBLE,
  RADIUS_PM,
  block,
  capacity,
  configString,
  configuration,
  e1eV,
  hundTerm,
  ionization,
  kTheory,
  moseleyFit,
  position,
  slaterZeff,
  sqrtF,
  unpaired,
  wellSummary,
  zFromKalpha,
} from "../src/index.ts";

describe("Átomos com muitos elétrons e a tabela periódica", () => {
  it("Madelung e capacidades: 19 subcamadas comportam 118 elétrons; gases nobres fecham camadas p", () => {
    expect(MADELUNG.map((q) => `${q.n}${"spdf"[q.l]}`).join(" ")).toBe("1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p");
    expect(MADELUNG.reduce((a, q) => a + capacity(q.l), 0)).toBe(118);
    for (let Z = 1; Z <= 118; Z++) expect(configuration(Z).reduce((a, k) => a + k, 0)).toBe(Z);
    for (const z of NOBLE) expect(unpaired(z)).toBe(0);
  });

  it("configurações reais, inclusive as exceções", () => {
    expect(configString(26, true, true)).toBe("[Ar] 4s² 3d⁶");
    expect(configString(24, true, true)).toBe("[Ar] 4s¹ 3d⁵");
    expect(configString(24, false, true)).toBe("[Ar] 4s² 3d⁴");
    expect(configString(29, true, true)).toBe("[Ar] 4s¹ 3d¹⁰");
    expect(configString(46, true, true)).toBe("[Kr] 4d¹⁰");
    expect(configString(79, true, true)).toBe("[Xe] 6s¹ 4f¹⁴ 5d¹⁰");
    expect(configString(11)).toBe("1s² 2s² 2p⁶ 3s¹");
  });

  it("regra de Hund: desemparelhados e termos do estado fundamental", () => {
    const cases: [number, number, string][] = [
      [1, 1, "2S1/2"], [6, 2, "3P0"], [7, 3, "4S3/2"], [8, 2, "3P2"], [9, 1, "2P3/2"],
      [24, 6, "7S3"], [26, 4, "5D4"], [28, 2, "3F4"], [29, 1, "2S1/2"], [64, 8, "9D2"], [92, 4, "5L6"],
    ];
    for (const [Z, u, term] of cases) {
      expect(unpaired(Z)).toBe(u);
      expect(hundTerm(Z).text).toBe(term);
    }
  });

  it("posição na tabela e blocos", () => {
    expect(position(26)).toMatchObject({ period: 4, group: 8 });
    expect(position(2)).toMatchObject({ period: 1, group: 18 });
    expect(position(13)).toMatchObject({ period: 3, group: 13 });
    expect(position(60)).toMatchObject({ period: 6, f: true });
    expect(position(79)).toMatchObject({ period: 6, group: 11 });
    expect(position(118)).toMatchObject({ period: 7, group: 18 });
    expect([block(2), block(5), block(26), block(64)]).toEqual([0, 1, 2, 3]);
  });

  it("dados reais: picos de ionização nos gases nobres, mínimos nos alcalinos; raio cresce para baixo no grupo", () => {
    expect(IONIZATION_EV).toHaveLength(86);
    expect(RADIUS_PM).toHaveLength(86);
    for (const ng of [2, 10, 18, 36, 54, 86]) {
      expect(ionization(ng)).toBeGreaterThan(ionization(ng - 1));
      if (ng < 86) expect(ionization(ng)).toBeGreaterThan(2.5 * ionization(ng + 1));
    }
    // Quedas de Be→B e N→O
    expect(ionization(5)).toBeLessThan(ionization(4));
    expect(ionization(8)).toBeLessThan(ionization(7));
    const alk = [3, 11, 19, 37, 55].map((z) => RADIUS_PM[z - 1]!);
    for (let i = 1; i < alk.length; i++) expect(alk[i]!).toBeGreaterThan(alk[i - 1]!);
  });

  it("Slater: Na tem Z_ef = 2,2; Z_ef cresce ao longo do 2º período", () => {
    expect(slaterZeff(11).zeff).toBeCloseTo(2.2, 10);
    expect(slaterZeff(6).zeff).toBeCloseTo(3.25, 10);
    expect(slaterZeff(26).zeff).toBeCloseTo(3.75, 10);
    for (let z = 4; z <= 10; z++) expect(slaterZeff(z).zeff - slaterZeff(z - 1).zeff).toBeCloseTo(0.65, 10);
  });

  it("poço 1D: 7 elétrons → 44 E₁, excitação mínima 7 E₁; sem Pauli → N E₁; E₁ = 0,376 eV para L = 1 nm", () => {
    const w = wellSummary(7, 1, true);
    expect(w.Etot).toBe(44);
    expect(w.EF).toBe(16);
    expect(w.dE).toBe(7);
    expect(wellSummary(7, 1, false).Etot).toBe(7);
    for (const N of [2, 4, 10, 20]) expect(wellSummary(N, 1, true).Etot).toBe((2 * (N / 2) * (N / 2 + 1) * (N + 1)) / 6);
    expect(e1eV(1)).toBeCloseTo(0.376, 3);
    const r = new Runner(sim, withOverrides(sim, { modo: 1, N: 5, L: 0.5, dim: 1, pauli: 1 }));
    expect(r.value("Etot")).toBeCloseTo(19 * e1eV(0.5), 10);
  });

  it("poço 2D: degenerescências e energia total", () => {
    // (1,1)=2, (1,2)/(2,1)=5, (2,2)=8, (1,3)/(3,1)=10
    expect(wellSummary(2, 2, true).Etot).toBe(4);
    expect(wellSummary(6, 2, true).Etot).toBe(4 + 4 * 5);
    expect(wellSummary(8, 2, true).Etot).toBe(4 + 20 + 16);
    const w = wellSummary(3, 2, true);
    expect(w.orbs.filter((o) => o.e === 5).map((o) => o.occ)).toEqual([1, 0]);
    expect(w.dE).toBe(3);
  });

  it("Moseley: √f linear em Z com inclinação de Bohr e blindagem ≈ 1; identifica o Cu", () => {
    const fit = moseleyFit();
    expect(kTheory).toBeCloseTo(0.4967, 3);
    expect(fit.k / kTheory).toBeCloseTo(1, 1);
    expect(fit.sigma).toBeGreaterThan(0.5);
    expect(fit.sigma).toBeLessThan(1.6);
    expect(Math.round(zFromKalpha(KALPHA_KEV[29]!))).toBe(29);
    expect(Math.round(zFromKalpha(KALPHA_KEV[26]!))).toBe(26);
    expect(sqrtF(KALPHA_KEV[40]!) / sqrtF(KALPHA_KEV[20]!)).toBeCloseTo(39 / 19, 1);
  });

  it("estado: ações mudam Z e a animação de preenchimento chega a Z", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, Z: 10 }));
    r.setState(sim.actions!.find((a) => a.id === "construir")!.run(r.state, r.params));
    expect(r.state.fill).toBe(0);
    while (r.state.fill < 10) r.stepOnce();
    expect(r.t).toBeCloseTo(3.5, 1);
    r.setState(sim.actions!.find((a) => a.id === "mais")!.run(r.state, r.params));
    expect(r.value("Z")).toBe(11);
    expect(r.value("IE")).toBeCloseTo(5.139, 3);
  });
});
