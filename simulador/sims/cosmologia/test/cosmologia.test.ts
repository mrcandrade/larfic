import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  GALAXIES,
  G_KPC,
  HUBBLE_GYR,
  OMEGA_R,
  T0,
  advanceScale,
  ageAt,
  bestHalo,
  bigBangInit,
  chi2,
  cosmologia as sim,
  decel,
  energyDensity,
  fitHubble,
  hasBigBang,
  lambdaMax,
  makeGalaxies,
  measure,
  nuPeak,
  photonDensity,
  planckNu,
  recombinationT,
  rotationData,
  sahaX,
  vDisk2,
  vHalo2,
  haloMassIn,
  type Cosmo,
} from "../src/index.ts";

const LCDM: Cosmo = { H0: 67.4, Om: 0.315, Or: OMEGA_R, OL: 0.685 - OMEGA_R };

describe("cosmologia: lei de Hubble", () => {
  it("sem velocidades peculiares, todo observador mede exatamente v = H₀d", () => {
    const gs = makeGalaxies(30, 280, 3);
    for (const obs of [0, 5, 17]) {
      const ms = measure(gs, obs, 1.2, 70, 0, 0);
      for (const m of ms) expect(m.v / m.d).toBeCloseTo(70, 10);
      expect(fitHubble(ms).H).toBeCloseTo(70, 10);
    }
  });

  it("com ruído o ajuste continua não enviesado dentro de ~3σ e 1/H₀ = 977,8/H₀ Gyr", () => {
    const gs = makeGalaxies(60, 280, 9);
    const f = fitHubble(measure(gs, 0, 1, 70, 400, 0));
    expect(Math.abs(f.H - 70)).toBeLessThan(3 * f.sigma + 0.5);
    expect(f.sigma).toBeGreaterThan(0);
    // 1 Mpc/(km/s) em Gyr
    expect(HUBBLE_GYR).toBeCloseTo(3.0857e19 / 3.15576e16, 0);
  });
});

describe("cosmologia: radiação de fundo", () => {
  it("corpo negro a 2,725 K: pico em 160 GHz, λ_máx ≈ 1,06 mm, 411 fótons/cm³, u = 4,17 × 10⁻¹⁴ J/m³", () => {
    expect(nuPeak(T0) / 1e9).toBeCloseTo(160.2, 0);
    expect(lambdaMax(T0) * 1e3).toBeCloseTo(1.063, 2);
    expect(photonDensity(T0) / 1e6).toBeCloseTo(410.7, 0);
    expect(energyDensity(T0)).toBeCloseTo(4.175e-14, 16);
    // B_ν tem máximo em hν = 2,821 kT
    const np = nuPeak(T0);
    expect(planckNu(np, T0)).toBeGreaterThan(planckNu(np * 1.01, T0));
    expect(planckNu(np, T0)).toBeGreaterThan(planckNu(np * 0.99, T0));
  });

  it("Saha: X = 1/2 perto de 3700–3800 K; plasma ionizado acima, neutro abaixo; η maior adianta a recombinação", () => {
    const Tr = recombinationT();
    expect(Tr).toBeGreaterThan(3600);
    expect(Tr).toBeLessThan(3900);
    expect(sahaX(6000)).toBeGreaterThan(0.999);
    expect(sahaX(2500)).toBeLessThan(1e-3);
    expect(recombinationT(1e-8)).toBeGreaterThan(Tr);
  });
});

describe("cosmologia: curvas de rotação", () => {
  it("disco exponencial: pico em r ≈ 2,15 R_d com v² ≈ 0,387 GM/R_d; longe vira Kepler", () => {
    let best = 0;
    let rb = 0;
    for (let r = 0.1; r < 20; r += 0.005) {
      const v = vDisk2(r, 1e10, 3);
      if (v > best) [best, rb] = [v, r];
    }
    expect(rb / 3).toBeCloseTo(2.15, 1);
    expect(best / ((G_KPC * 1e10) / 3)).toBeCloseTo(0.387, 2);
    expect(Math.abs(vDisk2(90, 1e10, 3) / ((G_KPC * 1e10) / 90) - 1)).toBeLessThan(0.01);
  });

  it("halo isotérmico: M(R_n) = M_h e v plana longe do núcleo", () => {
    expect(haloMassIn(30, 2e11, 5, 30)).toBeCloseTo(2e11, 0);
    expect(vHalo2(30, 2e11, 5, 30)).toBeCloseTo((G_KPC * 2e11) / 30, 6);
    const v1 = Math.sqrt(vHalo2(200, 1e12, 1, 300));
    const v2 = Math.sqrt(vHalo2(300, 1e12, 1, 300));
    expect(Math.abs(v1 / v2 - 1)).toBeLessThan(0.01);
  });

  it("os dados exigem um halo: sem ele χ² ≫ 1; o melhor ajuste recupera a massa de referência", () => {
    for (const g of GALAXIES) {
      const data = rotationData(g);
      expect(chi2(data, g, 0, g.rcTrue)).toBeGreaterThan(10);
      expect(chi2(data, g, g.MhTrue, g.rcTrue)).toBeLessThan(2);
      const b = bestHalo(data, g, g.rcTrue);
      expect(Math.abs(b / g.MhTrue - 1)).toBeLessThan(0.1);
    }
  });
});

describe("cosmologia: Friedmann", () => {
  it("idades: ΛCDM ≈ 13,8 Gyr; Einstein–de Sitter = (2/3)/H₀; só radiação = 1/(2H₀)", () => {
    expect(ageAt(1, LCDM)).toBeCloseTo(13.79, 1);
    expect(ageAt(1, { H0: 70, Om: 1, Or: 0, OL: 0 })).toBeCloseTo(((2 / 3) * HUBBLE_GYR) / 70, 4);
    expect(ageAt(1, { H0: 70, Om: 0, Or: 1, OL: 0 })).toBeCloseTo(HUBBLE_GYR / 70 / 2, 4);
    expect(hasBigBang({ H0: 70, Om: 0, Or: 0, OL: 1 })).toBe(false);
  });

  it("RK4 de a(t) reproduz a = 1 na idade t₀ e a aceleração atual (q₀ < 0)", () => {
    let st = bigBangInit(LCDM);
    const t0 = ageAt(1, LCDM);
    st = advanceScale(st, t0 - st.tc, LCDM);
    expect(st.tc).toBeCloseTo(t0, 8);
    expect(st.a).toBeCloseTo(1, 3);
    expect(st.ad / st.a).toBeCloseTo(67.4 / HUBBLE_GYR, 4);
    expect(decel(1, LCDM)).toBeCloseTo(0.5 * (2 * OMEGA_R + 0.315) - (0.685 - OMEGA_R), 10);
    expect(decel(1, LCDM)).toBeLessThan(0);
  });

  it("universo fechado (Ω_m = 3) atinge um máximo e recolapsa", () => {
    const c: Cosmo = { H0: 70, Om: 3, Or: 0, OL: 0 };
    let st = bigBangInit(c);
    let amax = 0;
    while (st.tc < 60 && st.a > 0.005) {
      st = advanceScale(st, 0.1, c);
      amax = Math.max(amax, st.a);
    }
    // a_máx = Ω_m/(Ω_m − 1) para matéria com curvatura positiva
    expect(amax).toBeCloseTo(1.5, 2);
    expect(st.a).toBeLessThan(0.01);
  });
});

describe("cosmologia: simulação", () => {
  it("cenários rodam; ponteiro troca o observador; a radiação esfria", () => {
    for (const sc of sim.scenarios) {
      const r = new Runner(sim, withOverrides(sim, sc.params));
      for (let i = 0; i < 60; i++) r.stepOnce();
      expect(r.observe().every(Number.isFinite)).toBe(true);
    }
    const r = new Runner(sim, withOverrides(sim, { tema: 1 }));
    const z0 = r.observe()[sim.observables.findIndex((o) => o.key === "z")]!;
    for (let i = 0; i < 90; i++) r.stepOnce();
    const z1 = r.observe()[sim.observables.findIndex((o) => o.key === "z")]!;
    expect(z1).toBeLessThan(z0);
    const p0 = withOverrides(sim, { tema: 0 });
    const s0 = sim.init(p0);
    expect(sim.actions!.find((a) => a.id === "nossa")!.run({ ...s0, obs: 4 }, p0).obs).toBe(0);
  });
});
